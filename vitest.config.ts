import { defineConfig } from 'vitest/config';
import path from 'path';
import { existsSync } from 'fs';

// Plugin to resolve .js imports to .ts when .js file doesn't exist
const jsToTsPlugin = {
  name: 'js-to-ts',
  resolveId(id: string, importer: string | undefined) {
    if (!importer || !id.startsWith('.')) return null;
    if (!id.endsWith('.js')) return null;
    const dir = path.dirname(importer);
    const jsPath = path.resolve(dir, id);
    if (!existsSync(jsPath)) {
      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) return tsPath;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [jsToTsPlugin],
  resolve: {
    alias: {
      '@clef/runtime': path.resolve(__dirname, './runtime/index.ts'),
    },
    extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
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
      'codegen/**/*.test.ts',
      'repertoire/**/tests/**/*.test.ts',
      'surface/widgets/**/*.test.ts',
      'surface/widgets/**/*.test.tsx',
    ],
    globals: true,
  },
});
