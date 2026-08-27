import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // IIFE loads reliably in VS Code webviews (no type="module" / CSP quirks)
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
});
