(function () {

    const { contextBridge, ipcRenderer } = require('electron');
    //const IPC_CHANNELS = require('./ui-utils.js');
    type IUiApi = import('./typings/electron-api.d.js').IUiApi;
    type PickFileOptions = import('./typings/electron-api.d.js').PickFileOptions;

    const uiApi: IUiApi = {
        retry: async () => await ipcRenderer.invoke(/*IPC_CHANNELS.RETRY_START_SHINY*/'cd2030:retry-start-shiny'),
        pickFile: async (opts?: PickFileOptions) => await ipcRenderer.invoke(/*IPC_CHANNELS.PICK_FILE*/'cd2030:pick-file', opts ?? {})
    };

    try {
        // Expose the API to the renderer process
        contextBridge.exposeInMainWorld('uiApi', uiApi);
    } catch (error) {
        console.error(error);
    }

}());

