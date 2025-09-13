// ui-utils.ts
import { BrowserWindow, contextBridge, ipcRenderer } from 'electron';
import { assetPath } from './path-utils';
import { IUiApi } from './types/electron-api.d';

// Main Process helper functions
export function showLoadingPage(window: BrowserWindow) {
  console.log(assetPath('static', 'loading.html'))
  window.loadFile(assetPath('static', 'loading.html'));
}

export function showErrorPage(window: BrowserWindow, error: string, retryAvailable = true) {
  window.loadFile(assetPath('static', 'error.html')).then(() => {
    // Send a message to the renderer to update the specific error content
    window.webContents.send(IPC_CHANNELS.SET_ERROR_MESSAGE, { error, retryAvailable });
  });
}

export function showCrashPage(window: BrowserWindow, error: string) {
  window.loadFile(assetPath('static', 'error.html')).then(() => {
    // Send a message to the renderer to update the specific error content
    window.webContents.send(IPC_CHANNELS.R_PROCESS_CRASHED, error)
  });
}

// IPC Channel definitions
export const IPC_CHANNELS = {
  RETRY_START_SHINY: 'retry-start-shiny',
  SET_ERROR_MESSAGE: 'set-error-message', // Already used for showing general errors
  SET_LOADING_MESSAGE: 'set-loading-message',
  // Add a specific channel for R process crashes if you want distinct handling
  // or reuse SET_ERROR_MESSAGE as you are currently doing for general errors.
  // For distinct handling:
  R_PROCESS_CRASHED: 'r-process-crashed',
  GET_VERSION: 'get-version',
};

// Preload script functionality
export function exposeUiApi() {
  const uiApi: IUiApi = {
    retry: async () =>  await ipcRenderer.invoke(IPC_CHANNELS.RETRY_START_SHINY)
    // You might also expose a way to set loading messages if needed from renderer
    // setLoadingMessage: (msg: string) => ipcRenderer.send(IPC_CHANNELS.SET_LOADING_MESSAGE, msg),
  };

  // Expose the API to the renderer process
  contextBridge.exposeInMainWorld('uiApi', uiApi);
}

// Renderer script functionality
export function registerUiListeners(onRetry: () => void) {
  // Listener for general error messages sent from the main process
  ipcRenderer.on(IPC_CHANNELS.SET_ERROR_MESSAGE, (event, { error, retryAvailable }) => {
    const errorMessageElement = document.getElementById('error-message');
    if (errorMessageElement) {
        errorMessageElement.innerText = error;
    }

    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      if (retryAvailable) {
        retryButton.style.display = 'block';
      } else {
        retryButton.style.display = 'none';
      }
    }
  });

  // Listener for R process crashed specifically (if using a distinct channel)
  // If you want separate logic for R crashes vs. general errors, use this.
  // Otherwise, the existing SET_ERROR_MESSAGE listener can handle it.
  ipcRenderer.on(IPC_CHANNELS.R_PROCESS_CRASHED, (event, message) => {
    // This could trigger a specific R crash UI state,
    // or simply call showErrorPage equivalent logic in the renderer.
    console.error("Renderer received R process crash:", message);
    const errorMessageElement = document.getElementById('error-message');
    if (errorMessageElement) {
        errorMessageElement.innerText = message; // Update message
    }
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
        retryButton.style.display = 'block'; // Show retry button
    }
  });

  // Event listener for the retry button click
  document.getElementById('retry-button')?.addEventListener('click', onRetry);
}
