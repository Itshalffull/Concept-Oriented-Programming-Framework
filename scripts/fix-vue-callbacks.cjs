#!/usr/bin/env node
// ============================================================================
// Fix leftover useCallback patterns in Vue widget files
// ============================================================================

const fs = require('fs');
const path = require('path');

const VUE_BASE = path.join(__dirname, '..', 'surface/widgets/vue/components/widgets');

const categories = [
  'primitives', 'form-controls', 'feedback', 'navigation',
  'data-display', 'complex-inputs', 'composites', 'domain'
];

let fixed = 0;

for (const cat of categories) {
  const dir = path.join(VUE_BASE, cat);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

  for (const file of files) {
    const filePath = path.join(dir, file);
    let code = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Fix 1: Remove `const x = useCallback(` -> `const x = (`
    if (code.includes('useCallback')) {
      code = code.replace(/= useCallback\(\s*\n?/g, '= (\n');
      changed = true;
    }

    // Fix 2: Remove leftover deps array lines like `    [dep1, dep2],\n  );`
    // These appear after callback function bodies as standalone lines
    code = code.replace(/,\s*\n\s*\[[\w\s,.?()]*\],?\s*\n\s*\);/g, ';');
    // Also `[deps]\n);` without leading comma
    code = code.replace(/\n\s*\[[\w\s,.?()]*\]\s*\n\s*\);/g, '\n;');

    // Fix 3: Remove `useMemo(` if it leaked through
    if (code.includes('useMemo(')) {
      code = code.replace(/= useMemo\(\(\)\s*=>\s*/g, '= ');
      // Remove trailing `, [deps])` from useMemo
      code = code.replace(/,\s*\[[\w\s,]*\]\s*\)/g, '');
      changed = true;
    }

    // Fix 4: Fix any remaining React type annotations
    code = code.replace(/:\s*React\.\w+(?:<[^>]*>)?/g, ': any');
    code = code.replace(/:\s*ChangeEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*KeyboardEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*FormEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*MouseEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*DragEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*FocusEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*ClipboardEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*TouchEvent<[^>]*>/g, ': any');
    code = code.replace(/:\s*PointerEvent<[^>]*>/g, ': any');

    // Fix 5: Fix e.target === e.currentTarget patterns
    code = code.replace(/e\.target\s*===\s*e\.currentTarget/g, '(e as any).target === (e as any).currentTarget');
    // Don't double-wrap
    code = code.replace(/\(e as any\) as any\)/g, '(e as any)');

    if (code !== fs.readFileSync(filePath, 'utf-8')) {
      fs.writeFileSync(filePath, code);
      fixed++;
      process.stdout.write('.');
    }
  }
}

console.log(`\nFixed ${fixed} files.`);
