// ============================================================
// Svelte Target Interpreter
// ============================================================
//
// Transforms RenderProgram instructions into a Svelte component with:
// - Typed exported props
// - Reactive state variables for state machines
// - Keyboard event handlers
// - ARIA attributes on parts
// - Data attribute bindings from connect
// - Focus management
// - Composed widget slots
//
// Visual layout is a stub — each anatomy part gets a
// <div data-part="name"> placeholder.

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

export function interpretSvelte(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
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

  for (const instr of instructions) {
    trace.push(`[svelte] ${instr.tag}: ${JSON.stringify(instr)}`);
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
      case 'pure': trace.push(`[svelte] terminated: ${instr.output}`); break;
    }
  }

  const scriptLines: string[] = [];
  const templateLines: string[] = [];

  // --- Script ---
  scriptLines.push('<script lang="ts">');

  // Props
  for (const p of props) {
    const tsType = mapSvelteType(p.propType);
    const defaultExpr = p.defaultValue ? ` = ${formatDefault(p.defaultValue, p.propType)}` : '';
    scriptLines.push(`  export let ${p.name}: ${tsType}${defaultExpr};`);
  }
  if (props.length > 0) scriptLines.push('');

  // State variables
  const stateGroups = groupStates(states);
  for (const [group, groupStates] of stateGroups) {
    const initial = groupStates.find(s => s.initial) || groupStates[0];
    const varName = group || 'state';
    scriptLines.push(`  let ${varName} = '${initial.name}';`);
  }
  if (stateGroups.size > 0) scriptLines.push('');

  // Send function
  if (transitions.length > 0) {
    scriptLines.push(`  function send(event: string) {`);
    for (const [group] of stateGroups) {
      const varName = group || 'state';
      const groupTransitions = transitions.filter(t => {
        const prefix = group ? group + '.' : '';
        return t.fromState.startsWith(prefix) || (!group && !t.fromState.includes('.'));
      });
      if (groupTransitions.length > 0) {
        const byFrom = new Map<string, TransitionInfo[]>();
        for (const t of groupTransitions) {
          if (!byFrom.has(t.fromState)) byFrom.set(t.fromState, []);
          byFrom.get(t.fromState)!.push(t);
        }
        scriptLines.push(`    switch (${varName}) {`);
        for (const [from, trans] of byFrom) {
          scriptLines.push(`      case '${from}':`);
          for (const t of trans) {
            scriptLines.push(`        if (event === '${t.event}') { ${varName} = '${t.toState}'; return; }`);
          }
          scriptLines.push(`        break;`);
        }
        scriptLines.push(`    }`);
      }
    }
    scriptLines.push(`  }`);
    scriptLines.push('');
  }

  // Keyboard handler
  if (keyboards.length > 0) {
    scriptLines.push(`  function handleKeyDown(e: KeyboardEvent) {`);
    scriptLines.push(`    switch (e.key) {`);
    for (const kb of keyboards) {
      if (kb.key.includes('+')) {
        const [mod, k] = kb.key.split('+');
        scriptLines.push(`      case '${k}':`);
        scriptLines.push(`        if (e.${mod.toLowerCase()}Key) { send('${kb.event}'); e.preventDefault(); }`);
        scriptLines.push(`        break;`);
      } else {
        scriptLines.push(`      case '${kb.key}': send('${kb.event}'); e.preventDefault(); break;`);
      }
    }
    scriptLines.push(`    }`);
    scriptLines.push(`  }`);
    scriptLines.push('');
  }

  // Focus action
  if (focusConfig) {
    scriptLines.push(`  import { onMount } from 'svelte';`);
    scriptLines.push(`  let ${focusConfig.initialPart}El: HTMLDivElement;`);
    scriptLines.push(`  onMount(() => ${focusConfig.initialPart}El?.focus());`);
    scriptLines.push('');
  }

  scriptLines.push('</script>');

  // --- Template ---
  templateLines.push('');
  for (const el of elements) {
    const ariaAttrs = ariaMap.get(el.part) || [];
    const binds = bindMap.get(el.part) || [];
    const attrStrings: string[] = [];

    attrStrings.push(`data-part="${el.part}"`);
    attrStrings.push(`data-role="${el.role}"`);

    for (const a of ariaAttrs) {
      if (isExpression(a.value)) {
        attrStrings.push(`${a.attr}={/* ${a.value} */}`);
      } else {
        attrStrings.push(`${a.attr}="${a.value}"`);
      }
    }

    for (const b of binds) {
      if (b.attr === 'onClick' || b.attr.startsWith('on')) {
        if (b.expr.includes('send')) {
          const eventMatch = b.expr.match(/send\s*\(\s*(\w+)\s*\)/);
          const event = eventMatch ? eventMatch[1] : b.expr;
          attrStrings.push(`on:click={() => send('${event}')}`);
        }
      } else if (isExpression(b.expr)) {
        attrStrings.push(`${b.attr}={/* ${b.expr} */}`);
      } else {
        attrStrings.push(`${b.attr}="${b.expr}"`);
      }
    }

    if (keyboards.length > 0 && el === elements[0]) {
      attrStrings.push(`on:keydown={handleKeyDown}`);
    }

    if (focusConfig && el.part === focusConfig.initialPart) {
      attrStrings.push(`bind:this={${el.part}El}`);
      attrStrings.push(`tabindex="0"`);
    }

    const attrs = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';
    templateLines.push(`<div${attrs}>`);
    templateLines.push(`  <!-- TODO: ${el.part} (${el.role}) visual content -->`);
    templateLines.push(`</div>`);
  }

  for (const c of composes) {
    templateLines.push(`<!-- <${capitalize(c.widget)} /> — slot: ${c.slot} -->`);
  }

  return {
    output: [...scriptLines, ...templateLines].join('\n'),
    trace,
  };
}

function mapSvelteType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'string') return 'string';
  if (lower === 'bool' || lower === 'boolean') return 'boolean';
  if (lower === 'int' || lower === 'number') return 'number';
  if (lower.startsWith('list ')) return `${mapSvelteType(t.slice(5))}[]`;
  if (lower.startsWith('option ')) return `${mapSvelteType(t.slice(7))} | undefined`;
  if (lower.startsWith('union ')) {
    return t.slice(6).split('|').map(v => `'${v.trim()}'`).join(' | ');
  }
  return t;
}

function formatDefault(val: string, type: string): string {
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
