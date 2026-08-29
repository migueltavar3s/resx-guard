import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'media', 'icon.png');
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean);

async function launch() {
  const args = ['--headless=new', '--no-sandbox'];
  for (const executablePath of candidates) {
    if (!fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, args });
    } catch {
      /* next */
    }
  }
  return chromium.launch({ args });
}

const b64 = fs.readFileSync(src).toString('base64');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
await page.setContent(
  `<!doctype html><html><body style="margin:0;background:#0b1220">
  <canvas id="c" width="128" height="128"></canvas>
  <script>
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      ctx.clearRect(0,0,128,128);
      // draw rounded rect clip
      const r = 22;
      ctx.beginPath();
      ctx.moveTo(r,0); ctx.arcTo(128,0,128,128,r); ctx.arcTo(128,128,0,128,r);
      ctx.arcTo(0,128,0,0,r); ctx.arcTo(0,0,128,0,r); ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, 128, 128);
      window.__done = true;
    };
    img.src = 'data:image/png;base64,${b64}';
  </script></body></html>`
);
await page.waitForFunction(() => window.__done === true);
const buf = await page.evaluate(async () => {
  const c = document.getElementById('c');
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  const ab = await blob.arrayBuffer();
  return Array.from(new Uint8Array(ab));
});
fs.writeFileSync(src, Buffer.from(buf));
await browser.close();
console.log('icon bytes', fs.statSync(src).size);
