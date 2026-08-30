import type { HostToWebviewMessage, WebviewToHostMessage } from '@resx-guard/core-ts';

export interface HostBridge {
  post(msg: WebviewToHostMessage): void;
  onMessage(cb: (msg: HostToWebviewMessage) => void): () => void;
}

let bridge: HostBridge | undefined;

export function setHostBridge(b: HostBridge): void {
  bridge = b;
}

export function getHostBridge(): HostBridge {
  if (!bridge) {
    throw new Error('Host bridge not initialized');
  }
  return bridge;
}

export function post(message: WebviewToHostMessage): void {
  getHostBridge().post(message);
}

export function onHostMessage(handler: (msg: HostToWebviewMessage) => void): () => void {
  return getHostBridge().onMessage(handler);
}
