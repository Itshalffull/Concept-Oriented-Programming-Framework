import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '../../..');
const NEXTJS_BASE = join(ROOT, 'surface/widgets/nextjs/components/widgets');
const REACT_BASE = join(ROOT, 'surface/widgets/react/components/widgets');

const categories = [
  'primitives',
  'form-controls',
  'feedback',
  'navigation',
  'data-display',
  'complex-inputs',
  'composites',
  'domain',
];

function removeAllReducerReferences(content, widgetName) {
  // Strategy: use regex on the full content string to remove all import statements
  // that reference the reducer file. This handles both single-line and multi-line imports.
  //
  // An import statement looks like:
  //   import { foo } from './Widget.reducer.js';
  // or multi-line:
  //   import {
  //     foo,
  //     bar,
  //   } from './Widget.reducer.js';
  // or type-only:
  //   import type { Foo } from './Widget.reducer.js';
  // or re-export:
  //   export type { Foo } from './Widget.reducer.js';
  //   export { foo } from './Widget.reducer.js';

  const reducerFileRef = `./${widgetName}.reducer`;

  // Remove import/export statements that reference the reducer
  // Match: import ... from './Widget.reducer.js';  (single or multi-line)
  // Match: export ... from './Widget.reducer.js';  (re-exports)

  // First, handle multi-line imports: import {\n...\n} from './Widget.reducer.js';
  // Use a regex that matches across newlines
  const multiLineImportRe = new RegExp(
    `(?:import|export)\\s+(?:type\\s+)?\\{[^}]*\\}\\s+from\\s+['"]\\.\\/` +
    escapeRegex(widgetName) +
    `\\.reducer(?:\\.js)?['"];?\\s*\\n?`,
    'gs'  // s flag for dotAll mode
  );
  content = content.replace(multiLineImportRe, '');

  // Also handle: import { foo } from './Widget.reducer.js'; on a single line
  // (should already be caught above, but just in case)

  // Clean up any resulting double blank lines from removed imports
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function processWidget(category, widgetName) {
  const tsxPath = join(NEXTJS_BASE, category, `${widgetName}.tsx`);
  const reducerPath = join(NEXTJS_BASE, category, `${widgetName}.reducer.ts`);

  if (!existsSync(tsxPath)) {
    console.error(`  SKIP: ${tsxPath} not found`);
    return false;
  }

  let tsxContent = readFileSync(tsxPath, 'utf-8');
  const hasReducer = existsSync(reducerPath);

  // 1. Remove 'use client'; directive
  tsxContent = tsxContent.replace(/^'use client';\s*\n?/m, '');

  if (hasReducer) {
    const reducerContent = readFileSync(reducerPath, 'utf-8').trim();

    // 2. Remove all reducer import/export lines
    tsxContent = removeAllReducerReferences(tsxContent, widgetName);

    // 3. Find insertion point (after all remaining imports)
    const lines = tsxContent.split('\n');
    let lastImportEnd = -1;
    let inImport = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
        inImport = true;
      }
      if (inImport) {
        if (trimmed.endsWith(';')) {
          lastImportEnd = i;
          inImport = false;
        }
      }
    }

    // Insert inlined reducer after last import
    const reducerBlock = '\n// Inlined reducer\n' + reducerContent;

    if (lastImportEnd >= 0) {
      lines.splice(lastImportEnd + 1, 0, reducerBlock);
    } else {
      lines.unshift(reducerBlock + '\n');
    }

    tsxContent = lines.join('\n');
  }

  // Clean up excessive blank lines
  tsxContent = tsxContent.replace(/\n{4,}/g, '\n\n\n');
  tsxContent = tsxContent.replace(/^\n+/, '');

  // Write
  const outDir = join(REACT_BASE, category);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${widgetName}.tsx`), tsxContent, 'utf-8');

  return true;
}

let total = 0;
let errors = 0;

for (const cat of categories) {
  const dir = join(NEXTJS_BASE, cat);
  if (!existsSync(dir)) continue;

  const widgets = readdirSync(dir)
    .filter(f => f.endsWith('.tsx') && f !== 'index.tsx')
    .map(f => f.replace('.tsx', ''));

  console.log(`\n=== ${cat} (${widgets.length}) ===`);

  for (const w of widgets) {
    if (processWidget(cat, w)) {
      total++;
      console.log(`  OK: ${w}`);
    } else {
      errors++;
    }
  }
}

console.log(`\nTotal: ${total}`);
if (errors) console.log(`Errors: ${errors}`);
