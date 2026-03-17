// Ink (Terminal UI) Target Interpreter — React-like JSX with Box/Text

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, capitalize } from './_classify.js';

export function interpretInk(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'ink');
  const lines: string[] = [];

  // Imports
  lines.push(`import React from 'react';`);
  const inkImports = ['Box', 'Text'];
  if (c.keyboards.length > 0) inkImports.push('useInput');
  if (c.focusConfig) inkImports.push('useFocus');
  lines.push(`import { ${inkImports.join(', ')} } from 'ink';`);
  const reactImports: string[] = [];
  if (c.states.length > 0) reactImports.push('useState');
  if (c.transitions.length > 0) reactImports.push('useCallback');
  if (reactImports.length > 0) lines.push(`import { ${reactImports.join(', ')} } from 'react';`);
  lines.push('');

  // Props
  if (c.props.length > 0) {
    lines.push(`export interface ${componentName}Props {`);
    for (const p of c.props) {
      const opt = p.defaultValue ? '?' : '';
      lines.push(`  ${p.name}${opt}: ${mapType(p.propType)};`);
    }
    lines.push('}');
    lines.push('');
  }

  const propsParam = c.props.length > 0 ? `props: ${componentName}Props` : '';
  lines.push(`export function ${componentName}(${propsParam}) {`);

  for (const p of c.props) {
    if (p.defaultValue) lines.push(`  const ${p.name} = props.${p.name} ?? ${fmtDef(p.defaultValue)};`);
  }
  if (c.props.some(p => p.defaultValue)) lines.push('');

  // State
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`  const [${v}, set${cap(v)}] = useState('${initial.name}');`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Transitions
  if (c.transitions.length > 0) {
    lines.push(`  const send = useCallback((event: string) => {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        lines.push(`    set${cap(v)}(cur => {`);
        lines.push(`      switch (cur) {`);
        const byFrom = groupBy(gt, t => t.fromState);
        for (const [from, trans] of byFrom) {
          lines.push(`        case '${from}':`);
          for (const t of trans) lines.push(`          if (event === '${t.event}') return '${t.toState}';`);
          lines.push(`          return cur;`);
        }
        lines.push(`        default: return cur;`);
        lines.push(`      }`);
        lines.push(`    });`);
      }
    }
    lines.push(`  }, []);`);
    lines.push('');
  }

  // Ink keyboard input hook
  if (c.keyboards.length > 0) {
    lines.push(`  useInput((input, key) => {`);
    for (const kb of c.keyboards) {
      if (kb.key === 'Enter') lines.push(`    if (key.return) send('${kb.event}');`);
      else if (kb.key === 'Escape') lines.push(`    if (key.escape) send('${kb.event}');`);
      else if (kb.key === 'Tab') lines.push(`    if (key.tab) send('${kb.event}');`);
      else if (kb.key === 'Space') lines.push(`    if (input === ' ') send('${kb.event}');`);
      else if (kb.key === 'ArrowUp') lines.push(`    if (key.upArrow) send('${kb.event}');`);
      else if (kb.key === 'ArrowDown') lines.push(`    if (key.downArrow) send('${kb.event}');`);
      else if (kb.key === 'ArrowLeft') lines.push(`    if (key.leftArrow) send('${kb.event}');`);
      else if (kb.key === 'ArrowRight') lines.push(`    if (key.rightArrow) send('${kb.event}');`);
      else lines.push(`    if (input === '${kb.key.toLowerCase()}') send('${kb.event}');`);
    }
    lines.push(`  });`);
    lines.push('');
  }

  // Focus
  if (c.focusConfig) {
    lines.push(`  const { isFocused } = useFocus({ autoFocus: true });`);
    lines.push('');
  }

  // JSX — Ink uses Box + Text
  lines.push('  return (');
  lines.push('    <Box flexDirection="column">');
  for (const el of c.elements) {
    const ariaAttrs = c.ariaMap.get(el.part) || [];
    const label = ariaAttrs.find(a => a.attr === 'label' || a.attr === 'aria-label');
    const labelComment = label ? ` /* ${label.attr}: ${label.value} */` : '';
    lines.push(`      <Box>{/* ${el.part} (${el.role})${labelComment} */}</Box>`);
  }
  for (const comp of c.composes) {
    lines.push(`      {/* <${capitalize(comp.widget)} /> — slot: ${comp.slot} */}`);
  }
  lines.push('    </Box>');
  lines.push('  );');
  lines.push('}');

  return { output: lines.join('\n'), trace: c.trace };
}

function mapType(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'string';
  if (l === 'bool' || l === 'boolean') return 'boolean';
  if (l === 'int' || l === 'number') return 'number';
  return t;
}
function fmtDef(v: string): string {
  if (v === 'true' || v === 'false' || /^\d+$/.test(v) || v === '[]') return v;
  return `'${v}'`;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
