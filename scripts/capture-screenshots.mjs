/**
 * Renders Marketplace screenshots of the ResX Guard UI using real CSS.
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
  const args = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'];
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

function shell(body, { width = 1280, height = 760 } = {}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
:root {
  --vscode-font-family: "Segoe UI", system-ui, sans-serif;
  --vscode-font-size: 13px;
  --vscode-foreground: #cccccc;
  --vscode-editor-background: #1e1e1e;
  --vscode-sideBar-background: #252526;
  --vscode-panel-border: rgba(128,128,128,0.35);
  --vscode-focusBorder: #007fd4;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #fff;
  --vscode-input-background: #3c3c3c;
  --vscode-input-foreground: #cccccc;
  --vscode-input-border: #3c3c3c;
  --vscode-list-hoverBackground: rgba(255,255,255,0.06);
  --vscode-list-activeSelectionBackground: rgba(0,127,212,0.28);
  --vscode-list-activeSelectionForeground: #fff;
  --vscode-badge-background: #4d4d4d;
  --vscode-badge-foreground: #fff;
  --vscode-toolbar-hoverBackground: rgba(255,255,255,0.08);
  --vscode-textBlockQuote-background: rgba(128,128,128,0.12);
  --vscode-textLink-foreground: #3794ff;
  --vscode-errorForeground: #f14c4c;
  --vscode-dropdown-background: #252526;
  --vscode-editorWidget-background: #252526;
  --vscode-widget-border: rgba(128,128,128,0.4);
}
${css}
html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; }
body { background: #1e1e1e; }
.app { height: 100%; }
.shot-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid rgba(128,128,128,0.25);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0,0,0,0.45);
}
</style>
</head>
<body>
<div class="shot-frame">
${body}
</div>
</body>
</html>`;
}

const gridShot = shell(`
  <div class="app">
    <div class="tabs">
      <button class="tab active" type="button">Main</button>
      <button class="tab" type="button">Settings</button>
      <button class="tab" type="button">About</button>
    </div>
    <div class="main-layout">
      <aside class="sidebar" style="width:196px;flex:0 0 196px">
        <div class="section-title">Files</div>
        <div class="tree-node">
          <div class="tree-row">
            <button class="tree-twistie" type="button">▾</button>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">SampleProject</span></label>
          </div>
          <div class="tree-children">
            <div class="tree-node">
              <div class="tree-row">
                <span class="tree-twistie spacer"></span>
                <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label>
              </div>
            </div>
            <div class="tree-node">
              <div class="tree-row">
                <span class="tree-twistie spacer"></span>
                <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Resources/Messages</span></label>
              </div>
            </div>
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
              <div style="display:grid;grid-template-columns:180px 92px 220px 220px;position:sticky;top:0;z-index:2;background:#1e1e1e;border-bottom:1px solid rgba(128,128,128,0.28)">
                <div class="grid-th" style="padding:8px">Key</div>
                <div class="grid-th" style="padding:8px">Issues</div>
                <div class="grid-th" style="padding:8px">Neutral</div>
                <div class="grid-th" style="padding:8px">pt</div>
              </div>
              <div class="grid-group" style="height:28px"><span class="grid-group-label">Properties/Resources</span><span class="grid-group-count">3</span></div>
              <div class="grid-row row-selected" style="display:grid;grid-template-columns:180px 92px 220px 220px;height:40px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>Welcome</textarea></div>
                <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--matchingSuffix"><span class="issue-chip-label">Suffix</span></span></div></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Welcome</textarea></div>
                <div class="grid-cell has-issue issue-rule--matchingSuffix"><textarea class="cell-textarea" readonly>Bem-vindo</textarea></div>
              </div>
              <div class="grid-row" style="display:grid;grid-template-columns:180px 92px 220px 220px;height:40px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>SaveFailed</textarea></div>
                <div class="grid-cell issues"><span class="issue-empty">—</span></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Save failed.</textarea></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Falha ao guardar.</textarea></div>
              </div>
              <div class="grid-row" style="display:grid;grid-template-columns:180px 92px 220px 220px;height:40px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>HelloName</textarea></div>
                <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--placeholders"><span class="issue-chip-label">Placeholders</span></span></div></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Hello {0}</textarea></div>
                <div class="grid-cell has-issue issue-rule--placeholders"><textarea class="cell-textarea" readonly>Olá {1}</textarea></div>
              </div>
              <div class="grid-group" style="height:28px"><span class="grid-group-label">Resources/Messages</span><span class="grid-group-count">2</span></div>
              <div class="grid-row" style="display:grid;grid-template-columns:180px 92px 220px 220px;height:40px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>Confirm</textarea></div>
                <div class="grid-cell issues"><span class="issue-empty">—</span></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Are you sure?</textarea></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Tem a certeza?</textarea></div>
              </div>
            </div>
          </div>
          <aside class="summary-panel" style="width:260px;flex:0 0 260px;min-width:0">
            <div class="summary-panel-header"><span>Summary</span><button class="icon-btn" type="button">×</button></div>
            <div class="summary-body">
              <div class="summary-block">
                <div class="summary-key">Welcome</div>
              </div>
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
  </div>
`);

const excelShot = shell(`
  <div class="app">
    <div class="tabs">
      <button class="tab active" type="button">Main</button>
      <button class="tab" type="button">Settings</button>
      <button class="tab" type="button">About</button>
    </div>
    <div class="main-layout">
      <aside class="sidebar" style="width:180px;flex:0 0 180px">
        <div class="section-title">Files</div>
        <div class="tree-node">
          <div class="tree-row">
            <button class="tree-twistie" type="button">▾</button>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Shop</span></label>
          </div>
          <div class="tree-children">
            <div class="tree-node">
              <div class="tree-row">
                <span class="tree-twistie spacer"></span>
                <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <section class="center">
        <div class="toolbar">
          <button class="btn" type="button"><span class="btn-icon">＋</span>Add</button>
          <button class="btn" type="button"><span class="btn-icon">⌫</span>Delete</button>
          <div class="excel-menu-wrap">
            <button class="btn excel-trigger active" type="button"><span class="btn-icon">⇧</span>Export<span class="excel-trigger-caret">▾</span></button>
          </div>
          <div class="toolbar-spacer"></div>
          <button class="btn" type="button"><span class="btn-icon">▦</span>Columns</button>
          <button class="btn" type="button"><span class="btn-icon">ⓘ</span>Summary</button>
        </div>
        <div class="workspace">
          <div class="grid-area">
            <div style="padding:28px 36px;max-width:640px">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:650">Excel import / export</h2>
              <p style="opacity:0.75;line-height:1.5;margin:0 0 18px">Round-trip selected families through <code>.xlsx</code> / <code>.xls</code>. Empty cells on import leave existing translations unchanged.</p>
              <div class="setting-card" style="margin-bottom:12px">
                <div class="setting-card-head"><h3>Export</h3><p>Writes Resource, Key, Comment, Neutral + every locale column for the checked families.</p></div>
              </div>
              <div class="setting-card">
                <div class="setting-card-head"><h3>Import</h3><p>Matches families by name, maps PT→pt, creates missing satellites, and skips empty keys.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
`, { width: 1100, height: 640 });

const validationShot = shell(`
  <div class="app">
    <div class="tabs">
      <button class="tab active" type="button">Main</button>
      <button class="tab" type="button">Settings</button>
      <button class="tab" type="button">About</button>
    </div>
    <div class="main-layout">
      <aside class="sidebar" style="width:180px;flex:0 0 180px">
        <div class="section-title">Files</div>
        <div class="tree-node">
          <div class="tree-row">
            <span class="tree-twistie spacer"></span>
            <label class="tree-label"><input type="checkbox" checked /><span class="tree-name">Properties/Resources</span></label>
          </div>
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
              <div style="display:grid;grid-template-columns:160px 110px 240px 240px;position:sticky;top:0;background:#1e1e1e;border-bottom:1px solid rgba(128,128,128,0.28)">
                <div class="grid-th" style="padding:8px">Key</div>
                <div class="grid-th" style="padding:8px">Issues</div>
                <div class="grid-th" style="padding:8px">Neutral</div>
                <div class="grid-th" style="padding:8px">pt</div>
              </div>
              <div class="grid-row row-selected" style="display:grid;grid-template-columns:160px 110px 240px 240px;height:48px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>wrong_key</textarea></div>
                <div class="grid-cell issues"><div class="issue-chips">
                  <span class="issue-chip issue-rule--keyPascalCase"><span class="issue-chip-label">Naming</span></span>
                  <span class="issue-chip issue-rule--missingTranslation"><span class="issue-chip-label">Missing</span></span>
                </div></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Save now</textarea></div>
                <div class="grid-cell has-issue issue-rule--missingTranslation"><textarea class="cell-textarea" readonly></textarea></div>
              </div>
              <div class="grid-row" style="display:grid;grid-template-columns:160px 110px 240px 240px;height:48px">
                <div class="grid-cell key"><textarea class="cell-textarea" readonly>HelloName</textarea></div>
                <div class="grid-cell issues"><div class="issue-chips"><span class="issue-chip issue-rule--placeholders"><span class="issue-chip-label">Placeholders</span></span></div></div>
                <div class="grid-cell"><textarea class="cell-textarea" readonly>Hello {0}</textarea></div>
                <div class="grid-cell has-issue issue-rule--placeholders"><textarea class="cell-textarea" readonly>Olá {name}</textarea></div>
              </div>
            </div>
          </div>
          <aside class="summary-panel" style="width:280px;flex:0 0 280px;min-width:0">
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
  </div>
`, { width: 1180, height: 680 });

const shots = [
  { name: 'screenshot-grid.png', html: gridShot, width: 1280, height: 760 },
  { name: 'screenshot-excel.png', html: excelShot, width: 1100, height: 640 },
  { name: 'screenshot-validation.png', html: validationShot, width: 1180, height: 680 },
];

const browser = await launchBrowser();
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    await page.setContent(shot.html, { waitUntil: 'load' });
    const out = path.join(media, shot.name);
    await page.screenshot({ path: out, type: 'png' });
    await page.close();
    console.log('wrote', out);
  }
} finally {
  await browser.close();
}
