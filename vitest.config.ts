import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@resx-guard/core-ts': path.resolve(__dirname, 'packages/core-ts/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['test/**/*.test.tsx', 'jsdom']],
  },
});
