import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@clef/kernel': path.resolve(__dirname, './kernel/src/index.ts'),
      '@clef/runtime': path.resolve(__dirname, './kernel/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'generated/surface/**/*.test.ts', 'generated/typescript/**/*.test.ts', 'kits/generation/tests/**/*.test.ts'],
    globals: true,
  },
});
