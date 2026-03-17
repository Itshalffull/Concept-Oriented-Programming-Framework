// ============================================================
// React Target Interpreter
// ============================================================
//
// Transforms RenderProgram instructions into a TypeScript/React
// functional component with:
// - Typed props interface
// - useState hooks for state machines
// - Keyboard event handlers
// - ARIA attributes on parts
// - Data attribute bindings from connect
// - Focus management
// - Composed widget slots
//
// Visual layout (the actual JSX tree) is a stub — each anatomy
// part gets a <div data-part="name"> placeholder.

import type { RenderInstruction } from '../render-program-builder.js';

interface PropsInfo { name: string; propType: string; defaultValue: string }
interface ElementInfo { part: string; role: string }
interface StateInfo { name: string; initial: boolean }
interface TransitionInfo { fromState: string; event: string; toState: string }
interface AriaInfo { part: string; attr: string; value: string }
interface KeyboardInfo { key: string; event: string }
interface FocusInfo { strategy: string; initialPart: string }
interface BindInfo { part: string; attr: string; expr: string }
interface ComposeInfo { widget: string; slot: string }

export function interpretReact(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const trace: string[] = [];
  const props: PropsInfo[] = [];
  const elements: ElementInfo[] = [];
  const states: StateInfo[] = [];
  const transitions: TransitionInfo[] = [];
  const ariaMap = new Map<string, AriaInfo[]>();
  const keyboards: KeyboardInfo[] = [];
  let focusConfig: FocusInfo | null = null;
  const bindMap = new Map<string, BindInfo[]>();
  const composes: ComposeInfo[] = [];

  // Classify instructions
  for (const instr of instructions) {
    trace.push(`[react] ${instr.tag}: ${JSON.stringify(instr)}`);
    switch (instr.tag) {
      case 'prop': props.push(instr as unknown as PropsInfo); break;
      case 'element': elements.push(instr as unknown as ElementInfo); break;
      case 'stateDef': states.push(instr as unknown as StateInfo); break;
      case 'transition': transitions.push(instr as unknown as TransitionInfo); break;
      case 'aria': {
        const a = instr as unknown as AriaInfo;
        if (!ariaMap.has(a.part)) ariaMap.set(a.part, []);
        ariaMap.get(a.part)!.push(a);
        break;
      }
      case 'keyboard': keyboards.push(instr as unknown as KeyboardInfo); break;
      case 'focus': focusConfig = instr as unknown as FocusInfo; break;
      case 'bind': {
        const b = instr as unknown as BindInfo;
        if (!bindMap.has(b.part)) bindMap.set(b.part, []);
        bindMap.get(b.part)!.push(b);
        break;
      }
      case 'compose': composes.push(instr as unknown as ComposeInfo); break;
      case 'pure': trace.push(`[react] terminated: ${instr.output}`); break;
    }
  }

  const lines: string[] = [];

  // --- Imports ---
  const reactImports = ['React'];
  if (states.length > 0) reactImports.push('useState');
  if (keyboards.length > 0 || focusConfig) reactImports.push('useCallback');
  if (focusConfig) reactImports.push('useRef', 'useEffect');
  lines.push(`import { ${reactImports.join(', ')} } from 'react';`);
  lines.push('');

  // --- Props interface ---
  if (props.length > 0) {
    lines.push(`export interface ${componentName}Props {`);
    for (const p of props) {
      const tsType = mapPropType(p.propType);
      const optional = p.defaultValue ? '?' : '';
      lines.push(`  ${p.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // --- Component ---
  const propsParam = props.length > 0 ? `props: ${componentName}Props` : '';
  lines.push(`export function ${componentName}(${propsParam}) {`);

  // Prop defaults
  for (const p of props) {
    if (p.defaultValue) {
      const val = formatDefaultValue(p.defaultValue, p.propType);
      lines.push(`  const ${p.name} = props.${p.name} ?? ${val};`);
    }
  }
  if (props.some(p => p.defaultValue)) lines.push('');

  // --- State machine hooks ---
  // Group states by prefix (e.g., "row.selected" -> group "row")
  const stateGroups = groupStates(states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const hookName = group || 'state';
    const setterName = `set${capitalize(hookName)}`;
    lines.push(`  const [${hookName}, ${setterName}] = useState<string>('${initial.name}');`);
  }
  if (stateGroups.size > 0) lines.push('');

  // --- Transition handler ---
  if (transitions.length > 0) {
    lines.push(`  const send = useCallback((event: string) => {`);
    for (const [group] of stateGroups) {
      const hookName = group || 'state';
      const setterName = `set${capitalize(hookName)}`;
      const groupTransitions = transitions.filter(t => {
        const prefix = group ? group + '.' : '';
        return t.fromState.startsWith(prefix) || (!group && !t.fromState.includes('.'));
      });
      if (groupTransitions.length > 0) {
        lines.push(`    ${setterName}(current => {`);
        lines.push(`      switch (current) {`);
        // Group transitions by fromState
        const byFrom = new Map<string, TransitionInfo[]>();
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

  // --- Keyboard handler ---
  if (keyboards.length > 0) {
    lines.push(`  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {`);
    lines.push(`    switch (e.key) {`);
    for (const kb of keyboards) {
      const key = kb.key.replace('+', '');
      const hasModifier = kb.key.includes('+');
      if (hasModifier) {
        const [mod, k] = kb.key.split('+');
        lines.push(`      case '${k}':`);
        lines.push(`        if (e.${mod.toLowerCase()}Key) { send('${kb.event}'); e.preventDefault(); }`);
        lines.push(`        break;`);
      } else {
        lines.push(`      case '${key}': send('${kb.event}'); e.preventDefault(); break;`);
      }
    }
    lines.push(`    }`);
    lines.push(`  }, [send]);`);
    lines.push('');
  }

  // --- Focus ref ---
  if (focusConfig) {
    lines.push(`  const ${focusConfig.initialPart}Ref = useRef<HTMLDivElement>(null);`);
    lines.push(`  useEffect(() => { ${focusConfig.initialPart}Ref.current?.focus(); }, []);`);
    lines.push('');
  }

  // --- JSX ---
  lines.push('  return (');
  lines.push('    <>');

  for (const el of elements) {
    const ariaAttrs = ariaMap.get(el.part) || [];
    const binds = bindMap.get(el.part) || [];
    const attrStrings: string[] = [];

    attrStrings.push(`data-part="${el.part}"`);
    attrStrings.push(`data-role="${el.role}"`);

    // ARIA attributes
    for (const a of ariaAttrs) {
      if (isExpression(a.value)) {
        attrStrings.push(`${a.attr}={/* ${a.value} */}`);
      } else {
        attrStrings.push(`${a.attr}="${a.value}"`);
      }
    }

    // Connect bindings
    for (const b of binds) {
      if (b.attr === 'onClick' || b.attr.startsWith('on')) {
        if (b.expr.includes('send')) {
          const eventMatch = b.expr.match(/send\s*\(\s*(\w+)\s*\)/);
          const event = eventMatch ? eventMatch[1] : b.expr;
          attrStrings.push(`onClick={() => send('${event}')}`);
        }
      } else if (isExpression(b.expr)) {
        attrStrings.push(`${b.attr}={/* ${b.expr} */}`);
      } else {
        attrStrings.push(`${b.attr}="${b.expr}"`);
      }
    }

    // Keyboard handler on root
    if (keyboards.length > 0 && el === elements[0]) {
      attrStrings.push(`onKeyDown={handleKeyDown}`);
    }

    // Focus ref
    if (focusConfig && el.part === focusConfig.initialPart) {
      attrStrings.push(`ref={${el.part}Ref}`);
      attrStrings.push(`tabIndex={0}`);
    }

    // Focus trap
    if (focusConfig?.strategy === 'trap' && el === elements[0]) {
      attrStrings.push(`{/* focus-trap: ${focusConfig.strategy} */}`);
    }

    const attrs = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';
    lines.push(`      <div${attrs}>`);
    lines.push(`        {/* TODO: ${el.part} (${el.role}) visual content */}`);
    lines.push(`      </div>`);
  }

  // Composed widgets as slot placeholders
  for (const c of composes) {
    lines.push(`      {/* <${capitalize(c.widget)} /> — slot: ${c.slot} */}`);
  }

  lines.push('    </>');
  lines.push('  );');
  lines.push('}');

  return { output: lines.join('\n'), trace };
}

function mapPropType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'string') return 'string';
  if (lower === 'bool' || lower === 'boolean') return 'boolean';
  if (lower === 'int' || lower === 'number') return 'number';
  if (lower.startsWith('list ')) return `${mapPropType(t.slice(5))}[]`;
  if (lower.startsWith('option ')) return `${mapPropType(t.slice(7))} | undefined`;
  if (lower.startsWith('union ')) {
    return t.slice(6).split('|').map(v => `'${v.trim()}'`).join(' | ');
  }
  return t;
}

function formatDefaultValue(val: string, type: string): string {
  const lower = type.toLowerCase();
  if (lower === 'bool' || lower === 'boolean') return val;
  if (lower === 'int' || lower === 'number') return val;
  if (val === '[]') return '[]';
  if (val === 'true' || val === 'false') return val;
  if (/^\d+$/.test(val)) return val;
  return `'${val}'`;
}

function capitalize(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

function groupStates(states: StateInfo[]): Map<string, StateInfo[]> {
  const groups = new Map<string, StateInfo[]>();
  for (const s of states) {
    const dotIndex = s.name.indexOf('.');
    const group = dotIndex >= 0 ? s.name.substring(0, dotIndex) : '';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(s);
  }
  return groups;
}

function isExpression(value: string): boolean {
  return value.includes('if ') || value.includes('concat') ||
    value.includes('self') || value.includes('state') ||
    value.includes('?') || value.includes('.') ||
    value.includes('==');
}
