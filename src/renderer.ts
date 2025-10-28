import { registerUiListeners } from './ui-utils.js'; // Assuming this exists and expects a function

const uiApi = window.uiApi;

document.addEventListener('DOMContentLoaded', async () => {
  // TypeScript now understands `window.uiApi.retry` is a function that returns a Promise<string>
  registerUiListeners(uiApi.retry);

  // Example usage
  try {
    const result = await uiApi.retry();
    console.log('Renderer received:', result);
  } catch (error) {
    console.error('Renderer error during retry:', error);
  }
});
