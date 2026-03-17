// AppKit (macOS) Target Interpreter — Swift NSView subclass

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretAppKit(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'appkit');
  const lines: string[] = [];

  lines.push(`import AppKit`);
  lines.push('');
  lines.push(`class ${componentName}: NSView {`);

  // Props
  for (const p of c.props) {
    const swt = swiftType(p.propType);
    const def = p.defaultValue ? ` = ${swiftDefault(p.defaultValue, p.propType)}` : '!';
    lines.push(`    var ${p.name}: ${swt}${def}`);
  }
  if (c.props.length > 0) lines.push('');

  // Anatomy part views
  for (const el of c.elements) {
    lines.push(`    private lazy var ${el.part}View: NSView = {`);
    lines.push(`        let v = NSView()`);
    lines.push(`        v.translatesAutoresizingMaskIntoConstraints = false`);
    // Accessibility
    const ariaAttrs = c.ariaMap.get(el.part) || [];
    const roleAttr = ariaAttrs.find(a => a.attr === 'role');
    if (roleAttr) lines.push(`        v.setAccessibilityRole(.${mapNSRole(roleAttr.value)})`);
    const labelAttr = ariaAttrs.find(a => a.attr === 'label' || a.attr === 'aria-label');
    if (labelAttr) lines.push(`        v.setAccessibilityLabel("${labelAttr.value}")`);
    lines.push(`        return v`);
    lines.push(`    }()`);
  }
  if (c.elements.length > 0) lines.push('');

  // State
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`    private var ${v} = "${initial.name}"`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Send
  if (c.transitions.length > 0) {
    lines.push(`    func send(_ event: String) {`);
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
            lines.push(`        case "${from}" where event == "${t.event}": ${v} = "${t.toState}"`);
          }
        }
        lines.push(`        default: break`);
        lines.push(`        }`);
      }
    }
    lines.push(`        needsDisplay = true`);
    lines.push(`    }`);
    lines.push('');
  }

  // Init
  lines.push(`    override init(frame: NSRect) {`);
  lines.push(`        super.init(frame: frame)`);
  lines.push(`        configure()`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    required init?(coder: NSCoder) {`);
  lines.push(`        super.init(coder: coder)`);
  lines.push(`        configure()`);
  lines.push(`    }`);
  lines.push('');

  // Configure
  lines.push(`    private func configure() {`);
  for (const el of c.elements) {
    lines.push(`        addSubview(${el.part}View)`);
  }
  if (c.focusConfig) {
    lines.push(`        // Focus: ${c.focusConfig.strategy} on ${c.focusConfig.initialPart}`);
    lines.push(`        window?.makeFirstResponder(${c.focusConfig.initialPart}View)`);
  }
  lines.push(`    }`);
  lines.push('');

  // Keyboard
  if (c.keyboards.length > 0) {
    lines.push(`    override func keyDown(with event: NSEvent) {`);
    lines.push(`        switch event.keyCode {`);
    for (const kb of c.keyboards) {
      lines.push(`        case ${nsKeyCode(kb.key)}: send("${kb.event}") // ${kb.key}`);
    }
    lines.push(`        default: super.keyDown(with: event)`);
    lines.push(`        }`);
    lines.push(`    }`);
    lines.push('');
  }

  // Click actions
  const clickBinds = [...c.bindMap.entries()].flatMap(([part, binds]) =>
    binds.filter(b => b.attr === 'onClick' || b.attr.startsWith('on')).map(b => ({ part, ...b }))
  );
  for (const cb of clickBinds) {
    const m = cb.expr.match(/send\s*\(\s*(\w+)\s*\)/);
    const event = m ? m[1] : 'click';
    lines.push(`    @objc func ${cb.part}Clicked(_ sender: Any?) {`);
    lines.push(`        send("${event}")`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push('}');

  return { output: lines.join('\n'), trace: c.trace };
}

function swiftType(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'String';
  if (l === 'bool' || l === 'boolean') return 'Bool';
  if (l === 'int' || l === 'number') return 'Int';
  return 'Any';
}
function swiftDefault(v: string, t: string): string {
  if (t.toLowerCase() === 'string') return `"${v}"`;
  if (v === 'true' || v === 'false' || /^\d+$/.test(v)) return v;
  return `"${v}"`;
}
function mapNSRole(role: string): string {
  if (role === 'dialog') return 'dialog';
  if (role === 'button') return 'button';
  if (role === 'switch') return 'switch';
  return 'group';
}
function nsKeyCode(key: string): string {
  if (key === 'Enter') return '36';
  if (key === 'Escape') return '53';
  if (key === 'Tab') return '48';
  if (key === 'Space') return '49';
  return `0 /* ${key} */`;
}
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
