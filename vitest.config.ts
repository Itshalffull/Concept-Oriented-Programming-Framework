import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@copf/kernel': path.resolve(__dirname, './kernel/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
