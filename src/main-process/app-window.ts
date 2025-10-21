import { app, autoUpdater, BrowserWindow, BrowserWindowConstructorOptions, dialog, ipcMain, Menu } from "electron";
import { Emitter } from "../event.js";
import windowStateKeeper from "electron-window-state";
import { isLinux, isMacintosh, isWindows } from "../platform.js";

export function now(): number {
  const time = process.hrtime()
  return time[0] * 1000 + time[1] / 1000000
}


export class AppWindow {
    private window: BrowserWindow;
    private emitter = new Emitter();

    private _loadTime: number | null = null
    private _rendererReadyTime: number | null = null
    private isDownloadingUpdate: boolean = false

    private minWidth = 960
    private minHeight = 660

    private shouldMaximizeOnShow = false

    constructor() {
        const savedWindowState = windowStateKeeper({
            defaultWidth: this.minWidth,
            defaultHeight: this.minHeight,
            maximize: false,
        });

        const windowOptions: BrowserWindowConstructorOptions = {
            x: savedWindowState.x,
            y: savedWindowState.y,
            width: savedWindowState.width,
            height: savedWindowState.height,
            minWidth: this.minWidth,
            minHeight: this.minHeight,
            show: false,

            backgroundColor: '#fff',
            webPreferences: {
                disableBlinkFeatures: 'Auxclick',
                nodeIntegration: true,
                spellcheck: true,
                contextIsolation: false
            },
            acceptFirstMouse: true
        };

        if (isMacintosh) {
            windowOptions.titleBarStyle = 'hidden';
        } else if (isWindows) {
            windowOptions.frame = false;
        } else if (isLinux) {
           // windowOptions.icon = path.join(__dirname, 'static', 'icon-logo.png');
        }

        this.window = new BrowserWindow(windowOptions);

        savedWindowState.manage(this.window)
        this.shouldMaximizeOnShow = savedWindowState.isMaximized;

        let quitting = false;
        let quittingEvenIfUpdating = false;

        ipcMain.on('before-quit', () => {
            quitting = true;
        });

        ipcMain.on('will-quit', event => {
            quitting = true;
            event.returnValue = true;
        });

        ipcMain.on('will-quit-even-if-updating', event => {
            quitting = true;
            quittingEvenIfUpdating = true;
            event.returnValue = true;
        });

        ipcMain.on('cancel-quitting', event => {
            quitting = false;
            quittingEvenIfUpdating = false;
            event.returnValue = true;
        });

        this.window.on('close', e => {
            if ((!isMacintosh || quitting) &&
                !quittingEvenIfUpdating &&
                this.isDownloadingUpdate
            ) {
                e.preventDefault();
                //ipcWebContents.send(this.window.webContents, 'show-installing-update');

                // Make sure the window is visible, so the user can see why we're
                // preventing the app from quitting. This is important on macOS, where
                // the window could be hidden/closed when the user tries to quit.
                // It could also happen on Windows if the user quits the app from the
                // task bar while it's in the background.
                this.show();
                return;
            }
        })
    }

    public load() {
        let startLoad = 0;
        // We only listen for the first of the loading events to avoid a bug in
        // Electron/Chromium where they can sometimes fire more than once. See
        // See
        // https://github.com/desktop/desktop/pull/513#issuecomment-253028277. This
        // shouldn't really matter as in production builds loading _should_ only
        // happen once.
        this.window.webContents.once('did-start-loading', () => {
            this._rendererReadyTime = null;
            this._loadTime = null;

            startLoad = now();
        });

        this.window.webContents.once('did-finish-load', () => {
            if (process.env.NODE_ENV === 'development') {
                this.window.webContents.openDevTools();
            }

            this._loadTime = now() - startLoad;

            this.maybeEmitDidLoad();
        });

        this.window.webContents.on('did-finish-load', () => {
            this.window.webContents.setVisualZoomLevelLimits(1, 1);
        });

        this.window.webContents.on('did-fail-load', () => {
            this.window.webContents.openDevTools();
            this.window.show();
        });

        // TODO: This should be scoped by the window.
        ipcMain.once('renderer-ready', (_, readyTime) => {
            this._rendererReadyTime = readyTime;
            this.maybeEmitDidLoad();
        });

        this.window.on('focus', () => {
            //ipcWebContents.send(this.window.webContents, 'focus');
        });
        this.window.on('blur', () => {
            //ipcWebContents.send(this.window.webContents, 'blur');
        });

        //registerWindowStateChangedEvents(this.window)
        //this.window.loadURL(encodePathAsUrl(__dirname, 'index.html'))
        /*
        nativeTheme.addListener('updated', () => {
            ipcWebContents.send(this.window.webContents, 'native-theme-updated')
        })
        */
        this.setupAutoUpdater()
    }

    /**
     * Emit the `onDidLoad` event if the page has loaded and the renderer has
     * signalled that it's ready.
     */
    private maybeEmitDidLoad() {
        if (!this.rendererLoaded) {
        return
        }

        this.emitter.fire('did-load')
    }

    /** Is the page loaded and has the renderer signalled it's ready? */
    private get rendererLoaded(): boolean {
        return !!this.loadTime && !!this.rendererReadyTime
    }

    public onClosed(fn: () => void) {
        this.window.on('closed', fn)
    }

    /**
     * Register a function to call when the window is done loading. At that point
     * the page has loaded and the renderer has signalled that it is ready.
     */
    public onDidLoad(fn: () => void): void {
        //this.emitter.event('did-load', fn)
    }

    public isMinimized() {
        return this.window.isMinimized()
    }

    /** Is the window currently visible? */
    public isVisible() {
        return this.window.isVisible()
    }

    public restore() {
        this.window.restore()
    }

    public isFocused() {
        return this.window.isFocused()
    }

    public focus() {
        this.window.focus()
    }

    /** Selects all the windows web contents */
    public selectAllWindowContents() {
        this.window.webContents.selectAll()
    }

    /** Show the window. */
    public show() {
        this.window.show()
        if (this.shouldMaximizeOnShow) {
        // Only maximize the window the first time it's shown, not every time.
        // Otherwise, it causes the problem described in desktop/desktop#11590
        this.shouldMaximizeOnShow = false
        this.window.maximize()
        }
    }



    /** Send the app menu to the renderer. */
    public sendAppMenu() {
        const appMenu = Menu.getApplicationMenu()
        if (appMenu) {
            //const menu = menuFromElectronMenu(appMenu)
            //ipcWebContents.send(this.window.webContents, 'app-menu', menu)
        }
    }

    /** Handle when a modal dialog is opened. */
    public dialogDidOpen() {
        if (this.window.isFocused()) {
            // No additional notifications are needed.
            return
        }
        // Care is taken to mimic OS dialog behaviors.
        if (isMacintosh) {
            // macOS beeps when a modal dialog is opened.
            //shell.beep()
            // See https://developer.apple.com/documentation/appkit/nsapplication/1428358-requestuserattention
            // "If the inactive app presents a modal panel, this method will be invoked with NSCriticalRequest
            // automatically. The modal panel is not brought to the front for an inactive app."
            // NOTE: flashFrame() uses the 'informational' level, so we need to explicitly bounce the dock
            // with the 'critical' level in order to that described behavior.
            app.dock?.bounce('critical')
        } else {
            // See https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-taskbar#taskbar-button-flashing
            // "If an inactive program requires immediate attention,
            // flash its taskbar button to draw attention and leave it highlighted."
            // It advises not to beep.
            this.window.once('focus', () => this.window.flashFrame(false))
            this.window.flashFrame(true)
        }
    }

    /**
     * Get the time (in milliseconds) spent loading the page.
     *
     * This will be `null` until `onDidLoad` is called.
     */
    public get loadTime(): number | null {
        return this._loadTime
    }

    /**
     * Get the time (in milliseconds) elapsed from the renderer being loaded to it
     * signaling it was ready.
     *
     * This will be `null` until `onDidLoad` is called.
     */
    public get rendererReadyTime(): number | null {
        return this._rendererReadyTime
    }

    public destroy() {
        this.window.destroy()
    }

    public setupAutoUpdater() {
        autoUpdater.on('error', (error: Error) => {
            this.isDownloadingUpdate = false
            //ipcWebContents.send(this.window.webContents, 'auto-updater-error', error)
        })

        autoUpdater.on('checking-for-update', () => {
            this.isDownloadingUpdate = false
            /*ipcWebContents.send(
                this.window.webContents,
                'auto-updater-checking-for-update'
            )*/
        })

        autoUpdater.on('update-available', () => {
        this.isDownloadingUpdate = true
            /*ipcWebContents.send(
                this.window.webContents,
                'auto-updater-update-available'
            )*/
        })

        autoUpdater.on('update-not-available', () => {
            this.isDownloadingUpdate = false
            /*ipcWebContents.send(
                this.window.webContents,
                'auto-updater-update-not-available'
            )*/
        })

        autoUpdater.on('update-downloaded', () => {
        this.isDownloadingUpdate = false
            /*ipcWebContents.send(
                this.window.webContents,
                'auto-updater-update-downloaded'
            )*/
        })
    }

    public async checkForUpdates(url: string) {
        try {
            //autoUpdater.setFeedURL({ url: await trySetUpdaterGuid(url) })
            autoUpdater.checkForUpdates()
        } catch (e) {
            return e
        }
        return undefined
    }

    public quitAndInstallUpdate() {
        autoUpdater.quitAndInstall()
    }

    public minimizeWindow() {
        this.window.minimize()
    }

    public maximizeWindow() {
        this.window.maximize()
    }

    public unmaximizeWindow() {
        this.window.unmaximize()
    }

    public closeWindow() {
        this.window.close()
    }

    public isMaximized() {
        return this.window.isMaximized()
    }

    public getCurrentWindowState() {
        //return getWindowState(this.window)
    }

    public getCurrentWindowZoomFactor() {
        return this.window.webContents.zoomFactor
    }

    public setWindowZoomFactor(zoomFactor: number) {
        this.window.webContents.zoomFactor = zoomFactor
    }

    /**
     * Method to show the save dialog and return the first file path it returns.
     */
    public async showSaveDialog(options: Electron.SaveDialogOptions) {
        const { canceled, filePath } = await dialog.showSaveDialog(
        this.window,
        options
        )
        return !canceled && filePath !== undefined ? filePath : null
    }

    /**
     * Method to show the open dialog and return the first file path it returns.
     */
    public async showOpenDialog(options: Electron.OpenDialogOptions) {
        const { filePaths } = await dialog.showOpenDialog(this.window, options)
        return filePaths.length > 0 ? filePaths[0] : null
    }
}
