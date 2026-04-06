/**
 * PAWSPORT — Preload (Context Bridge)
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pawsport", {
  serverPort: 5000,

  // Native file dialog
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),

  // Server lifecycle events from main process
  onServerReady:       (cb) => ipcRenderer.on("server-ready",       () => cb()),
  onServerUnavailable: (cb) => ipcRenderer.on("server-unavailable", () => cb()),
});
