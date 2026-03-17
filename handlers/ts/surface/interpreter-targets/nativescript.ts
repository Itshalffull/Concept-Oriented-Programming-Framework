// NativeScript Target Interpreter — TypeScript View subclass

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretNativescript(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'nativescript');
  const lines: string[] = [];

  lines.push(`import { StackLayout, Label } from '@nativescript/core';`);
  lines.push('');
  lines.push(`export class ${componentName} extends StackLayout {`);

  // Props as class properties
  for (const p of c.props) {
    const tsType = mapType(p.propType);
    const def = p.defaultValue ? ` = ${fmtDef(p.defaultValue, p.propType)}` : '';
    lines.push(`  ${p.name}: ${tsType}${def};`);
  }
  if (c.props.length > 0) lines.push('');

  // State fields
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`  private _${v} = '${initial.name}';`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Constructor
  lines.push(`  constructor() {`);
  lines.push(`    super();`);
  // Accessibility
  const rootAria = c.ariaMap.get(c.elements[0]?.part || 'root') || [];
  const roleAttr = rootAria.find(a => a.attr === 'role');
  if (roleAttr) lines.push(`    this.accessibilityRole = '${roleAttr.value}';`);
  const labelAttr = rootAria.find(a => a.attr === 'label' || a.attr === 'aria-label');
  if (labelAttr) lines.push(`    this.automationText = '${labelAttr.value}';`);
  lines.push(`    this.on('loaded', () => this.buildUI());`);
  lines.push(`  }`);
  lines.push('');

  // Send
  if (c.transitions.length > 0) {
    lines.push(`  send(event: string): void {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        const byFrom = groupBy(gt, t => t.fromState);
        lines.push(`    switch (this._${v}) {`);
        for (const [from, trans] of byFrom) {
          lines.push(`      case '${from}':`);
          for (const t of trans) {
            lines.push(`        if (event === '${t.event}') { this._${v} = '${t.toState}'; this.notifyPropertyChange('${v}', this._${v}); return; }`);
          }
          lines.push(`        break;`);
        }
        lines.push(`    }`);
      }
    }
    lines.push(`  }`);
    lines.push('');
  }

  // Build UI
  lines.push(`  private buildUI(): void {`);
  for (const el of c.elements) {
    lines.push(`    // ${el.part} (${el.role})`);
    lines.push(`    const ${el.part}Label = new Label();`);
    lines.push(`    ${el.part}Label.text = '${el.part}';`);
    lines.push(`    this.addChild(${el.part}Label);`);
  }
  if (c.focusConfig) {
    lines.push(`    // Focus: ${c.focusConfig.strategy} on ${c.focusConfig.initialPart}`);
    lines.push(`    this.requestFocus();`);
  }
  lines.push(`  }`);
  lines.push('');

  // Keyboard gestures
  if (c.keyboards.length > 0) {
    lines.push(`  // Keyboard gestures (physical keyboard or hardware buttons)`);
    for (const kb of c.keyboards) {
      lines.push(`  // ${kb.key} -> send('${kb.event}')`);
    }
    lines.push('');
  }

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
function fmtDef(v: string, t: string): string {
  if (v === 'true' || v === 'false' || /^\d+$/.test(v) || v === '[]') return v;
  return `'${v}'`;
}
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
