import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function readVersion(): string {
  try {
    return JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const outDir = process.env.UI_OUT_DIR
    ? path.resolve(process.env.UI_OUT_DIR)
    : path.resolve(__dirname, 'dist');

  return {
    plugins: [react()],
    root: __dirname,
    base: './',
    resolve: {
      alias: {
        '@resx-guard/core-ts': path.resolve(__dirname, '../core-ts/src/index.ts'),
      },
    },
    define: {
      'import.meta.env.VITE_EXTENSION_VERSION': JSON.stringify(
        env.VITE_EXTENSION_VERSION || readVersion()
      ),
    },
    build: {
      outDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          format: 'iife',
          entryFileNames: 'assets/index.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/index.css';
            }
            return 'assets/[name][extname]';
          },
          name: 'ResxGuardWebview',
          inlineDynamicImports: true,
        },
      },
    },
  };
});
