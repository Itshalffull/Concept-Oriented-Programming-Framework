import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@clef/runtime': path.resolve(__dirname, './runtime/index.ts'),
    },
  },
  test: {
    include: [
      'tests/**/*.test.ts',
      'generated/surface/**/*.test.ts',
      'generated/typescript/**/*.test.ts',
      'generated/deploy/**/*.test.ts',
      'generated/repertoire/**/*.test.ts',
      'framework/**/tests/**/*.test.ts',
      'codegen/**/*.test.ts',
      'kits/generation/tests/**/*.test.ts',
    ],
    globals: true,
  },
});
