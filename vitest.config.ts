import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@clef/runtime': path.resolve(__dirname, './runtime/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'generated/surface/**/*.test.ts', 'generated/typescript/**/*.test.ts', 'kits/generation/tests/**/*.test.ts'],
    globals: true,
  },
});
