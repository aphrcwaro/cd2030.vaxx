// ui-utils.ts
import { BrowserWindow, ipcMain } from 'electron';
import { assetPath } from './path-utils.js';

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
  RETRY_START_SHINY: 'cd2030:retry-start-shiny',
  SET_ERROR_MESSAGE: 'cd2030:set-error-message', // Already used for showing general errors
  SET_LOADING_MESSAGE: 'cd2030:set-loading-message',
  // Add a specific channel for R process crashes if you want distinct handling
  // or reuse SET_ERROR_MESSAGE as you are currently doing for general errors.
  // For distinct handling:
  R_PROCESS_CRASHED: 'cd2030:r-process-crashed',
  PICK_FILE: 'cd2030:pick-file',
};

// Renderer script functionality
export function registerUiListeners(onRetry: () => void) {

  // Listener for general error messages sent from the main process
  ipcMain.on(IPC_CHANNELS.SET_ERROR_MESSAGE, (event, { error, retryAvailable }) => {
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
  ipcMain.on(IPC_CHANNELS.R_PROCESS_CRASHED, (event, message) => {
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
