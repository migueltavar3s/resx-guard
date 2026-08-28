import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../models/types';
import type { ResourceIndex } from '../services/resource-index';
import { workbookBuffer } from '../services/excel-io';

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
        case 'exportExcel':
          await this.exportExcel();
          break;
        case 'importExcel':
          await this.importExcel();
          break;
        case 'openUrl':
          await this.openUrl(msg.url);
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg: HostToWebviewMessage = { type: 'error', message };
      void this.panel.webview.postMessage(errorMsg);
      void vscode.window.showErrorMessage(`ResX Guard: ${message}`);
    }
  }

  private async exportExcel(): Promise<void> {
    const pt = vscode.env.language.startsWith('pt');
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('translations.xlsx'),
      filters: {
        Excel: ['xlsx', 'xls'],
      },
      saveLabel: pt ? 'Exportar' : 'Export',
    });
    if (!uri) {
      return;
    }
    const bookType = uri.fsPath.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx';
    const payload = this.index.getExcelPayload();
    if (payload.rows.length === 0) {
      void vscode.window.showWarningMessage(
        pt ? 'Não há traduções selecionadas para exportar.' : 'No translations selected to export.'
      );
      return;
    }
    const buffer = workbookBuffer(payload, bookType);
    await fsPromises.writeFile(uri.fsPath, buffer);
    void vscode.window.showInformationMessage(
      pt
        ? `Exportadas ${payload.rows.length} keys para Excel.`
        : `Exported ${payload.rows.length} keys to Excel.`
    );
  }

  private async importExcel(): Promise<void> {
    const pt = vscode.env.language.startsWith('pt');
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        Excel: ['xlsx', 'xls'],
      },
      openLabel: pt ? 'Importar' : 'Import',
    });
    const uri = picked?.[0];
    if (!uri) {
      return;
    }
    const buffer = await fsPromises.readFile(uri.fsPath);
    const result = await this.index.importExcelBuffer(buffer);
    void vscode.window.showInformationMessage(
      pt
        ? `Importação concluída: ${result.created} novas, ${result.updated} atualizadas, ${result.skipped} ignoradas.`
        : `Import finished: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`
    );
  }

  private async openUrl(raw: string): Promise<void> {
    let parsed: vscode.Uri;
    try {
      parsed = vscode.Uri.parse(raw, true);
    } catch {
      return;
    }
    if (parsed.scheme !== 'https' || parsed.authority.toLowerCase() !== 'github.com') {
      return;
    }
    await vscode.env.openExternal(parsed);
  }

  private getHtml(webview: vscode.Webview): string {
    const assetsDir = vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets');
    const assetsPath = assetsDir.fsPath;

    let scriptName = 'index.js';
    let styleName = 'index.css';
    try {
      const files = fs.readdirSync(assetsPath);
      scriptName = files.find((f) => f.endsWith('.js')) ?? scriptName;
      styleName = files.find((f) => f.endsWith('.css')) ?? styleName;
    } catch {
      // fall back to conventional names
    }

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, scriptName));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, styleName));
    const nonce = getNonce();

    // VS Code webviews need cspSource on script-src; avoid type="module" (IIFE build).
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>ResX Guard</title>
</head>
<body>
  <div id="root">
    <p style="font-family: var(--vscode-font-family); padding: 16px; opacity: 0.7;">
      Loading ResX Guard…
    </p>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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
    private readonly onOpen: () => void
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    const nonce = getNonce();
    const webview = webviewView.webview;
    webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
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
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('open').addEventListener('click', () => vscode.postMessage({ type: 'open' }));
  </script>
</body>
</html>`;

    webview.onDidReceiveMessage((msg: { type: string }) => {
      if (msg.type === 'open') {
        this.onOpen();
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
