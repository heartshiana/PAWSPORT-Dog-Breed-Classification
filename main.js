/**
 * PAWSPORT — Electron Main Process (fixed)
 */

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path   = require("path");
const http   = require("http");
const { spawn } = require("child_process");
const fs     = require("fs");

let mainWindow   = null;
let pythonServer = null;
const SERVER_PORT = 5000;

// Resolve paths relative to THIS file, not cwd
const APP_DIR   = __dirname;
const SERVER_PY = path.join(APP_DIR, "server.py");

// ── Find python executable ───────────────────────────────────────────────────
function startPythonServer() {
  if (!fs.existsSync(SERVER_PY)) {
    console.error(`[Electron] server.py not found at: ${SERVER_PY}`);
    console.error("[Electron] Run  python server.py  separately in your project folder.");
    return;
  }

  const candidates = process.platform === "win32"
    ? ["python", "python3", "py"]
    : ["python3", "python"];

  let tried = 0;

  function tryNext() {
    if (tried >= candidates.length) {
      console.error("[Electron] Could not find Python. Run `python server.py` manually.");
      return;
    }
    const cmd = candidates[tried++];

    const proc = spawn(cmd, [SERVER_PY], {
      cwd: APP_DIR,
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    proc.on("error", (err) => {
      console.warn(`[Electron] spawn("${cmd}") failed: ${err.message}`);
      tryNext();
    });

    proc.stdout.on("data", (d) => process.stdout.write("[Python] " + d));
    proc.stderr.on("data", (d) => process.stderr.write("[Python] " + d));
    proc.on("close", (code) => {
      if (code !== 0 && code !== null)
        console.warn("[Python] exited with code", code);
    });

    pythonServer = proc;
    console.log(`[Electron] Python server started via "${cmd}" (PID: ${proc.pid})`);
  }

  tryNext();
}

// ── Poll until Flask responds ────────────────────────────────────────────────
function waitForServer(retries = 30) {
  return new Promise((resolve) => {
    function attempt(n) {
      const req = http.get(
        { hostname: "127.0.0.1", port: SERVER_PORT, path: "/health", timeout: 800 },
        () => resolve(true)
      );
      req.on("error", () => {
        if (n <= 0) return resolve(false);
        setTimeout(() => attempt(n - 1), 600);
      });
      req.on("timeout", () => req.destroy());
    }
    attempt(retries);
  });
}

// ── Create window ─────────────────────────────────────────────────────────────
async function createWindow() {
  startPythonServer();

  mainWindow = new BrowserWindow({
    width:     1100,
    height:    750,
    minWidth:  900,
    minHeight: 640,
    backgroundColor: "#0f1117",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(APP_DIR, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(APP_DIR, "index.html"));

  // Notify renderer when server is ready
  waitForServer().then((ready) => {
    if (!mainWindow) return;
    if (ready) {
      console.log("[Electron] Server ready.");
      mainWindow.webContents.send("server-ready");
    } else {
      console.warn("[Electron] Server not responding — demo mode.");
      mainWindow.webContents.send("server-unavailable");
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC: native file picker ───────────────────────────────────────────────────
ipcMain.handle("open-file-dialog", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select a dog photo",
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fp   = result.filePaths[0];
  const data = fs.readFileSync(fp);
  const ext  = path.extname(fp).slice(1).toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { path: fp, base64: `data:${mime};base64,${data.toString("base64")}` };
});

// ── Lifecycle ──────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (pythonServer) { pythonServer.kill(); pythonServer = null; }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => { if (!mainWindow) createWindow(); });
app.on("before-quit", () => { if (pythonServer) { pythonServer.kill(); pythonServer = null; } });
