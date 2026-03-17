// WinUI 3 Target Interpreter — C# UserControl class

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretWinUI(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'winui');
  const lines: string[] = [];

  lines.push(`using Microsoft.UI.Xaml;`);
  lines.push(`using Microsoft.UI.Xaml.Controls;`);
  lines.push(`using Microsoft.UI.Xaml.Input;`);
  if (c.ariaMap.size > 0) lines.push(`using Microsoft.UI.Xaml.Automation;`);
  lines.push('');
  lines.push(`namespace Widgets`);
  lines.push(`{`);
  lines.push(`    public sealed partial class ${componentName} : UserControl`);
  lines.push(`    {`);

  // Props as dependency properties
  for (const p of c.props) {
    const csType = csType_(p.propType);
    const def = p.defaultValue ? csDefault(p.defaultValue, p.propType) : csTypeDefault(csType);
    lines.push(`        public ${csType} ${cap(p.name)} { get; set; } = ${def};`);
  }
  if (c.props.length > 0) lines.push('');

  // State fields
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`        private string _${v} = "${initial.name}";`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Constructor
  lines.push(`        public ${componentName}()`);
  lines.push(`        {`);
  lines.push(`            this.InitializeComponent();`);
  // Accessibility
  const rootAria = c.ariaMap.get(c.elements[0]?.part || 'root') || [];
  const labelAttr = rootAria.find(a => a.attr === 'label' || a.attr === 'aria-label');
  if (labelAttr) lines.push(`            AutomationProperties.SetName(this, "${labelAttr.value}");`);
  if (c.keyboards.length > 0) lines.push(`            this.KeyDown += OnKeyDown;`);
  if (c.focusConfig) lines.push(`            this.Loaded += (s, e) => this.Focus(FocusState.Programmatic);`);
  lines.push(`        }`);
  lines.push('');

  // Send
  if (c.transitions.length > 0) {
    lines.push(`        private void Send(string evt)`);
    lines.push(`        {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        const byFrom = groupBy(gt, t => t.fromState);
        lines.push(`            switch (_${v})`);
        lines.push(`            {`);
        for (const [from, trans] of byFrom) {
          lines.push(`                case "${from}":`);
          for (const t of trans) {
            lines.push(`                    if (evt == "${t.event}") { _${v} = "${t.toState}"; return; }`);
          }
          lines.push(`                    break;`);
        }
        lines.push(`            }`);
      }
    }
    lines.push(`        }`);
    lines.push('');
  }

  // Keyboard
  if (c.keyboards.length > 0) {
    lines.push(`        private void OnKeyDown(object sender, KeyRoutedEventArgs e)`);
    lines.push(`        {`);
    lines.push(`            switch (e.Key)`);
    lines.push(`            {`);
    for (const kb of c.keyboards) {
      lines.push(`                case Windows.System.VirtualKey.${winKey(kb.key)}: Send("${kb.event}"); e.Handled = true; break;`);
    }
    lines.push(`            }`);
    lines.push(`        }`);
    lines.push('');
  }

  // Click handlers
  const clickBinds = [...c.bindMap.entries()].flatMap(([part, binds]) =>
    binds.filter(b => b.attr === 'onClick' || b.attr.startsWith('on')).map(b => ({ part, ...b }))
  );
  for (const cb of clickBinds) {
    const m = cb.expr.match(/send\s*\(\s*(\w+)\s*\)/);
    const event = m ? m[1] : 'click';
    lines.push(`        private void ${cap(cb.part)}_Click(object sender, RoutedEventArgs e)`);
    lines.push(`        {`);
    lines.push(`            Send("${event}");`);
    lines.push(`        }`);
    lines.push('');
  }

  // Anatomy parts as comments (XAML would be separate)
  lines.push(`        // Anatomy parts (define in XAML):`);
  for (const el of c.elements) {
    lines.push(`        // <Border x:Name="${el.part}" Tag="${el.role}"> <!-- TODO: ${el.part} --> </Border>`);
  }
  for (const comp of c.composes) {
    lines.push(`        // TODO: Compose ${comp.widget} — slot: ${comp.slot}`);
  }

  lines.push(`    }`);
  lines.push(`}`);

  return { output: lines.join('\n'), trace: c.trace };
}

function csType_(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'string';
  if (l === 'bool' || l === 'boolean') return 'bool';
  if (l === 'int' || l === 'integer') return 'int';
  if (l === 'number') return 'double';
  return 'object';
}
function csDefault(v: string, t: string): string {
  if (t.toLowerCase() === 'string') return `"${v}"`;
  if (v === 'true' || v === 'false') return v;
  if (/^\d+$/.test(v)) return v;
  return `"${v}"`;
}
function csTypeDefault(csType: string): string {
  if (csType === 'string') return '""';
  if (csType === 'bool') return 'false';
  if (csType === 'int') return '0';
  if (csType === 'double') return '0.0';
  return 'null';
}
function winKey(key: string): string {
  if (key === 'Enter') return 'Enter';
  if (key === 'Escape') return 'Escape';
  if (key === 'Tab') return 'Tab';
  if (key === 'Space') return 'Space';
  if (key === 'ArrowUp') return 'Up';
  if (key === 'ArrowDown') return 'Down';
  return key;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
