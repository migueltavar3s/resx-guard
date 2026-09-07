import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = join(root, 'packages', 'ui');

const targets = [
  join(root, 'apps', 'vscode', 'webview', 'dist'),
  join(root, 'apps', 'visualstudio', 'ResXGuard', 'WebView', 'dist'),
];

for (const outDir of targets) {
  mkdirSync(outDir, { recursive: true });
  execSync('npx vite build --config vite.config.ts', {
    cwd: uiDir,
    env: { ...process.env, UI_OUT_DIR: outDir },
    stdio: 'inherit',
  });
}

console.log('UI built for', targets.length, 'targets');
