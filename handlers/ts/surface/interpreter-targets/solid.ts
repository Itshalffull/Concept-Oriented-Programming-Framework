// SolidJS Target Interpreter — TypeScript/JSX with signals

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, isExpression, capitalize } from './_classify.js';

export function interpretSolid(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'solid');
  const lines: string[] = [];

  // Imports
  const solidImports: string[] = ['Component'];
  if (c.states.length > 0) solidImports.push('createSignal');
  if (c.focusConfig) solidImports.push('onMount');
  lines.push(`import { ${solidImports.join(', ')} } from 'solid-js';`);
  lines.push('');

  // Props interface
  if (c.props.length > 0) {
    lines.push(`export interface ${componentName}Props {`);
    for (const p of c.props) {
      const tsType = mapType(p.propType);
      const opt = p.defaultValue ? '?' : '';
      lines.push(`  ${p.name}${opt}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Component
  const propsType = c.props.length > 0 ? `${componentName}Props` : '{}';
  lines.push(`export const ${componentName}: Component<${propsType}> = (props) => {`);

  // Prop defaults
  for (const p of c.props) {
    if (p.defaultValue) {
      lines.push(`  const ${p.name} = () => props.${p.name} ?? ${formatDefault(p.defaultValue, p.propType)};`);
    }
  }
  if (c.props.some(p => p.defaultValue)) lines.push('');

  // State signals
  const stateGroups = groupStates(c.states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const varName = group || 'state';
    const setter = `set${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
    lines.push(`  const [${varName}, ${setter}] = createSignal('${initial.name}');`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Transitions
  if (c.transitions.length > 0) {
    lines.push(`  const send = (event: string) => {`);
    for (const [group] of stateGroups) {
      const varName = group || 'state';
      const setter = `set${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
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
        lines.push(`    switch (${varName}()) {`);
        for (const [from, trans] of byFrom) {
          lines.push(`      case '${from}':`);
          for (const t of trans) {
            lines.push(`        if (event === '${t.event}') { ${setter}('${t.toState}'); return; }`);
          }
          lines.push(`        break;`);
        }
        lines.push(`    }`);
      }
    }
    lines.push(`  };`);
    lines.push('');
  }

  // Keyboard
  if (c.keyboards.length > 0) {
    lines.push(`  const handleKeyDown = (e: KeyboardEvent) => {`);
    lines.push(`    switch (e.key) {`);
    for (const kb of c.keyboards) {
      if (kb.key.includes('+')) {
        const [mod, k] = kb.key.split('+');
        lines.push(`      case '${k}':`);
        lines.push(`        if (e.${mod.toLowerCase()}Key) { send('${kb.event}'); e.preventDefault(); }`);
        lines.push(`        break;`);
      } else {
        lines.push(`      case '${kb.key}': send('${kb.event}'); e.preventDefault(); break;`);
      }
    }
    lines.push(`    }`);
    lines.push(`  };`);
    lines.push('');
  }

  // Focus
  if (c.focusConfig) {
    lines.push(`  let ${c.focusConfig.initialPart}El: HTMLDivElement | undefined;`);
    lines.push(`  onMount(() => ${c.focusConfig.initialPart}El?.focus());`);
    lines.push('');
  }

  // JSX
  lines.push('  return (');
  lines.push('    <>');

  for (const el of c.elements) {
    const attrs: string[] = [];
    attrs.push(`data-part="${el.part}"`);
    attrs.push(`data-role="${el.role}"`);

    for (const a of (c.ariaMap.get(el.part) || [])) {
      if (isExpression(a.value)) attrs.push(`${a.attr}={/* ${a.value} */}`);
      else attrs.push(`${a.attr}="${a.value}"`);
    }
    for (const b of (c.bindMap.get(el.part) || [])) {
      if (b.attr === 'onClick' || b.attr.startsWith('on')) {
        if (b.expr.includes('send')) {
          const m = b.expr.match(/send\s*\(\s*(\w+)\s*\)/);
          attrs.push(`onClick={() => send('${m ? m[1] : b.expr}')}`);
        }
      } else if (isExpression(b.expr)) attrs.push(`${b.attr}={/* ${b.expr} */}`);
      else attrs.push(`${b.attr}="${b.expr}"`);
    }
    if (c.keyboards.length > 0 && el === c.elements[0]) attrs.push(`onKeyDown={handleKeyDown}`);
    if (c.focusConfig && el.part === c.focusConfig.initialPart) {
      attrs.push(`ref={${el.part}El}`);
      attrs.push(`tabIndex={0}`);
    }

    lines.push(`      <div ${attrs.join(' ')}>`);
    lines.push(`        {/* TODO: ${el.part} (${el.role}) visual content */}`);
    lines.push(`      </div>`);
  }
  for (const comp of c.composes) {
    lines.push(`      {/* <${capitalize(comp.widget)} /> — slot: ${comp.slot} */}`);
  }

  lines.push('    </>');
  lines.push('  );');
  lines.push('};');

  return { output: lines.join('\n'), trace: c.trace };
}

function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'string') return 'string';
  if (lower === 'bool' || lower === 'boolean') return 'boolean';
  if (lower === 'int' || lower === 'number') return 'number';
  if (lower.startsWith('list ')) return `${mapType(t.slice(5))}[]`;
  if (lower.startsWith('option ')) return `${mapType(t.slice(7))} | undefined`;
  if (lower.startsWith('union ')) return t.slice(6).split('|').map(v => `'${v.trim()}'`).join(' | ');
  return t;
}

function formatDefault(val: string, type: string): string {
  if (val === '[]') return '[]';
  if (val === 'true' || val === 'false') return val;
  if (/^\d+$/.test(val)) return val;
  return `'${val}'`;
}
