import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser } from 'playwright-core';

const LONG = `Ohewefwehfjwehflwehfwehfwehfwefhwkefhwefwefwefwefwet${'x'.repeat(120)}`;
const PANEL_W = 260;

function chromeCandidates(): string[] {
  const fromEnv = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return [
    fromEnv,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter((p): p is string => Boolean(p));
}

async function launchBrowser(): Promise<Browser> {
  const args = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'];
  for (const executablePath of chromeCandidates()) {
    if (!fs.existsSync(executablePath)) {
      continue;
    }
    try {
      return await chromium.launch({ executablePath, args });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ args });
}

describe('Summary overflow UI', () => {
  it('keeps a 260px Summary pane from growing when a naming issue embeds a huge key', async () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../packages/ui/styles.css'), 'utf8');
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${css}
body { margin: 0; font-family: sans-serif; background: #1e1e1e; color: #ccc; width: ${PANEL_W}px; }
</style>
</head>
<body>
<aside class="summary-panel" style="width:${PANEL_W}px;flex:0 0 ${PANEL_W}px;min-width:0;max-width:100%">
  <div class="summary-panel-header"><span>Summary</span></div>
  <div class="summary-body">
    <div class="summary-block">
      <div class="summary-key" title="${LONG}">${LONG}</div>
    </div>
    <div class="summary-block">
      <div class="section-title">Issues</div>
      <ul class="issue-list">
        <li class="issue-item issue-rule--keyPascalCase">
          <div class="issue-item-tag">Naming</div>
          <div class="issue-item-message">Key should be PascalCase of neutral value: expected "${LONG}"</div>
        </li>
      </ul>
    </div>
  </div>
</aside>
</body>
</html>`;

    let browser: Browser | undefined;
    try {
      browser = await launchBrowser();
    } catch (err) {
      throw new Error(
        `Need Chrome/Chromium for Summary overflow UI tests. Install Chrome or set CHROME_PATH. (${String(err)})`
      );
    }

    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.setContent(html, { waitUntil: 'load' });

    const metrics = await page.evaluate((panelWidth) => {
      const panel = document.querySelector('.summary-panel') as HTMLElement;
      const item = document.querySelector('.issue-item') as HTMLElement;
      const message = document.querySelector('.issue-item-message') as HTMLElement;
      const key = document.querySelector('.summary-key') as HTMLElement;
      return {
        panelWidth: panel.getBoundingClientRect().width,
        itemWidth: item.getBoundingClientRect().width,
        messageScroll: message.scrollWidth,
        messageClient: message.clientWidth,
        keyScroll: key.scrollWidth,
        keyClient: key.clientWidth,
        messageHeight: message.getBoundingClientRect().height,
        panelScrollWidth: panel.scrollWidth,
      };
    }, PANEL_W);

    await browser.close();

    expect(metrics.panelWidth).toBeLessThanOrEqual(PANEL_W + 1);
    expect(metrics.itemWidth).toBeLessThanOrEqual(PANEL_W + 1);
    expect(metrics.panelScrollWidth).toBeLessThanOrEqual(PANEL_W + 1);
    expect(metrics.messageScroll).toBeLessThanOrEqual(metrics.messageClient + 2);
    expect(metrics.keyScroll).toBeLessThanOrEqual(metrics.keyClient + 2);
    expect(metrics.messageHeight).toBeGreaterThan(20);
  }, 30_000);
});
