import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { updateElectronApp } from 'update-electron-app'
import started from 'electron-squirrel-startup';
import { rShinyManager } from './rshiny';
import { IPC_CHANNELS } from './ui-utils';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

updateElectronApp()

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webSecurity: true,
      nodeIntegration: false,
    },
  });

  // Listen for the window reload event
  mainWindow.webContents.on('did-start-loading', async () => {
    if (mainWindow.webContents.getURL() !== 'about:blank') {
      console.log('Window reload detected. Restarting R process...');
      await rShinyManager.startAndServe(mainWindow);
    }
  });

  // Initial start of RShiny
  await rShinyManager.startAndServe(mainWindow);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  await rShinyManager.teardown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Ensure R process is shut down before quitting completely
app.on('before-quit', rShinyManager.teardown);

ipcMain.handle(IPC_CHANNELS.RETRY_START_SHINY, async (event: IpcMainInvokeEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    await rShinyManager.startAndServe(window);
  }
});

ipcMain.handle(IPC_CHANNELS.GET_VERSION, () => app.getVersion())
