const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("TrevorCordInstaller", {
  status: () => ipcRenderer.invoke("trevorcord:status"),
  install: () => ipcRenderer.invoke("trevorcord:install"),
  restore: () => ipcRenderer.invoke("trevorcord:restore"),
  openExternal: url => ipcRenderer.invoke("trevorcord:openExternal", url),
});
