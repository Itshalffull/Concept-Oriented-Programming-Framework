#!/usr/bin/env node
// ============================================================================
// Fix remaining issues: .current and paren imbalance
// ============================================================================

const fs = require('fs');
const path = require('path');

const VUE_BASE = path.join(__dirname, '..', 'surface/widgets/vue/components/widgets');

const files = [
  'feedback/Dialog.ts',
  'feedback/Drawer.ts',
  'data-display/CalendarView.ts',
  'complex-inputs/ColorPicker.ts',
  'complex-inputs/DateRangePicker.ts',
  'composites/CacheDashboard.ts',
  'composites/FileBrowser.ts',
  'composites/QueueDashboard.ts',
  'domain/CanvasConnector.ts',
  'domain/CanvasNode.ts',
  'domain/ImageGallery.ts',
  'domain/PolicyEditor.ts',
  'domain/StepIndicator.ts',
  'domain/WorkflowNode.ts',
];

let fixed = 0;

for (const rel of files) {
  const filePath = path.join(VUE_BASE, rel);
  if (!fs.existsSync(filePath)) continue;

  let code = fs.readFileSync(filePath, 'utf-8');

  // Fix .current -> .value
  code = code.replace(/\.current\b/g, '.value');
  code = code.replace(/\.value\.value\b/g, '.value');

  // Fix paren imbalance (negative = extra closing parens)
  // Count parens
  let parens = 0;
  for (const ch of code) {
    if (ch === '(') parens++;
    if (ch === ')') parens--;
  }

  // If negative parens, there are extra closing parens
  // Find and remove orphaned `)` or `);` lines
  if (parens < 0) {
    const lines = code.split('\n');
    let toRemove = Math.abs(parens);

    // Search from the end for orphaned `)` or `);` lines
    for (let i = lines.length - 1; i >= 0 && toRemove > 0; i--) {
      const line = lines[i].trim();
      // Skip the export default line
      if (line.startsWith('export')) continue;
      // Skip the `});` that closes defineComponent
      if (line === '});' && i === lines.length - 3) continue;

      // Look for orphaned `;` or `);` that are just closing extras
      if (line === ');' || line === ')' || line === '),') {
        // Check context - if the line before already closes something, this is extra
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        if (prevLine.endsWith('});') || prevLine.endsWith(']);') || prevLine.endsWith('},')
            || prevLine.endsWith(');') || prevLine === '' || prevLine.endsWith('}')
            || prevLine.endsWith('])')) {
          lines.splice(i, 1);
          toRemove--;
        }
      }
    }

    code = lines.join('\n');
  }

  // Re-check
  parens = 0;
  for (const ch of code) {
    if (ch === '(') parens++;
    if (ch === ')') parens--;
  }

  if (parens < 0) {
    // More aggressive: find standalone `);` or `]);` that create imbalance
    const lines = code.split('\n');
    // Look for lines that are just `]);` after something that already ends properly
    for (let i = lines.length - 1; i >= 0 && parens < 0; i--) {
      const line = lines[i].trim();
      if (line === ']);' && i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.endsWith(']);') || prevLine.endsWith('},') || prevLine.endsWith('});')) {
          lines.splice(i, 1);
          parens += 2; // ]) is two closers
        }
      }
    }
    code = lines.join('\n');
  }

  fs.writeFileSync(filePath, code);
  fixed++;
  process.stdout.write('.');
}

console.log(`\nFixed ${fixed} files.`);

// Verify
const categories = ['primitives', 'form-controls', 'feedback', 'navigation', 'data-display', 'complex-inputs', 'composites', 'domain'];
let issueCount = 0;
for (const cat of categories) {
  const dir = path.join(VUE_BASE, cat);
  if (!fs.existsSync(dir)) continue;
  const catFiles = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  for (const file of catFiles) {
    const c = fs.readFileSync(path.join(dir, file), 'utf-8');
    let b = 0, p = 0;
    for (const ch of c) { if (ch === '{') b++; if (ch === '}') b--; if (ch === '(') p++; if (ch === ')') p--; }
    const probs = [];
    if (b !== 0) probs.push('braces:' + b);
    if (p !== 0) probs.push('parens:' + p);
    if (c.includes('.current')) probs.push('.current');
    if (probs.length > 0) { issueCount++; console.log(`  ${cat}/${file}: ${probs.join(', ')}`); }
  }
}
console.log(`Remaining: ${issueCount}`);
