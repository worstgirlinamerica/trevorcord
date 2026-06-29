const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const patcher = require("../src/patcher");

function createWindow() {
  const win = new BrowserWindow({
    width: 780,
    height: 560,
    minWidth: 680,
    minHeight: 500,
    title: "TrevorCord Installer",
    backgroundColor: "#1e1f22",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "renderer.html"));
}

ipcMain.handle("trevorcord:status", async () => patcher.getStatus());
ipcMain.handle("trevorcord:install", async () => patcher.install({ silent: true }));
ipcMain.handle("trevorcord:restore", async () => patcher.restore({ silent: true }));
ipcMain.handle("trevorcord:openExternal", async (_event, url) => {
  await shell.openExternal(url);
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
