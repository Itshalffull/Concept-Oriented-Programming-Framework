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
      'tests/**/*.test.tsx',
      'generated/tests/**/*.test.ts',
      'generated/surface/**/*.test.ts',
      'generated/typescript/**/*.test.ts',
      'generated/deploy/**/*.test.ts',
      'generated/repertoire/**/*.test.ts',
      'generated/nextjs/**/*.test.ts',
      'generated/widget-tests/**/*.test.ts',
      'codegen/**/*.test.ts',
      'repertoire/**/tests/**/*.test.ts',
      'surface/widgets/**/*.test.ts',
      'surface/widgets/**/*.test.tsx',
    ],
    globals: true,
  },
});
