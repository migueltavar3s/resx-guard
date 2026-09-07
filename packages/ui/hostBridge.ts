import type { HostToWebviewMessage, WebviewToHostMessage } from '@resx-guard/core-ts';
import { setHostBridge, type HostBridge } from './bridge';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/** VS Code webview bridge using acquireVsCodeApi(). */
export function initVsCodeBridge(): HostBridge {
  let api: VsCodeApi | undefined;

  const bridge: HostBridge = {
    post(message) {
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
      api.postMessage(message);
    },
    onMessage(handler) {
      const listener = (event: MessageEvent) => {
        handler(event.data as HostToWebviewMessage);
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };

  setHostBridge(bridge);
  return bridge;
}

/** Generic bridge for Visual Studio WebView2 (window.chrome.webview.postMessage). */
export function initWebView2Bridge(): HostBridge {
  const w = window as Window & {
    chrome?: { webview?: { postMessage: (msg: unknown) => void; addEventListener: (type: string, cb: (e: MessageEvent) => void) => void; removeEventListener: (type: string, cb: (e: MessageEvent) => void) => void } };
  };

  const bridge: HostBridge = {
    post(message) {
      w.chrome?.webview?.postMessage(message);
    },
    onMessage(handler) {
      const listener = (event: MessageEvent) => {
        handler(event.data as HostToWebviewMessage);
      };
      if (w.chrome?.webview) {
        w.chrome.webview.addEventListener('message', listener);
        return () => w.chrome!.webview!.removeEventListener('message', listener);
      }
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };

  setHostBridge(bridge);
  return bridge;
}

/** Detect host and initialize the appropriate bridge. */
export function initHostBridge(): HostBridge {
  const w = window as Window & { chrome?: { webview?: unknown } };
  if (w.chrome?.webview) {
    return initWebView2Bridge();
  }
  return initVsCodeBridge();
}
