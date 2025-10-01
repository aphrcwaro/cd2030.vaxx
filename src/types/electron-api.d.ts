// This file will provide type declarations for the API exposed by the preload script.
export interface IUiApi {
  retry: () => Promise<string>; // Assuming retry returns a promise that resolves to a string
  pickFile: (opts) => Promise<string>; // Assuming pickFile returns a promise that resolves to a string 
}

declare global {
  interface Window {
    uiApi: IUiApi;
  }
}
