// React Native Target Interpreter — TypeScript/JSX with RN primitives

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates, isExpression, capitalize } from './_classify.js';

export function interpretReactNative(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'react-native');
  const lines: string[] = [];

  // Imports
  const rnImports = ['View', 'Text'];
  if (c.keyboards.length > 0 || c.bindMap.size > 0) rnImports.push('Pressable');
  lines.push(`import { ${rnImports.join(', ')} } from 'react-native';`);
  const reactImports = ['React'];
  if (c.states.length > 0) reactImports.push('useState');
  if (c.transitions.length > 0) reactImports.push('useCallback');
  if (c.focusConfig) reactImports.push('useRef', 'useEffect');
  lines.push(`import { ${reactImports.join(', ')} } from 'react';`);
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
    if (p.defaultValue) lines.push(`  const ${p.name} = props.${p.name} ?? ${fmtDef(p.defaultValue, p.propType)};`);
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

  // Focus
  if (c.focusConfig) {
    lines.push(`  const ${c.focusConfig.initialPart}Ref = useRef<View>(null);`);
    lines.push(`  useEffect(() => { /* requestFocus on ${c.focusConfig.initialPart} */ }, []);`);
    lines.push('');
  }

  // JSX
  lines.push('  return (');
  lines.push('    <>');
  for (const el of c.elements) {
    const a11y: string[] = [];
    a11y.push(`accessible={true}`);
    const ariaAttrs = c.ariaMap.get(el.part) || [];
    const roleAttr = ariaAttrs.find(a => a.attr === 'role');
    if (roleAttr) a11y.push(`accessibilityRole="${roleAttr.value}"`);
    const labelAttr = ariaAttrs.find(a => a.attr === 'label' || a.attr === 'aria-label');
    if (labelAttr) a11y.push(`accessibilityLabel="${labelAttr.value}"`);

    const binds = c.bindMap.get(el.part) || [];
    const hasClick = binds.some(b => b.attr === 'onClick' || b.attr.startsWith('on'));

    if (hasClick) {
      const cb = binds.find(b => b.attr === 'onClick' || b.attr.startsWith('on'));
      const m = cb?.expr.match(/send\s*\(\s*(\w+)\s*\)/);
      const event = m ? m[1] : 'press';
      lines.push(`      <Pressable onPress={() => send('${event}')} ${a11y.join(' ')} testID="${el.part}">`);
      lines.push(`        {/* TODO: ${el.part} (${el.role}) visual content */}`);
      lines.push(`      </Pressable>`);
    } else {
      lines.push(`      <View ${a11y.join(' ')} testID="${el.part}">`);
      lines.push(`        {/* TODO: ${el.part} (${el.role}) visual content */}`);
      lines.push(`      </View>`);
    }
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
  const l = t.toLowerCase();
  if (l === 'string') return 'string';
  if (l === 'bool' || l === 'boolean') return 'boolean';
  if (l === 'int' || l === 'number') return 'number';
  if (l.startsWith('list ')) return `${mapType(t.slice(5))}[]`;
  return t;
}
function fmtDef(v: string, t: string): string {
  if (v === 'true' || v === 'false' || /^\d+$/.test(v) || v === '[]') return v;
  return `'${v}'`;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
