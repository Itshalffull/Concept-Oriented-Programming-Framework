// Copy Tree-sitter WASM grammar files from node_modules to suites/parse/grammars/wasm/.
// Runs as postinstall script. Skips gracefully if tree-sitter-wasms is not installed.
//
// Dynamically scans node_modules/tree-sitter-wasms/out/*.wasm and copies every
// grammar the package ships, so adding a new grammar is as simple as bumping
// the tree-sitter-wasms version.

import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WASMS_DIR = resolve(ROOT, 'node_modules', 'tree-sitter-wasms', 'out');
const TARGET_DIR = resolve(ROOT, 'suites', 'parse', 'grammars', 'wasm');

if (!existsSync(WASMS_DIR)) {
  console.log('tree-sitter-wasms not installed, skipping WASM copy.');
  process.exit(0);
}

mkdirSync(TARGET_DIR, { recursive: true });

const GRAMMARS = readdirSync(WASMS_DIR).filter((n) => n.endsWith('.wasm'));

let copied = 0;
for (const name of GRAMMARS) {
  const src = resolve(WASMS_DIR, name);
  const dst = resolve(TARGET_DIR, name);
  if (existsSync(src)) {
    copyFileSync(src, dst);
    console.log(`  Copied ${name}`);
    copied++;
  } else {
    console.warn(`  Warning: ${name} not found in tree-sitter-wasms`);
  }
}

console.log(`Tree-sitter WASM grammars ready (${copied} copied).`);
