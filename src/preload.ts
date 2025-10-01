// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { IUiApi } from './types/electron-api';
import { IPC_CHANNELS } from './ui-utils';

const uiApi: IUiApi = {
    retry: async () =>  await ipcRenderer.invoke(IPC_CHANNELS.RETRY_START_SHINY),
    pickFile: async (opts) => await ipcRenderer.invoke(IPC_CHANNELS.PICK_FILE, opts || {})
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('uiApi', uiApi);