// WatchKit (watchOS) Target Interpreter — Swift WKInterfaceController

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretWatchKit(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'watchkit');
  const lines: string[] = [];

  lines.push(`import WatchKit`);
  lines.push(`import Foundation`);
  lines.push('');
  lines.push(`class ${componentName}Controller: WKInterfaceController {`);

  // IBOutlet stubs for anatomy parts
  for (const el of c.elements) {
    lines.push(`    @IBOutlet weak var ${el.part}Group: WKInterfaceGroup!`);
  }
  if (c.elements.length > 0) lines.push('');

  // Props as stored properties
  for (const p of c.props) {
    const swt = swiftType(p.propType);
    const def = p.defaultValue ? ` = ${swiftDefault(p.defaultValue, p.propType)}` : '!';
    lines.push(`    var ${p.name}: ${swt}${def}`);
  }
  if (c.props.length > 0) lines.push('');

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
    lines.push(`        updateUI()`);
    lines.push(`    }`);
    lines.push('');
  }

  // Lifecycle
  lines.push(`    override func awake(withContext context: Any?) {`);
  lines.push(`        super.awake(withContext: context)`);
  // Accessibility
  const rootAria = c.ariaMap.get(c.elements[0]?.part || 'root') || [];
  const labelAttr = rootAria.find(a => a.attr === 'label' || a.attr === 'aria-label');
  if (labelAttr) lines.push(`        setTitle("${labelAttr.value}")`);
  lines.push(`    }`);
  lines.push('');

  lines.push(`    override func willActivate() {`);
  lines.push(`        super.willActivate()`);
  lines.push(`        updateUI()`);
  lines.push(`    }`);
  lines.push('');

  // Update UI stub
  lines.push(`    private func updateUI() {`);
  for (const el of c.elements) {
    lines.push(`        // TODO: update ${el.part} (${el.role})`);
  }
  lines.push(`    }`);
  lines.push('');

  // IBAction stubs for bindings
  const clickBinds = [...c.bindMap.entries()].flatMap(([part, binds]) =>
    binds.filter(b => b.attr === 'onClick' || b.attr.startsWith('on')).map(b => ({ part, ...b }))
  );
  for (const cb of clickBinds) {
    const m = cb.expr.match(/send\s*\(\s*(\w+)\s*\)/);
    const event = m ? m[1] : 'tap';
    lines.push(`    @IBAction func ${cb.part}Tapped() {`);
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
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
