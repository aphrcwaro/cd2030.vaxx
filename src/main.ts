import { app, BrowserWindow, dialog, Menu, IpcMainInvokeEvent, MenuItemConstructorOptions, shell } from 'electron';
import path from 'node:path';
import { updateElectronApp } from 'update-electron-app';
import started from 'electron-squirrel-startup';

import { rShinyManager } from './rshiny';
import { IPC_CHANNELS } from './ui-utils';
import { validatedIpcMain } from './ipc-main-utils';
import { setUnexpectedErrorHandler } from './errors';
import { LifecycleMainService, LifecycleMainPhase } from './lifecycleMainService';
import { SaveStrategy, StateService } from './stateService';

// --- Services --------------------------------------------------------------------------------------------------------

const stateService = new StateService({ saveStrategy: SaveStrategy.DELAYED });
const lifecycleMainService = new LifecycleMainService(stateService);

lifecycleMainService.onWillShutdown(({ join }) => {
    join('rshiny-teardown', (async () => {
        try {
            await rShinyManager.teardown();
        } catch (error) {
            console.error('Failed to teardown R Shiny during shutdown:', error);
        }
    })());
});

setUnexpectedErrorHandler(err => console.error(err));

// --- Globals --------------------------------------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

// --- Helpers --------------------------------------------------------------------------------------------------------

const buildMenu = (): void => {
    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: async () => { await createWindow(); } },
                { type: 'separator' },
                {
                    label: 'Open File…',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!mainWindow) {
                            return;
                        }
                        await dialog.showOpenDialog(mainWindow, {});
                    }
                },
                {
                    label: 'Open Folder…',
                    click: async () => {
                        if (!mainWindow) {
                            return;
                        }
                        await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
                    }
                },
                { type: 'separator' },
                { label: 'Exit', accelerator: 'CmdOrCtrl+Q', role: 'quit' as const }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', role: 'undo' },
                { label: 'Redo', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', role: 'cut' },
                { label: 'Copy', role: 'copy' },
                { label: 'Paste', role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
                { label: 'Toggle Full Screen', role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() }
            ]
        },
        {
            label: 'Help',
            submenu: [
                { label: 'GitHub Repository', click: async () => shell.openExternal('https://github.com/your-repo-link') },
                { type: 'separator' },
                {
                    label: `${app.getName()} About`,
                    click: () => dialog.showMessageBox({ title: 'About', message: `${app.getName()} v${app.getVersion()}` })
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

const createWindow = async (): Promise<void> => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            webSecurity: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    mainWindow.webContents.on('did-start-loading', async () => {
        if (mainWindow && mainWindow.webContents.getURL() !== 'about:blank') {
            console.log('Window content change detected. Ensuring R process is running...');
            await rShinyManager.startAndServe(mainWindow);
        }
    });

    rShinyManager.bindPowerEvents(mainWindow);
    await rShinyManager.startAndServe(mainWindow);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    lifecycleMainService.phase = LifecycleMainPhase.AfterWindowOpen;
    setTimeout(() => {
        lifecycleMainService.phase = LifecycleMainPhase.Eventually;
    }, 2500);
};

// --- Startup -------------------------------------------------------------------------------------------------------

if (started) {
    app.quit();
}

Menu.setApplicationMenu(null);
updateElectronApp();

app.on('ready', async () => {
    buildMenu();

    await stateService.initialize();
    lifecycleMainService.phase = LifecycleMainPhase.Ready;

    await createWindow();
});

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
    }
});

// --- IPC -----------------------------------------------------------------------------------------------------------

validatedIpcMain.handle(IPC_CHANNELS.RETRY_START_SHINY, async (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        console.log('IPC: Retrying Shiny startup...');
        await rShinyManager.startAndServe(window);
    }
});

validatedIpcMain.handle(IPC_CHANNELS.PICK_FILE, async (event, opts) => {
    const window = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!window) {
        return null;
    }

    const filters = Array.isArray(opts?.accept) && opts.accept.length
        ? [{ name: 'Allowed', extensions: opts.accept }]
        : [{ name: 'All Files', extensions: ['*'] }];

    const properties: ('multiSelections' | 'openFile' | 'openDirectory')[] = [];
    if (opts?.multiple) {
        properties.push('multiSelections');
    }
    properties.push('openFile');

    const { canceled, filePaths } = await dialog.showOpenDialog(window, { properties, filters });
    if (canceled) {
        return null;
    }

    return opts?.multiple ? filePaths : filePaths[0];
});
