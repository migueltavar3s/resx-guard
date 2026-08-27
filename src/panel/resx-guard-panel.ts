import * as vscode from 'vscode';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../models/types';
import type { ResourceIndex } from '../services/resource-index';

export class ResxGuardPanel {
  public static current: ResxGuardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly index: ResourceIndex
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToHostMessage) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.disposables.push(
      this.index.onDidChange(() => {
        this.postSnapshot();
      })
    );
  }

  static show(extensionUri: vscode.Uri, index: ResourceIndex): ResxGuardPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ResxGuardPanel.current) {
      ResxGuardPanel.current.panel.reveal(column);
      ResxGuardPanel.current.postSnapshot();
      return ResxGuardPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'resxGuard',
      'ResX Guard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    ResxGuardPanel.current = new ResxGuardPanel(panel, extensionUri, index);
    return ResxGuardPanel.current;
  }

  postSnapshot(): void {
    const language = vscode.env.language.startsWith('pt') ? 'pt' : 'en';
    const msg: HostToWebviewMessage = {
      type: 'snapshot',
      payload: this.index.getSnapshot(language),
    };
    void this.panel.webview.postMessage(msg);
  }

  private async handleMessage(msg: WebviewToHostMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          this.postSnapshot();
          break;
        case 'refresh':
          await this.index.refresh();
          this.postSnapshot();
          break;
        case 'setSelectedFamilies':
          this.index.setSelectedFamilies(msg.familyIds);
          break;
        case 'setVisibleLocales':
          this.index.setVisibleLocales(msg.locales);
          break;
        case 'updateCell':
          await this.index.updateCell(msg.familyId, msg.key, msg.locale, msg.value);
          break;
        case 'updateComment':
          await this.index.updateComment(msg.familyId, msg.key, msg.comment);
          break;
        case 'addEntry':
          await this.index.addEntry(msg.familyId, msg.key, msg.neutralValue);
          break;
        case 'deleteEntry':
          await this.index.deleteEntry(msg.familyId, msg.key);
          break;
        case 'renameKey':
          await this.index.renameKey(msg.familyId, msg.oldKey, msg.newKey);
          break;
        case 'updateSettings':
          this.index.updateSettings(msg.settings);
          break;
        case 'openInEditor':
          await this.index.openInEditor(msg.familyId, msg.key, msg.locale);
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg: HostToWebviewMessage = { type: 'error', message };
      void this.panel.webview.postMessage(errorMsg);
      void vscode.window.showErrorMessage(`ResX Guard: ${message}`);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>ResX Guard</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    ResxGuardPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}

/** Lightweight sidebar webview that opens the main panel. */
export class ResxGuardSidebarProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onOpen: () => void,
    private readonly onRefresh: () => void
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 16px;
      margin: 0;
    }
    p { opacity: 0.85; line-height: 1.5; font-size: 13px; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 14px;
      border-radius: 2px;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      font-size: 13px;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    h2 { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
  </style>
</head>
<body>
  <h2>ResX Guard</h2>
  <p>Manage .resx translations in a fast spreadsheet-style grid.</p>
  <button id="open">Open Manager</button>
  <button id="refresh" class="secondary">Refresh workspace</button>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('open').addEventListener('click', () => vscode.postMessage({ type: 'open' }));
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  </script>
</body>
</html>`;

    webviewView.webview.onDidReceiveMessage((msg: { type: string }) => {
      if (msg.type === 'open') {
        this.onOpen();
      } else if (msg.type === 'refresh') {
        this.onRefresh();
      }
    });
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
