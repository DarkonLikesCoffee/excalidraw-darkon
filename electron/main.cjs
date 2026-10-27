const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, ipcMain, Menu, dialog, protocol, net, shell } = require("electron");
const boardStorage = require("./storage/boards.cjs");
const personalFonts = require("./storage/personalFonts.cjs");

// Keep using the data folder of the development setup (named after the
// package), so the packaged app sees the same personal fonts, settings and
// recent boards instead of starting from an empty "Excalidraw Custom" folder.
app.setPath("userData", path.join(app.getPath("appData"), "excalidraw-monorepo"));

// Only one instance may use that data folder at a time (`yarn desktop` and the
// installed app share it): a second one would find the browser storage locked.
// The lock is tied to the data folder, so it must be requested after setPath.
if (!app.requestSingleInstanceLock()) {
  console.info("Excalidraw Custom is already running; focusing the existing window.");
  app.exit(0);
}

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows().find((w) => w.isVisible() || w.isMinimized());
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

// `yarn desktop` points the window at the Vite dev server; otherwise the
// production build (excalidraw-app/build) is served from disk via app://.
const DEV_SERVER_URL = process.env.EXCALIDRAW_DEV_SERVER_URL || null;
const APP_ORIGIN = "app://excalidraw";
const BUILD_DIR = path.join(__dirname, "..", "excalidraw-app", "build");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function serveBuild() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.normalize(path.join(BUILD_DIR, decodeURIComponent(pathname)));
    if (filePath !== BUILD_DIR && !filePath.startsWith(BUILD_DIR + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    // unknown paths fall back to the app's entry point
    const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(BUILD_DIR, "index.html");
    return net.fetch(pathToFileURL(target).toString());
  });
}

let boardsWatcher = null;
let boardsWatchTimer = null;
let externalWatcher = null;
let externalWatchTimer = null;

function stopExternalWatcher() {
  if (externalWatchTimer) { clearTimeout(externalWatchTimer); externalWatchTimer = null; }
  if (externalWatcher) { externalWatcher.close(); externalWatcher = null; }
}

function startExternalWatcher(filePath, boardId) {
  stopExternalWatcher();
  const directory = path.dirname(filePath);
  const targetFilename = path.basename(filePath);
  externalWatcher = fs.watch(directory, { persistent: false }, (eventType, filename) => {
    if (!filename || filename.toString() !== targetFilename) return;
    if (externalWatchTimer) clearTimeout(externalWatchTimer);
    externalWatchTimer = setTimeout(() => {
      externalWatchTimer = null;
      broadcastBoardsChanged({ eventType, filename: boardId, path: filePath });
    }, 100);
  });
}

function broadcastBoardsChanged(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("boards:changed", payload);
  }
}

function stopBoardsWatcher() {
  if (boardsWatchTimer) { clearTimeout(boardsWatchTimer); boardsWatchTimer = null; }
  if (boardsWatcher) { boardsWatcher.close(); boardsWatcher = null; }
  stopExternalWatcher();
}

function normalizeWatcherFilename(filename) {
  if (!filename) return null;
  const relative = filename.toString();
  const absolute = path.resolve(boardStorage.getBoardsFolder(), relative);
  if (!absolute.toLowerCase().endsWith(".excalidraw") || !fs.existsSync(absolute)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(absolute, "utf-8"));
    const id = data?.custom?.excalidrawCustomId;
    return typeof id === "string" ? `${id}.excalidraw` : relative;
  } catch {
    return relative;
  }
}

function emitBoardsChanged(eventType, filename) {
  broadcastBoardsChanged({
    eventType,
    filename: normalizeWatcherFilename(filename),
  });
}

function startBoardsWatcher() {
  stopBoardsWatcher();
  const boardsFolder = boardStorage.getBoardsFolder();
  const handleChange = (eventType, filename) => {
    if (boardsWatchTimer) clearTimeout(boardsWatchTimer);
    boardsWatchTimer = setTimeout(() => {
      boardsWatchTimer = null;
      emitBoardsChanged(eventType, filename);
    }, 150);
  };
  try {
    boardsWatcher = fs.watch(boardsFolder, { persistent: false, recursive: true }, handleChange);
  } catch {
    boardsWatcher = fs.watch(boardsFolder, { persistent: false }, handleChange);
  }
}

ipcMain.handle("boards:list", (_, relativeFolderPath = "") => boardStorage.listBoards(relativeFolderPath));
ipcMain.handle("boards:create", (_, name, relativeFolderPath = "") => boardStorage.createBoard(name, relativeFolderPath));
ipcMain.handle("boards:duplicate", (_, id) => boardStorage.duplicateBoard(id));
ipcMain.handle("boards:move", (_, id, destinationRelativeFolderPath) => boardStorage.moveBoard(id, destinationRelativeFolderPath));
ipcMain.handle("boards:create-folder", (_, relativeParentPath, name) => boardStorage.createFolder(relativeParentPath, name));
ipcMain.handle("boards:list-folders", () => boardStorage.listAllFolders());
ipcMain.handle("boards:save", (_, id, data, expectedMtimeMs, force) => boardStorage.saveBoard(id, data, expectedMtimeMs, force));
ipcMain.handle("boards:load", (_, id) => {
  const result = boardStorage.loadBoard(id);
  boardStorage.addRecentBoard(id);
  return result;
});
ipcMain.handle("boards:delete", async (_, id) => boardStorage.deleteBoard(id));
ipcMain.handle("boards:rename", (_, id, newName) => boardStorage.renameBoard(id, newName));
ipcMain.handle("boards:get-folder", () => boardStorage.getBoardsFolder());
ipcMain.handle("boards:set-folder", (_, folderPath) => {
  const result = boardStorage.setBoardsFolder(folderPath);
  startBoardsWatcher();
  broadcastBoardsChanged({ eventType: "folder-changed", filename: null });
  return result;
});
ipcMain.handle("boards:choose-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], title: "Choose Boards Folder" });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
const getPersonalFontsFolder = () => path.join(app.getPath("userData"), "personal-fonts");
ipcMain.handle("personal-fonts:list", () => personalFonts.listFonts(getPersonalFontsFolder()));
ipcMain.handle("personal-fonts:import", async () => {
  const result = await dialog.showOpenDialog({ title: "Import Font", properties: ["openFile"], filters: [{ name: "Font files", extensions: ["ttf", "otf", "woff", "woff2"] }] });
  if (result.canceled || !result.filePaths.length) return null;
  return personalFonts.importFont(getPersonalFontsFolder(), result.filePaths[0]);
});
ipcMain.handle("personal-fonts:remove", (_, id) => personalFonts.removeFont(getPersonalFontsFolder(), id));
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("boards:get-thumbnail", (_, id) => boardStorage.getThumbnail(id));
ipcMain.handle("boards:save-thumbnail", (_, id, dataUrl) => boardStorage.saveThumbnail(id, dataUrl));

ipcMain.on("window:minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());

// Web links open in the default browser, never inside the app.
function openInBrowser(url) {
  try {
    if (["http:", "https:", "mailto:"].includes(new URL(url).protocol)) void shell.openExternal(url);
  } catch {}
}

function handleLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Excalidraw opens element links in a blank window and sets its location
    // afterwards: create it hidden and redirect that navigation below.
    if (url === "about:blank") return { action: "allow", overrideBrowserWindowOptions: { show: false } };
    openInBrowser(url);
    return { action: "deny" };
  });
  win.webContents.on("did-create-window", (child) => {
    child.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      openInBrowser(url);
      child.close();
    });
    // don't leave it behind when the navigation never starts (e.g. file: links
    // are blocked), as a hidden window would keep the app running
    const timeout = setTimeout(() => {
      if (!child.isDestroyed()) child.close();
    }, 5000);
    child.on("closed", () => clearTimeout(timeout));
  });
  // the app window itself only ever shows the app
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin === new URL(win.webContents.getURL()).origin) return;
    event.preventDefault();
    openInBrowser(url);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: "hidden",
    // window/taskbar icon (installers use the same file, see "build.icon")
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  handleLinks(win);
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.control && input.shift && input.key.toLowerCase() === "i") win.webContents.toggleDevTools();
  });
  win.loadURL(DEV_SERVER_URL || `${APP_ORIGIN}/`);
}

app.whenReady().then(() => {
  if (!DEV_SERVER_URL) {
    if (!fs.existsSync(path.join(BUILD_DIR, "index.html"))) {
      dialog.showErrorBox("Excalidraw Custom", `The app has not been built yet (missing ${BUILD_DIR}).\n\nRun "yarn desktop:build", or "yarn desktop" for development.`);
      app.quit();
      return;
    }
    serveBuild();
  }
  Menu.setApplicationMenu(null);
  boardStorage.initializeStorage(app.getPath("userData"));
  startBoardsWatcher();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { stopBoardsWatcher(); if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("boards:open-external", async () => {
  const result = await dialog.showOpenDialog({ title: "Open Excalidraw File", properties: ["openFile"], filters: [{ name: "Excalidraw files", extensions: ["excalidraw"] }] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const opened = boardStorage.openExternalBoard(result.filePaths[0]);
  boardStorage.addRecentBoard(opened.id);
  startExternalWatcher(opened.path, opened.id);
  return opened;
});

ipcMain.handle("boards:open-recent", (_, id, filePath, kind) => {
  const opened = boardStorage.openRecentBoard(id, filePath, kind);
  boardStorage.addRecentBoard(opened.id);
  if (opened.kind === "external") startExternalWatcher(opened.path, opened.id); else stopExternalWatcher();
  return opened;
});
ipcMain.handle("boards:get-recent", () => boardStorage.getRecentBoards());
ipcMain.handle("boards:remove-recent", (_, filePath) => boardStorage.removeRecentBoard(filePath));
ipcMain.handle("boards:stop-external-watch", () => stopExternalWatcher());
