// Shared instruction classifier used by all interpreter targets.
// Avoids duplicating the same switch/case across 17 files.

import type { RenderInstruction } from '../render-program-builder.js';

export interface PropsInfo { name: string; propType: string; defaultValue: string }
export interface ElementInfo { part: string; role: string }
export interface StateInfo { name: string; initial: boolean }
export interface TransitionInfo { fromState: string; event: string; toState: string }
export interface AriaInfo { part: string; attr: string; value: string }
export interface KeyboardInfo { key: string; event: string }
export interface FocusInfo { strategy: string; initialPart: string }
export interface BindInfo { part: string; attr: string; expr: string }
export interface ComposeInfo { widget: string; slot: string }

export interface ClassifiedInstructions {
  props: PropsInfo[];
  elements: ElementInfo[];
  states: StateInfo[];
  transitions: TransitionInfo[];
  ariaMap: Map<string, AriaInfo[]>;
  keyboards: KeyboardInfo[];
  focusConfig: FocusInfo | null;
  bindMap: Map<string, BindInfo[]>;
  composes: ComposeInfo[];
  trace: string[];
}

export function classify(instructions: RenderInstruction[], tag: string): ClassifiedInstructions {
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
    trace.push(`[${tag}] ${instr.tag}: ${JSON.stringify(instr)}`);
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
      case 'pure': trace.push(`[${tag}] terminated: ${instr.output}`); break;
    }
  }

  return { props, elements, states, transitions, ariaMap, keyboards, focusConfig, bindMap, composes, trace };
}

export function capitalize(s: string): string {
  return s.replace(/(^|[-_])(\\w)/g, (_, __, c) => c.toUpperCase());
}

export function groupStates(states: StateInfo[]): Map<string, StateInfo[]> {
  const groups = new Map<string, StateInfo[]>();
  for (const s of states) {
    const dotIndex = s.name.indexOf('.');
    const group = dotIndex >= 0 ? s.name.substring(0, dotIndex) : '';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(s);
  }
  return groups;
}

export function isExpression(value: string): boolean {
  return value.includes('if ') || value.includes('concat') ||
    value.includes('self') || value.includes('state') ||
    value.includes('?') || value.includes('.') ||
    value.includes('==');
}
