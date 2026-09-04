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

  const usageWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{cs,cshtml,razor,vb,js,jsx,ts,tsx,html,aspx,ascx,master,vue}'
  );
  context.subscriptions.push(usageWatcher);

  let usageTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingUsage = new Set<string>();
  const scheduleUsageFile = (filePath: string) => {
    pendingUsage.add(filePath);
    if (usageTimer) {
      clearTimeout(usageTimer);
    }
    usageTimer = setTimeout(() => {
      const paths = [...pendingUsage];
      pendingUsage.clear();
      for (const p of paths) {
        void index?.refreshUsageFile(p);
      }
    }, 180);
  };

  let rescanTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRescan = () => {
    if (rescanTimer) {
      clearTimeout(rescanTimer);
    }
    rescanTimer = setTimeout(() => {
      void index?.refresh();
    }, 180);
  };
  context.subscriptions.push({
    dispose: () => {
      if (rescanTimer) {
        clearTimeout(rescanTimer);
      }
    },
  });

  watcher.onDidChange((uri) => {
    void index?.refreshFile(uri.fsPath);
  });
  watcher.onDidCreate(() => {
    scheduleRescan();
  });
  watcher.onDidDelete(() => {
    scheduleRescan();
  });

  usageWatcher.onDidChange((uri) => scheduleUsageFile(uri.fsPath));
  usageWatcher.onDidCreate((uri) => scheduleUsageFile(uri.fsPath));
  usageWatcher.onDidDelete((uri) => index?.removeUsageFile(uri.fsPath));

  const pendingUsageText = new Map<string, string>();
  let usageTextTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme !== 'file') {
        return;
      }
      pendingUsageText.set(e.document.uri.fsPath, e.document.getText());
      if (usageTextTimer) {
        clearTimeout(usageTextTimer);
      }
      usageTextTimer = setTimeout(() => {
        const entries = [...pendingUsageText.entries()];
        pendingUsageText.clear();
        for (const [filePath, text] of entries) {
          index?.refreshUsageText(filePath, text);
        }
      }, 180);
    })
  );

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
      void index?.scanUsageWorkspace();
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
