const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ppmpDesktop", {
  isElectron: true,
  getApiBaseUrl: () => ipcRenderer.invoke("ppmp:get-api-base-url"),
  getAppVersion: () => ipcRenderer.invoke("ppmp:get-app-version"),
});
