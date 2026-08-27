import type { HostToWebviewMessage, WebviewToHostMessage } from '../src/models/types';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    try {
      api = acquireVsCodeApi();
    } catch {
      api = {
        postMessage: () => undefined,
        getState: () => undefined,
        setState: () => undefined,
      };
    }
  }
  return api;
}

export function post(message: WebviewToHostMessage): void {
  getVsCodeApi().postMessage(message);
}

export function onHostMessage(handler: (msg: HostToWebviewMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data as HostToWebviewMessage);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
