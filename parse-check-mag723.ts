import { readFileSync } from 'fs';
import { parseDerivedFile } from './handlers/ts/framework/derived-parser.js';
import { parseWidgetFile } from './handlers/ts/framework/widget-spec-parser.js';

// Parse derived
const dSource = readFileSync('specs/editors/persona-editor.derived', 'utf-8');
try {
  const ast = parseDerivedFile(dSource);
  console.log('=== PersonaEditor derived ===');
  console.log('Name:', ast.name);
  console.log('Type params:', ast.typeParams);
  console.log('Composes:', ast.composes.map((c: any) => c.name).join(', '));
  console.log('Syncs required:', ast.syncs.required.join(', '));
  console.log('Surface actions:', ast.surface.actions.map((a: any) => a.name).join(', '));
  console.log('Surface queries:', ast.surface.queries.map((q: any) => q.name).join(', '));
  console.log('Principle:', ast.principle ? 'present' : 'missing');
  console.log('DERIVED: OK');
} catch (e: any) {
  console.error('DERIVED ERROR:', e.message);
}

// Parse widgets
const widgets = [
  'surface/widgets/persona-status-badge.widget',
  'surface/widgets/prompt-assembly-preview.widget',
  'surface/widgets/persona-consumers-panel.widget',
];

for (const p of widgets) {
  const src = readFileSync(p, 'utf-8');
  try {
    const w = parseWidgetFile(src);
    const invCount = w.invariant?.assertions?.length ?? 0;
    console.log(`\n=== ${w.name} ===`);
    console.log('Anatomy parts:', w.anatomy?.parts?.length ?? 0);
    console.log('Props:', w.props?.fields?.length ?? 0);
    console.log('Invariant assertions:', invCount);
    console.log('WIDGET: OK');
  } catch (e: any) {
    console.error(`WIDGET ERROR (${p}):`, e.message);
  }
}
