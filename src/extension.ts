import * as vscode from 'vscode';
import { ResourceIndex } from './services/resource-index';
import { ResxGuardPanel, ResxGuardSidebarProvider } from './panel/resx-guard-panel';

let index: ResourceIndex | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const diagnostics = vscode.languages.createDiagnosticCollection('resxGuard');
  context.subscriptions.push(diagnostics);

  index = new ResourceIndex(context, diagnostics);
  await index.initialize();

  const openPanel = () => {
    if (!index) {
      return;
    }
    ResxGuardPanel.show(context.extensionUri, index);
  };

  const refresh = async () => {
    if (!index) {
      return;
    }
    await index.refresh();
    ResxGuardPanel.current?.postSnapshot();
    void vscode.window.setStatusBarMessage('ResX Guard: refreshed', 2000);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('resxGuard.open', openPanel),
    vscode.commands.registerCommand('resxGuard.refresh', () => {
      void refresh();
    })
  );

  const sidebar = new ResxGuardSidebarProvider(context.extensionUri, openPanel);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('resxGuard.sidebar', sidebar)
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.resx');
  context.subscriptions.push(watcher);

  watcher.onDidChange((uri) => {
    void index?.refreshFile(uri.fsPath);
  });
  watcher.onDidCreate((uri) => {
    void index?.refreshFile(uri.fsPath);
  });
  watcher.onDidDelete((uri) => {
    void index?.removeFile(uri.fsPath);
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('resxGuard')) {
        index?.reloadSettingsFromConfig();
        ResxGuardPanel.current?.postSnapshot();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refresh();
    })
  );

  // Open the manager automatically in Extension Development / first use with .resx files
  const snap = index.getSnapshot(vscode.env.language.startsWith('pt') ? 'pt' : 'en');
  if (snap.families.length > 0) {
    openPanel();
  } else {
    void vscode.window.showInformationMessage(
      'ResX Guard is active. Open a folder with .resx files, then run “ResX Guard: Open”.',
      'Open'
    ).then((choice) => {
      if (choice === 'Open') {
        openPanel();
      }
    });
  }
}

export function deactivate(): void {
  ResxGuardPanel.current?.dispose();
  index = undefined;
}
