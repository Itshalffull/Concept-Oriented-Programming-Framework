#!/usr/bin/env node
// ============================================================================
// Final cleanup pass for Vue widget files
// Fixes: malformed callbacks, brace/paren balance, .current refs,
// useEffect remnants, and other syntax issues.
// ============================================================================

const fs = require('fs');
const path = require('path');

const VUE_BASE = path.join(__dirname, '..', 'surface/widgets/vue/components/widgets');

const categories = [
  'primitives', 'form-controls', 'feedback', 'navigation',
  'data-display', 'complex-inputs', 'composites', 'domain'
];

let fixedCount = 0;

for (const cat of categories) {
  const dir = path.join(VUE_BASE, cat);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

  for (const file of files) {
    const filePath = path.join(dir, file);
    let code = fs.readFileSync(filePath, 'utf-8');
    const original = code;

    // Fix 1: Malformed callback pattern: `const x = (\n() => {` -> `const x = () => {`
    code = code.replace(/= \(\s*\n\s*\(\)\s*=>\s*\{/g, '= () => {');
    code = code.replace(/= \(\s*\n\s*\(([^)]*)\)\s*=>\s*\{/g, '= ($1) => {');
    code = code.replace(/= \(\s*\n\s*\(([^)]*)\)\s*=>\s*/g, '= ($1) => ');

    // Fix 2: Remove any leftover useEffect( or useCallback( or useMemo(
    code = code.replace(/\buseEffect\(/g, '(');
    code = code.replace(/\buseCallback\(/g, '(');
    code = code.replace(/\buseMemo\(/g, '(');

    // Fix 3: .current -> .value (should have been done, but some slipped through)
    code = code.replace(/\.current\b/g, '.value');

    // Fix 4: Fix double (.value.value)
    code = code.replace(/\.value\.value\b/g, '.value');

    // Fix 5: Clean up orphaned deps arrays and closing parens
    // Pattern: `;\n    [deps],\n  ` or `;\n    [deps]\n  );`
    code = code.replace(/;\s*\n\s*\[[\w\s,.?()]*\]\s*,?\s*\n\s*\)\s*;/g, ';');
    // Pattern: standalone `[deps]\n);`
    code = code.replace(/\n\s*\[[\w\s,.?()]*\]\s*\n\s*\)\s*;/g, '\n');

    // Fix 6: Fix balance issues by counting and patching
    // Count braces and parens
    let lines = code.split('\n');

    // Ensure the file ends properly
    // The pattern should be:
    // ...
    //   },
    // });
    //
    // export default WidgetName;

    // Fix 7: Remove any doubled `});` at end
    const lastExport = code.lastIndexOf('export default');
    if (lastExport > 0) {
      let beforeExport = code.substring(0, lastExport).trimEnd();
      // Count braces/parens in the code before export
      let braces = 0, parens = 0;
      for (const ch of beforeExport) {
        if (ch === '{') braces++;
        if (ch === '}') braces--;
        if (ch === '(') parens++;
        if (ch === ')') parens--;
      }

      // We need braces to be 0 and parens to be 0
      // If braces > 0, add closing braces
      // If parens > 0, add closing parens
      let suffix = '';

      // Typical pattern: we should end with `  },\n});`
      // If we're missing closing structures, add them
      if (braces > 0 || parens > 0) {
        // Remove any trailing whitespace/newlines
        beforeExport = beforeExport.replace(/\s+$/, '');

        // Add missing closers
        while (braces > 0) {
          // Check if we need `},` or just `}`
          if (braces === 2) {
            // We're at the setup function level - need `  },\n`
            suffix += '\n  },';
            braces--;
          } else if (braces === 1) {
            // We're at the component level - need `});`
            suffix += '\n});';
            braces--;
            parens--; // The ); closes one paren too
          } else {
            suffix += '\n' + '  '.repeat(braces) + '}';
            braces--;
          }
        }
        while (parens > 0) {
          suffix += ')';
          parens--;
        }

        code = beforeExport + suffix + '\n\n' + code.substring(lastExport);
      }
    }

    // Final balance check and fix
    let braces = 0, parens = 0;
    for (const ch of code) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '(') parens++;
      if (ch === ')') parens--;
    }

    // If still imbalanced, do a more targeted fix
    if (parens > 0) {
      // Find the export default line and insert closers before it
      const exportIdx = code.lastIndexOf('export default');
      if (exportIdx > 0) {
        let insertion = '';
        while (parens > 0) { insertion += ')'; parens--; }
        // Find end of the line before export
        const prevNewline = code.lastIndexOf('\n', exportIdx - 2);
        const lineBeforeExport = code.substring(prevNewline + 1, exportIdx).trim();
        if (lineBeforeExport === '' || lineBeforeExport === '});') {
          // Already has proper closing, the extra parens might be in the render function
          // Just add the closing parens to the end of the setup function
          // Find last `]);` before export and add parens after it
        }
        // Simple approach: insert before the export
        code = code.substring(0, exportIdx) + '\n' + insertion + ';\n\n' + code.substring(exportIdx);
      }
    }

    if (code !== original) {
      fs.writeFileSync(filePath, code);
      fixedCount++;
      process.stdout.write('.');
    }
  }
}

console.log(`\nFixed ${fixedCount} files.`);

// Verify
let issueCount = 0;
for (const cat of categories) {
  const dir = path.join(VUE_BASE, cat);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  for (const file of files) {
    const code = fs.readFileSync(path.join(dir, file), 'utf-8');
    let braces = 0, parens = 0;
    for (const ch of code) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '(') parens++;
      if (ch === ')') parens--;
    }
    const probs = [];
    if (braces !== 0) probs.push('braces:' + braces);
    if (parens !== 0) probs.push('parens:' + parens);
    if (code.includes('.current')) probs.push('.current');
    if (code.includes('useCallback')) probs.push('useCallback');
    if (code.includes('useEffect(')) probs.push('useEffect');
    if (code.includes('= (\n()')) probs.push('malformed');
    if (probs.length > 0) {
      issueCount++;
      console.log(`  REMAINING: ${cat}/${file}: ${probs.join(', ')}`);
    }
  }
}
console.log(`\nRemaining issues: ${issueCount}`);
