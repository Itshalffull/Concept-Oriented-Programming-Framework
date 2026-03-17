// SwiftUI Target Interpreter — Swift View structs

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretSwiftUI(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'swiftui');
  const lines: string[] = [];

  lines.push(`import SwiftUI`);
  lines.push('');
  lines.push(`struct ${componentName}: View {`);

  // Props as stored properties
  for (const p of c.props) {
    const swt = swiftType(p.propType);
    if (p.defaultValue) {
      lines.push(`    var ${p.name}: ${swt} = ${swiftDefault(p.defaultValue, p.propType)}`);
    } else {
      lines.push(`    var ${p.name}: ${swt}`);
    }
  }
  if (c.props.length > 0) lines.push('');

  // State variables
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`    @State private var ${v} = "${initial.name}"`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Focus state
  if (c.focusConfig) {
    lines.push(`    @FocusState private var isFocused: Bool`);
    lines.push('');
  }

  // Send function
  if (c.transitions.length > 0) {
    lines.push(`    private func send(_ event: String) {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        const byFrom = groupBy(gt, t => t.fromState);
        lines.push(`        switch ${v} {`);
        for (const [from, trans] of byFrom) {
          for (const t of trans) {
            lines.push(`        case "${from}" where event == "${t.event}":`);
            lines.push(`            ${v} = "${t.toState}"`);
          }
        }
        lines.push(`        default: break`);
        lines.push(`        }`);
      }
    }
    lines.push(`    }`);
    lines.push('');
  }

  // Body
  lines.push(`    var body: some View {`);
  lines.push(`        VStack {`);

  for (const el of c.elements) {
    const ariaAttrs = c.ariaMap.get(el.part) || [];
    const a11yMods: string[] = [];
    const roleAttr = ariaAttrs.find(a => a.attr === 'role');
    if (roleAttr) a11yMods.push(`.accessibilityAddTraits(.is${capitalize(roleAttr.value)})`);
    const labelAttr = ariaAttrs.find(a => a.attr === 'label' || a.attr === 'aria-label');
    if (labelAttr) a11yMods.push(`.accessibilityLabel("${labelAttr.value}")`);

    const binds = c.bindMap.get(el.part) || [];
    const hasClick = binds.some(b => b.attr === 'onClick' || b.attr.startsWith('on'));

    if (hasClick) {
      const cb = binds.find(b => b.attr === 'onClick' || b.attr.startsWith('on'));
      const m = cb?.expr.match(/send\s*\(\s*(\w+)\s*\)/);
      const event = m ? m[1] : 'tap';
      lines.push(`            // ${el.part} (${el.role})`);
      lines.push(`            Button(action: { send("${event}") }) {`);
      lines.push(`                Text("TODO: ${el.part}")`);
      lines.push(`            }${a11yMods.join('')}`);
    } else {
      lines.push(`            // ${el.part} (${el.role})`);
      lines.push(`            Text("TODO: ${el.part}")${a11yMods.join('')}`);
    }
  }

  for (const comp of c.composes) {
    lines.push(`            // TODO: ${capitalize(comp.widget)} — slot: ${comp.slot}`);
  }

  lines.push(`        }`);

  // Keyboard shortcuts
  if (c.keyboards.length > 0) {
    for (const kb of c.keyboards) {
      const swKey = swiftKeyEquiv(kb.key);
      lines.push(`        .keyboardShortcut(${swKey}) // -> send("${kb.event}")`);
    }
  }

  // Focus
  if (c.focusConfig) {
    lines.push(`        .focused($isFocused)`);
    lines.push(`        .onAppear { isFocused = true }`);
  }

  lines.push(`    }`);
  lines.push('}');

  return { output: lines.join('\n'), trace: c.trace };
}

function swiftType(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'String';
  if (l === 'bool' || l === 'boolean') return 'Bool';
  if (l === 'int' || l === 'number' || l === 'integer') return 'Int';
  if (l.startsWith('list ')) return `[${swiftType(t.slice(5))}]`;
  if (l.startsWith('option ')) return `${swiftType(t.slice(7))}?`;
  return 'Any';
}

function swiftDefault(v: string, t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return `"${v}"`;
  if (v === 'true' || v === 'false') return v;
  if (/^\d+$/.test(v)) return v;
  if (v === '[]') return '[]';
  return `"${v}"`;
}

function swiftKeyEquiv(key: string): string {
  if (key === 'Enter') return '.return';
  if (key === 'Escape') return '.escape';
  if (key === 'Tab') return '.tab';
  if (key === 'Space') return '.space';
  if (key === 'ArrowUp') return '.upArrow';
  if (key === 'ArrowDown') return '.downArrow';
  return `KeyEquivalent("${key.charAt(0).toLowerCase()}")`;
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
