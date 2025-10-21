import type { OpenDialogOptions } from 'electron';

export interface PickFileOptions {
  readonly accept?: string[];
  readonly multiple?: boolean;
}

export interface IUiApi {
  retry: () => Promise<string>;
  pickFile: (opts?: PickFileOptions & OpenDialogOptions) => Promise<string | string[] | null>;
}

declare global {
  interface Window {
    uiApi: IUiApi;
  }
}
