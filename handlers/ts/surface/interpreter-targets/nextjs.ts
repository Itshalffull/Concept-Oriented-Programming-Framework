// Next.js Target Interpreter — Client component with 'use client'

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, isExpression, capitalize } from './_classify.js';

export function interpretNextjs(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'nextjs');
  const lines: string[] = [];

  lines.push(`'use client';`);
  lines.push('');

  // Imports
  const reactImports = ['React'];
  if (c.states.length > 0) reactImports.push('useState');
  if (c.keyboards.length > 0 || c.focusConfig) reactImports.push('useCallback');
  if (c.focusConfig) reactImports.push('useRef', 'useEffect');
  lines.push(`import { ${reactImports.join(', ')} } from 'react';`);
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
  const propsParam = c.props.length > 0 ? `props: ${componentName}Props` : '';
  lines.push(`export function ${componentName}(${propsParam}) {`);

  // Prop defaults
  for (const p of c.props) {
    if (p.defaultValue) {
      lines.push(`  const ${p.name} = props.${p.name} ?? ${formatDefault(p.defaultValue, p.propType)};`);
    }
  }
  if (c.props.some(p => p.defaultValue)) lines.push('');

  // State hooks
  const stateGroups = groupStates(c.states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const hookName = group || 'state';
    const setter = `set${hookName.charAt(0).toUpperCase() + hookName.slice(1)}`;
    lines.push(`  const [${hookName}, ${setter}] = useState<string>('${initial.name}');`);
  }
  if (stateGroups.size > 0) lines.push('');

  // Transition handler
  if (c.transitions.length > 0) {
    lines.push(`  const send = useCallback((event: string) => {`);
    for (const [group] of stateGroups) {
      const hookName = group || 'state';
      const setter = `set${hookName.charAt(0).toUpperCase() + hookName.slice(1)}`;
      const groupTransitions = c.transitions.filter(t => {
        const prefix = group ? group + '.' : '';
        return t.fromState.startsWith(prefix) || (!group && !t.fromState.includes('.'));
      });
      if (groupTransitions.length > 0) {
        lines.push(`    ${setter}(current => {`);
        lines.push(`      switch (current) {`);
        const byFrom = new Map<string, typeof groupTransitions>();
        for (const t of groupTransitions) {
          if (!byFrom.has(t.fromState)) byFrom.set(t.fromState, []);
          byFrom.get(t.fromState)!.push(t);
        }
        for (const [from, trans] of byFrom) {
          lines.push(`        case '${from}':`);
          for (const t of trans) {
            lines.push(`          if (event === '${t.event}') return '${t.toState}';`);
          }
          lines.push(`          return current;`);
        }
        lines.push(`        default: return current;`);
        lines.push(`      }`);
        lines.push(`    });`);
      }
    }
    lines.push(`  }, []);`);
    lines.push('');
  }

  // Keyboard
  if (c.keyboards.length > 0) {
    lines.push(`  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {`);
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
    lines.push(`  }, [send]);`);
    lines.push('');
  }

  // Focus
  if (c.focusConfig) {
    lines.push(`  const ${c.focusConfig.initialPart}Ref = useRef<HTMLDivElement>(null);`);
    lines.push(`  useEffect(() => { ${c.focusConfig.initialPart}Ref.current?.focus(); }, []);`);
    lines.push('');
  }

  // JSX
  lines.push('  return (');
  lines.push('    <>');
  for (const el of c.elements) {
    const attrs: string[] = [`data-part="${el.part}"`, `data-role="${el.role}"`];
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
      attrs.push(`ref={${el.part}Ref}`);
      attrs.push(`tabIndex={0}`);
    }
    if (c.focusConfig?.strategy === 'trap' && el === c.elements[0]) {
      attrs.push(`{/* focus-trap: ${c.focusConfig.strategy} */}`);
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
  lines.push('}');

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
