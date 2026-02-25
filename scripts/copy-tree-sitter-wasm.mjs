// Copy Tree-sitter WASM grammar files from node_modules to kits/parse/grammars/wasm/.
// Runs as postinstall script. Skips gracefully if tree-sitter-wasms is not installed.

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WASMS_DIR = resolve(ROOT, 'node_modules', 'tree-sitter-wasms', 'out');
const TARGET_DIR = resolve(ROOT, 'kits', 'parse', 'grammars', 'wasm');

const GRAMMARS = [
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-json.wasm',
  'tree-sitter-yaml.wasm',
];

if (!existsSync(WASMS_DIR)) {
  console.log('tree-sitter-wasms not installed, skipping WASM copy.');
  process.exit(0);
}

mkdirSync(TARGET_DIR, { recursive: true });

for (const name of GRAMMARS) {
  const src = resolve(WASMS_DIR, name);
  const dst = resolve(TARGET_DIR, name);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`  Copied ${name}`);
  } else {
    console.warn(`  Warning: ${name} not found in tree-sitter-wasms`);
  }
}

console.log('Tree-sitter WASM grammars ready.');
