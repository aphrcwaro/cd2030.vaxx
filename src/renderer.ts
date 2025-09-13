import { registerUiListeners } from './ui-utils'; // Assuming this exists and expects a function

document.addEventListener('DOMContentLoaded', async () => {
  // TypeScript now understands `window.uiApi.retry` is a function that returns a Promise<string>
  registerUiListeners(window.uiApi.retry);

  // Example usage
  try {
    const result = await window.uiApi.retry();
    console.log('Renderer received:', result);
  } catch (error) {
    console.error('Renderer error during retry:', error);
  }
});