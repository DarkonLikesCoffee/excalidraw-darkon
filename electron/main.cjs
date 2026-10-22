const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const boardStorage = require("./storage/boards.cjs");

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
ipcMain.handle("personal-fonts:list", () => {
  const folder = path.join(app.getPath("userData"), "personal-fonts");
  fs.mkdirSync(folder, { recursive: true });
  let fonts = [];
  try { fonts = JSON.parse(fs.readFileSync(path.join(folder, "fonts.json"), "utf8")); } catch {}
  return fonts.filter((font) => fs.existsSync(path.join(folder, font.fileName))).map((font) => ({
    id: font.id, family: font.family, dataUrl: fs.readFileSync(path.join(folder, font.fileName)).toString("base64"), format: font.format,
  }));
});
ipcMain.handle("personal-fonts:import", async () => {
  const result = await dialog.showOpenDialog({ title: "Import Font", properties: ["openFile"], filters: [{ name: "Font files", extensions: ["ttf", "otf", "woff", "woff2"] }] });
  if (result.canceled || !result.filePaths.length) return null;
  const source = result.filePaths[0];
  if (fs.statSync(source).size > 20 * 1024 * 1024) throw new Error("Font files must be 20 MB or smaller.");
  const extension = path.extname(source).toLowerCase();
  const format = ({ ".ttf": "truetype", ".otf": "opentype", ".woff": "woff", ".woff2": "woff2" })[extension];
  if (!format) throw new Error("Unsupported font format.");
  const folder = path.join(app.getPath("userData"), "personal-fonts");
  fs.mkdirSync(folder, { recursive: true });
  const manifestPath = path.join(folder, "fonts.json");
  let fonts = [];
  try { fonts = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch {}
  const family = path.basename(source, extension).replace(/[-_]+/g, " ").trim() || "Custom Font";
  const id = Math.max(1001, ...fonts.map((font) => font.id + 1));
  const fileName = `font-${id}${extension}`;
  fs.copyFileSync(source, path.join(folder, fileName));
  const font = { id, family, fileName, format };
  fonts.push(font);
  fs.writeFileSync(manifestPath, JSON.stringify(fonts, null, 2));
  return { id, family, dataUrl: fs.readFileSync(path.join(folder, fileName)).toString("base64"), format };
});
ipcMain.handle("personal-fonts:remove", (_, id) => {
  const folder = path.join(app.getPath("userData"), "personal-fonts");
  const manifestPath = path.join(folder, "fonts.json");
  let fonts = [];
  try { fonts = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch {}
  const font = fonts.find((item) => item.id === id);
  if (!font) return false;
  try { fs.unlinkSync(path.join(folder, font.fileName)); } catch {}
  fs.writeFileSync(manifestPath, JSON.stringify(fonts.filter((item) => item.id !== id), null, 2));
  return true;
});
ipcMain.handle("boards:get-thumbnail", (_, id) => boardStorage.getThumbnail(id));
ipcMain.handle("boards:save-thumbnail", (_, id, dataUrl) => boardStorage.saveThumbnail(id, dataUrl));

ipcMain.on("window:minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.control && input.shift && input.key.toLowerCase() === "i") win.webContents.toggleDevTools();
  });
  win.loadURL("http://localhost:3001");
}

app.whenReady().then(() => {
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
