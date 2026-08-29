/**
 * Marketplace screenshots: ResX Guard inside a Cursor-like IDE chrome.
 * Usage: node scripts/capture-screenshots.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const media = path.join(root, 'media');
const css = fs.readFileSync(path.join(root, 'webview', 'styles.css'), 'utf8');

const W = 1440;
const H = 820;

function chromeCandidates() {
  const fromEnv = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return [
    fromEnv,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/local/bin/google-chrome',
  ].filter(Boolean);
}

async function launchBrowser() {
  const args = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'];
  for (const executablePath of chromeCandidates()) {
    if (!fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, args });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ args });
}

/** Cursor Dark–inspired tokens (Anysphere / Cursor default dark). */
const CURSOR_VARS = `
:root {
  --vscode-font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  --vscode-font-size: 12px;
  --vscode-foreground: #e6e6e6;
  --vscode-editor-background: #141414;
  --vscode-sideBar-background: #181818;
  --vscode-panel-border: rgba(255,255,255,0.08);
  --vscode-focusBorder: #81a1c1;
  --vscode-button-background: #2b2b2b;
  --vscode-button-foreground: #e6e6e6;
  --vscode-input-background: #1f1f1f;
  --vscode-input-foreground: #e6e6e6;
  --vscode-input-border: #2a2a2a;
  --vscode-list-hoverBackground: rgba(255,255,255,0.05);
  --vscode-list-activeSelectionBackground: rgba(129,161,193,0.28);
  --vscode-list-activeSelectionForeground: #fff;
  --vscode-badge-background: #333;
  --vscode-badge-foreground: #e6e6e6;
  --vscode-toolbar-hoverBackground: rgba(255,255,255,0.07);
  --vscode-textBlockQuote-background: rgba(255,255,255,0.04);
  --vscode-textLink-foreground: #81a1c1;
  --vscode-errorForeground: #ff7b72;
  --vscode-dropdown-background: #1c1c1c;
  --vscode-editorWidget-background: #1c1c1c;
  --vscode-widget-border: rgba(255,255,255,0.1);
  --cursor-bg: #141414;
  --cursor-title: #181818;
  --cursor-activity: #121212;
  --cursor-border: rgba(255,255,255,0.08);
  --cursor-muted: #8b8b8b;
  --cursor-accent: #81a1c1;
}
`;

const IDE_CHROME = `
* { box-sizing: border-box; }
html, body {
  width: ${W}px;
  height: ${H}px;
  margin: 0;
  overflow: hidden;
  background: #0c0c0c;
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  color: #e6e6e6;
}
.ide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--cursor-bg);
  border: 1px solid var(--cursor-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.55);
}
.titlebar {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: var(--cursor-title);
  border-bottom: 1px solid var(--cursor-border);
}
.traffic { display: flex; gap: 6px; }
.traffic i { width: 10px; height: 10px; border-radius: 50%; display: block; }
.traffic .r { background: #ff5f57; }
.traffic .y { background: #febc2e; }
.traffic .g { background: #28c840; }
.titlebar-label {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--cursor-muted);
  letter-spacing: 0.01em;
}
.workbench {
  flex: 1;
  min-height: 0;
  display: flex;
}
.activity {
  width: 44px;
  flex-shrink: 0;
  background: var(--cursor-activity);
  border-right: 1px solid var(--cursor-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  gap: 10px;
}
.activity .ico {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--cursor-muted);
  font-size: 13px;
}
.activity .ico.active {
  color: #fff;
  background: rgba(129,161,193,0.18);
  box-shadow: inset 2px 0 0 var(--cursor-accent);
}
.explorer {
  width: 220px;
  flex-shrink: 0;
  background: #181818;
  border-right: 1px solid var(--cursor-border);
  padding: 8px 0;
  font-size: 11px;
}
.explorer .head {
  padding: 4px 12px 8px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cursor-muted);
  font-weight: 600;
}
.explorer .row {
  padding: 3px 12px 3px 18px;
  color: #c8c8c8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.explorer .row.folder { padding-left: 12px; color: #ddd; }
.explorer .row.active {
  background: rgba(129,161,193,0.16);
  color: #fff;
}
.editor-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #141414;
}
.tabs-bar {
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--cursor-border);
  background: #181818;
}
.editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  font-size: 11px;
  color: var(--cursor-muted);
  border-right: 1px solid var(--cursor-border);
}
.editor-tab.active {
  background: #141414;
  color: #fff;
  border-top: 1px solid transparent;
}
.panel-host {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.statusbar {
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  font-size: 10px;
  color: #b5b5b5;
  background: #1a1a1a;
  border-top: 1px solid var(--cursor-border);
}
.statusbar span { opacity: 0.85; }
.app { height: 100%; min-height: 0; }
.shot-inner { height: 100%; min-height: 0; display: flex; flex-direction: column; }
`;

function ideShell(panelHtml, { title = 'ResX Guard — sample-project' } = {}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${CURSOR_VARS}
${css}
${IDE_CHROME}
</style>
</head>
<body>
<div class="ide">
  <div class="titlebar">
    <div class="traffic"><i class="r"></i><i class="y"></i><i class="g"></i></div>
    <div class="titlebar-label">${title}</div>
  </div>
  <div class="workbench">
    <nav class="activity" aria-label="Activity Bar">
      <div class="ico" title="Explorer">⧉</div>
      <div class="ico" title="Search">⌕</div>
      <div class="ico" title="Source Control">⎇</div>
      <div class="ico active" title="ResX Guard">▣</div>
      <div class="ico" title="Extensions">▦</div>
    </nav>
    <aside class="explorer">
      <div class="head">Explorer</div>
      <div class="row folder">▾ sample-project</div>
      <div class="row"> Properties</div>
      <div class="row">  Resources.resx</div>
      <div class="row">  Resources.pt.resx</div>
      <div class="row"> Resources</div>
      <div class="row">  Messages.resx</div>
      <div class="row active"> ResX Guard</div>
    </aside>
    <div class="editor-col">
      <div class="tabs-bar">
        <div class="editor-tab active">ResX Guard</div>
        <div class="editor-tab">Resources.resx</div>
        <div class="editor-tab">Program.cs</div>
      </div>
      <div class="panel-host">
        ${panelHtml}
      </div>
      <div class="statusbar">
        <span>main*</span>
        <span>ResX Guard · Neutral + pt · Cursor Dark</span>
        <span>UTF-8  ·  CRLF  ·  C#</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

const gridPanel = `
<div class="app shot-inner">
  <div class="tabs">
    <button class="tab active" type="button">Main</button>
    <button class="tab" type="button">Settings</button>
    <button class="tab" type="button">About</button>
  </div>
  <div class="main-layout">
    <aside class="sidebar" style="width:168px;flex:0 0 168px">
      <div class="section-title">Files</div>
      <div class="tree-node">
        <div class="tree-row">
          <button class="tree-twistie" type="button">▾</button>
          <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">SampleProject</span></label>
        </div>
        <div class="tree-children">
          <div class="tree-node"><div class="tree-row"><span class="tree-twistie spacer"></span>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label></div></div>
          <div class="tree-node"><div class="tree-row"><span class="tree-twistie spacer"></span>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Resources/Messages</span></label></div></div>
        </div>
      </div>
    </aside>
    <section class="center">
      <div class="toolbar">
        <button class="btn" type="button"><span class="btn-icon">＋</span>Add</button>
        <button class="btn" type="button"><span class="btn-icon">⌫</span>Delete</button>
        <button class="btn" type="button"><span class="btn-icon">⇧</span>Export</button>
        <div class="toolbar-spacer"></div>
        <button class="btn" type="button"><span class="btn-icon">▦</span>Columns</button>
        <button class="btn active" type="button"><span class="btn-icon">ⓘ</span>Summary</button>
      </div>
      <div class="workspace">
        <div class="grid-area">
          <div class="grid-wrap" style="height:100%;overflow:auto">
            <div style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;position:sticky;top:0;z-index:2;background:#141414;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div class="grid-th" style="padding:6px 8px">Key</div>
              <div class="grid-th" style="padding:6px 8px">Issues</div>
              <div class="grid-th" style="padding:6px 8px">Neutral</div>
              <div class="grid-th" style="padding:6px 8px">pt</div>
              <div class="grid-th" style="padding:6px 8px">es</div>
            </div>
            <div class="grid-group" style="height:26px"><span class="grid-group-label">Properties/Resources</span><span class="grid-group-count">4</span></div>
            <div class="grid-row row-selected" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Welcome</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--matchingSuffix"><span class="issue-chip-label">Suffix</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Welcome</textarea></div>
              <div class="grid-cell has-issue issue-rule--matchingSuffix"><textarea class="cell-textarea" readonly>Bem-vindo</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Bienvenido</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>SaveFailed</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Save failed.</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Falha ao guardar.</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Error al guardar.</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>HelloName</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--placeholders"><span class="issue-chip-label">Placeholders</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Hello {0}</textarea></div>
              <div class="grid-cell has-issue issue-rule--placeholders"><textarea class="cell-textarea" readonly>Olá {1}</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Hola {0}</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Cancel</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Cancel</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Cancelar</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Cancelar</textarea></div>
            </div>
            <div class="grid-group" style="height:26px"><span class="grid-group-label">Resources/Messages</span><span class="grid-group-count">2</span></div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Confirm</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Are you sure?</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Tem a certeza?</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>¿Está seguro?</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Loading</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--missingTranslation"><span class="issue-chip-label">Missing</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Loading…</textarea></div>
              <div class="grid-cell has-issue issue-rule--missingTranslation"><textarea class="cell-textarea" readonly></textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Cargando…</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Retry</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Try again</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Tentar de novo</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Intentar de nuevo</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>NetworkError</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--matchingSuffix"><span class="issue-chip-label">Suffix</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Network error.</textarea></div>
              <div class="grid-cell has-issue issue-rule--matchingSuffix"><textarea class="cell-textarea" readonly>Erro de rede</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Error de red.</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>EmptyCart</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Your cart is empty</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>O carrinho está vazio</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Tu carrito está vacío</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:150px 84px 200px 200px 180px;height:36px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>CheckoutTitle</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Checkout</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Finalizar compra</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Pagar</textarea></div>
            </div>
          </div>
        </div>
        <aside class="summary-panel" style="width:220px;flex:0 0 220px;min-width:0">
          <div class="summary-panel-header"><span>Summary</span><button class="icon-btn" type="button">×</button></div>
          <div class="summary-body">
            <div class="summary-block"><div class="summary-key">Welcome</div></div>
            <div class="summary-block">
              <div class="section-title">All languages</div>
              <div class="summary-locale-grid">
                <div class="summary-locale-card"><div class="label">Neutral</div><div class="value">Welcome</div></div>
                <div class="summary-locale-card"><div class="label">pt</div><div class="value">Bem-vindo</div></div>
                <div class="summary-locale-card"><div class="label">es</div><div class="value">Bienvenido</div></div>
              </div>
            </div>
            <div class="summary-block">
              <div class="section-title">Issues</div>
              <ul class="issue-list">
                <li class="issue-item issue-rule--matchingSuffix">
                  <div class="issue-item-tag">Suffix</div>
                  <div class="issue-item-message">Ending does not match neutral for pt</div>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </div>
</div>`;

const excelPanel = `
<div class="app shot-inner">
  <div class="tabs">
    <button class="tab active" type="button">Main</button>
    <button class="tab" type="button">Settings</button>
    <button class="tab" type="button">About</button>
  </div>
  <div class="main-layout">
    <aside class="sidebar" style="width:160px;flex:0 0 160px">
      <div class="section-title">Files</div>
      <div class="tree-node">
        <div class="tree-row">
          <button class="tree-twistie" type="button">▾</button>
          <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Shop</span></label>
        </div>
        <div class="tree-children">
          <div class="tree-node"><div class="tree-row"><span class="tree-twistie spacer"></span>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label></div></div>
          <div class="tree-node"><div class="tree-row"><span class="tree-twistie spacer"></span>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Features/Checkout</span></label></div></div>
        </div>
      </div>
    </aside>
    <section class="center">
      <div class="toolbar">
        <button class="btn" type="button"><span class="btn-icon">＋</span>Add</button>
        <button class="btn" type="button"><span class="btn-icon">⌫</span>Delete</button>
        <button class="btn active" type="button"><span class="btn-icon">⇧</span>Export ▾</button>
        <button class="btn" type="button"><span class="btn-icon">⇩</span>Import</button>
        <div class="toolbar-spacer"></div>
        <button class="btn" type="button"><span class="btn-icon">▦</span>Columns</button>
        <button class="btn" type="button"><span class="btn-icon">ⓘ</span>Summary</button>
      </div>
      <div class="workspace">
        <div class="grid-area" style="padding:28px 40px;overflow:auto">
          <h2 style="margin:0 0 6px;font-size:18px;font-weight:650">Excel import / export</h2>
          <p style="opacity:0.7;line-height:1.5;margin:0 0 16px;max-width:560px;font-size:12px">
            Round-trip selected families through <code>.xlsx</code> / <code>.xls</code>. Empty cells on import leave existing translations unchanged.
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:720px">
            <div class="setting-card">
              <div class="setting-card-head"><h3>Export</h3><p>Resource, Key, Comment, Neutral + every locale for checked families.</p></div>
            </div>
            <div class="setting-card">
              <div class="setting-card-head"><h3>Import</h3><p>Matches families by name, maps PT→pt, creates missing satellites.</p></div>
            </div>
          </div>
          <div class="grid-wrap" style="margin-top:18px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;max-width:720px">
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr;background:#181818;font-size:10px;opacity:0.75">
              <div style="padding:8px">Resource</div><div style="padding:8px">Key</div><div style="padding:8px">Neutral</div><div style="padding:8px">pt</div><div style="padding:8px">es</div>
            </div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr;font-size:11px;border-top:1px solid rgba(255,255,255,0.06)">
              <div style="padding:8px">Properties/Resources</div><div style="padding:8px">Welcome</div><div style="padding:8px">Welcome</div><div style="padding:8px">Bem-vindo</div><div style="padding:8px">Bienvenido</div>
            </div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr;font-size:11px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
              <div style="padding:8px">Properties/Resources</div><div style="padding:8px">SaveFailed</div><div style="padding:8px">Save failed.</div><div style="padding:8px">Falha ao guardar.</div><div style="padding:8px">Error al guardar.</div>
            </div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr;font-size:11px;border-top:1px solid rgba(255,255,255,0.06)">
              <div style="padding:8px">Features/Checkout</div><div style="padding:8px">PayNow</div><div style="padding:8px">Pay now</div><div style="padding:8px">Pagar agora</div><div style="padding:8px">Pagar ahora</div>
            </div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1.4fr 1fr 1fr;font-size:11px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
              <div style="padding:8px">Features/Checkout</div><div style="padding:8px">EmptyCart</div><div style="padding:8px">Your cart is empty</div><div style="padding:8px">O carrinho está vazio</div><div style="padding:8px">Tu carrito está vacío</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>`;

const validationPanel = `
<div class="app shot-inner">
  <div class="tabs">
    <button class="tab active" type="button">Main</button>
    <button class="tab" type="button">Settings</button>
    <button class="tab" type="button">About</button>
  </div>
  <div class="main-layout">
    <aside class="sidebar" style="width:160px;flex:0 0 160px">
      <div class="section-title">Files</div>
      <div class="tree-node">
        <div class="tree-row"><span class="tree-twistie spacer"></span>
          <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label></div>
      </div>
    </aside>
    <section class="center">
      <div class="toolbar">
        <button class="btn" type="button"><span class="btn-icon">＋</span>Add</button>
        <div class="toolbar-spacer"></div>
        <button class="btn active" type="button"><span class="btn-icon">ⓘ</span>Summary</button>
      </div>
      <div class="workspace">
        <div class="grid-area">
          <div class="grid-wrap" style="height:100%;overflow:auto">
            <div style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;position:sticky;top:0;background:#141414;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div class="grid-th" style="padding:6px 8px">Key</div>
              <div class="grid-th" style="padding:6px 8px">Issues</div>
              <div class="grid-th" style="padding:6px 8px">Neutral</div>
              <div class="grid-th" style="padding:6px 8px">pt</div>
              <div class="grid-th" style="padding:6px 8px">es</div>
            </div>
            <div class="grid-row row-selected" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>wrong_key</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips">
                <span class="issue-chip issue-rule--keyPascalCase"><span class="issue-chip-label">Naming</span></span>
                <span class="issue-chip issue-rule--missingTranslation"><span class="issue-chip-label">Missing</span></span>
              </div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Save now</textarea></div>
              <div class="grid-cell has-issue issue-rule--missingTranslation"><textarea class="cell-textarea" readonly></textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Guardar ahora</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>HelloName</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--placeholders"><span class="issue-chip-label">Placeholders</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Hello {0}</textarea></div>
              <div class="grid-cell has-issue issue-rule--placeholders"><textarea class="cell-textarea" readonly>Olá {name}</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Hola {0}</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Confirm</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Are you sure?</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Tem a certeza?</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>¿Está seguro?</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>RetryAction</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Retry</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Repetir</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Reintentar</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>Offline</textarea></div>
              <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--missingTranslation"><span class="issue-chip-label">Missing</span></span></div></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>You are offline</textarea></div>
              <div class="grid-cell has-issue issue-rule--missingTranslation"><textarea class="cell-textarea" readonly></textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Estás sin conexión</textarea></div>
            </div>
            <div class="grid-row" style="display:grid;grid-template-columns:140px 120px 220px 220px 200px;height:42px">
              <div class="grid-cell key"><textarea class="cell-textarea" readonly>PayNow</textarea></div>
              <div class="grid-cell issues"><span class="issue-empty">—</span></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Pay now</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Pagar agora</textarea></div>
              <div class="grid-cell"><textarea class="cell-textarea" readonly>Pagar ahora</textarea></div>
            </div>
          </div>
        </div>
        <aside class="summary-panel" style="width:240px;flex:0 0 240px;min-width:0">
          <div class="summary-panel-header"><span>Summary</span></div>
          <div class="summary-body">
            <div class="summary-block"><div class="summary-key">wrong_key</div></div>
            <div class="summary-block">
              <div class="section-title">Issues</div>
              <ul class="issue-list">
                <li class="issue-item issue-rule--keyPascalCase">
                  <div class="issue-item-tag">Naming</div>
                  <div class="issue-item-message">Key should be PascalCase of neutral value: expected "SaveNow"</div>
                </li>
                <li class="issue-item issue-rule--missingTranslation">
                  <div class="issue-item-tag">Missing</div>
                  <div class="issue-item-message">Missing translation for pt</div>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </div>
</div>`;

const shots = [
  { name: 'screenshot-grid.png', html: ideShell(gridPanel), title: 'Grid + Summary' },
  { name: 'screenshot-excel.png', html: ideShell(excelPanel, { title: 'ResX Guard — Excel round-trip' }), title: 'Excel' },
  { name: 'screenshot-validation.png', html: ideShell(validationPanel, { title: 'ResX Guard — validation' }), title: 'Validation' },
];

const browser = await launchBrowser();
try {
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: W, height: H },
      deviceScaleFactor: 1,
    });
    await page.setContent(shot.html, { waitUntil: 'load' });
    const out = path.join(media, shot.name);
    await page.locator('.ide').screenshot({ path: out, type: 'png' });
    await page.close();
    console.log('wrote', out, `(${shot.title})`);
  }
} finally {
  await browser.close();
}

// Keep About-page copies in sync
const webviewMedia = path.join(root, 'webview', 'media');
fs.mkdirSync(webviewMedia, { recursive: true });
for (const shot of shots) {
  fs.copyFileSync(path.join(media, shot.name), path.join(webviewMedia, shot.name));
}
console.log('synced webview/media');
