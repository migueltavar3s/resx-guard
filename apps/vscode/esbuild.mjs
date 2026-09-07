import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  alias: {
    '@resx-guard/core-ts': path.join(root, 'packages/core-ts/src/index.ts'),
  },
});

if (watch) {
  await ctx.watch();
  console.log('watching extension…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
