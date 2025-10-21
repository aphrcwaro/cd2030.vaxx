// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import type { IUiApi, PickFileOptions } from './typings/electron-api.js';
import { IPC_CHANNELS } from './ui-utils.js';

const uiApi: IUiApi = {
    retry: async () => await ipcRenderer.invoke(IPC_CHANNELS.RETRY_START_SHINY),
    pickFile: async (opts?: PickFileOptions) => ipcRenderer.invoke(IPC_CHANNELS.PICK_FILE, opts ?? {})
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('uiApi', uiApi);
