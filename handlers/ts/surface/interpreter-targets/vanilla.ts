// Vanilla Web Components Target Interpreter — Custom Elements + Shadow DOM

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, isExpression } from './_classify.js';

export function interpretVanilla(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'vanilla');
  const lines: string[] = [];
  const tagName = toKebab(componentName);

  lines.push(`// Web Component: <${tagName}>`);
  lines.push('');
  lines.push(`class ${componentName} extends HTMLElement {`);

  // Observed attributes from props
  if (c.props.length > 0) {
    lines.push(`  static get observedAttributes() {`);
    lines.push(`    return [${c.props.map(p => `'${toKebab(p.name)}'`).join(', ')}];`);
    lines.push(`  }`);
    lines.push('');
  }

  // Private state fields
  const stateGroups = groupStates(c.states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const varName = group || 'state';
    lines.push(`  private _${varName} = '${initial.name}';`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Constructor
  lines.push(`  constructor() {`);
  lines.push(`    super();`);
  lines.push(`    this.attachShadow({ mode: 'open' });`);
  lines.push(`  }`);
  lines.push('');

  // Prop getters
  for (const p of c.props) {
    const attr = toKebab(p.name);
    lines.push(`  get ${p.name}(): string { return this.getAttribute('${attr}') ?? '${p.defaultValue || ''}'; }`);
  }
  if (c.props.length > 0) lines.push('');

  // Send
  if (c.transitions.length > 0) {
    lines.push(`  private send(event: string): void {`);
    for (const [group] of stateGroups) {
      const varName = group || 'state';
      const groupTransitions = c.transitions.filter(t => {
        const prefix = group ? group + '.' : '';
        return t.fromState.startsWith(prefix) || (!group && !t.fromState.includes('.'));
      });
      if (groupTransitions.length > 0) {
        const byFrom = new Map<string, typeof groupTransitions>();
        for (const t of groupTransitions) {
          if (!byFrom.has(t.fromState)) byFrom.set(t.fromState, []);
          byFrom.get(t.fromState)!.push(t);
        }
        lines.push(`    switch (this._${varName}) {`);
        for (const [from, trans] of byFrom) {
          lines.push(`      case '${from}':`);
          for (const t of trans) {
            lines.push(`        if (event === '${t.event}') { this._${varName} = '${t.toState}'; this.render(); return; }`);
          }
          lines.push(`        break;`);
        }
        lines.push(`    }`);
      }
    }
    lines.push(`  }`);
    lines.push('');
  }

  // Keyboard handler
  if (c.keyboards.length > 0) {
    lines.push(`  private handleKeyDown(e: KeyboardEvent): void {`);
    lines.push(`    switch (e.key) {`);
    for (const kb of c.keyboards) {
      if (kb.key.includes('+')) {
        const [mod, k] = kb.key.split('+');
        lines.push(`      case '${k}':`);
        lines.push(`        if (e.${mod.toLowerCase()}Key) { this.send('${kb.event}'); e.preventDefault(); }`);
        lines.push(`        break;`);
      } else {
        lines.push(`      case '${kb.key}': this.send('${kb.event}'); e.preventDefault(); break;`);
      }
    }
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push('');
  }

  // connectedCallback
  lines.push(`  connectedCallback(): void {`);
  lines.push(`    this.render();`);
  if (c.keyboards.length > 0) {
    lines.push(`    this.addEventListener('keydown', (e) => this.handleKeyDown(e));`);
  }
  if (c.focusConfig) {
    lines.push(`    const el = this.shadowRoot?.querySelector('[data-part="${c.focusConfig.initialPart}"]') as HTMLElement;`);
    lines.push(`    el?.focus();`);
  }
  lines.push(`  }`);
  lines.push('');

  // attributeChangedCallback
  lines.push(`  attributeChangedCallback(): void { this.render(); }`);
  lines.push('');

  // render
  lines.push(`  private render(): void {`);
  lines.push(`    if (!this.shadowRoot) return;`);
  const htmlParts: string[] = [];
  for (const el of c.elements) {
    const attrs: string[] = [`data-part="${el.part}"`, `data-role="${el.role}"`];
    for (const a of (c.ariaMap.get(el.part) || [])) {
      if (!isExpression(a.value)) attrs.push(`${a.attr}="${a.value}"`);
    }
    if (c.focusConfig && el.part === c.focusConfig.initialPart) attrs.push(`tabindex="0"`);
    htmlParts.push(`      <div ${attrs.join(' ')}><!-- TODO: ${el.part} (${el.role}) --></div>`);
  }
  lines.push(`    this.shadowRoot.innerHTML = \``);
  lines.push(htmlParts.join('\n'));
  lines.push(`    \`;`);

  // Bind click handlers post-render
  const clickBinds = [...c.bindMap.entries()].flatMap(([part, binds]) =>
    binds.filter(b => b.attr === 'onClick' || b.attr.startsWith('on')).map(b => ({ part, ...b }))
  );
  for (const cb of clickBinds) {
    if (cb.expr.includes('send')) {
      const m = cb.expr.match(/send\s*\(\s*(\w+)\s*\)/);
      const event = m ? m[1] : cb.expr;
      lines.push(`    this.shadowRoot.querySelector('[data-part="${cb.part}"]')?.addEventListener('click', () => this.send('${event}'));`);
    }
  }

  lines.push(`  }`);
  lines.push('}');
  lines.push('');
  lines.push(`customElements.define('${tagName}', ${componentName});`);

  return { output: lines.join('\n'), trace: c.trace };
}

function toKebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
