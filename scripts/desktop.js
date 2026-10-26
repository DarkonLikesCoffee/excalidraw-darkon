#!/usr/bin/env node

// Starts the desktop app for development: runs the Vite dev server (unless
// one is already running) and opens the Electron window on top of it.
//
//   yarn desktop [electron args]
//
// Closing the window stops the dev server this script started.

const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.join(__dirname, "..");
// passed to electron/main.cjs (port: VITE_APP_PORT in .env.development)
const DEV_SERVER_URL = "http://localhost:3001";
const DEV_SERVER_PORT = new URL(DEV_SERVER_URL).port;
const DEV_SERVER_TIMEOUT_MS = 120_000;

const isServerUp = () =>
  new Promise((resolve) => {
    const request = http.get(DEV_SERVER_URL, (response) => {
      response.resume();
      resolve(true);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });

const waitForServer = async (devServer) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < DEV_SERVER_TIMEOUT_MS) {
    if (devServer.exitCode !== null) {
      throw new Error("The dev server exited before it was ready.");
    }
    if (await isServerUp()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The dev server did not start on ${DEV_SERVER_URL}.`);
};

const startDevServer = () =>
  spawn(
    process.execPath,
    [
      // not in vite's package "exports", so resolve it next to package.json
      path.join(
        path.dirname(require.resolve("vite/package.json")),
        "bin/vite.js",
      ),
      "--port",
      DEV_SERVER_PORT,
      "--strictPort",
    ],
    { cwd: path.join(rootDir, "excalidraw-app"), stdio: "inherit" },
  );

const main = async () => {
  let devServer = null;

  if (await isServerUp()) {
    console.info(`Using the dev server already running on ${DEV_SERVER_URL}`);
  } else {
    console.info("Starting the dev server…");
    devServer = startDevServer();
    try {
      await waitForServer(devServer);
    } catch (error) {
      devServer.kill();
      throw error;
    }
  }

  const stopDevServer = () => {
    if (devServer && devServer.exitCode === null) {
      devServer.kill();
    }
  };

  // resolves the Electron binary (downloading it on first use if missing)
  const electronPath = require("electron");
  const app = spawn(electronPath, [rootDir, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, EXCALIDRAW_DEV_SERVER_URL: DEV_SERVER_URL },
  });

  app.on("exit", (code) => {
    stopDevServer();
    process.exit(code ?? 0);
  });
  devServer?.on("exit", () => {
    if (app.exitCode === null) {
      console.error("The dev server stopped; closing the app.");
      app.kill();
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      app.kill();
      stopDevServer();
    });
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
