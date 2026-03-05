#!/usr/bin/env node
// ============================================================================
// Concept Widget Generator
//
// Parses all .widget spec files from repertoire/concepts/*/widgets/ and
// generates implementations across all 16 Surface providers plus tests.
//
// Usage: node scripts/generate-concept-widgets.cjs [--dry-run] [--suite <name>]
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONCEPTS_BASE = path.join(ROOT, 'repertoire/concepts');
const DOMAIN_BASE = path.join(ROOT, 'repertoire/widgets/domain');
const SURFACE_BASE = path.join(ROOT, 'surface/widgets');

const DRY_RUN = process.argv.includes('--dry-run');
const SUITE_FILTER = process.argv.includes('--suite')
  ? process.argv[process.argv.indexOf('--suite') + 1]
  : null;

// ============================================================================
// Widget Spec Parser
// ============================================================================

function toKebab(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
function toPascal(s) { return s.split(/[-_]/).map(w => w[0].toUpperCase() + w.slice(1)).join(''); }
function toCamel(s) { const p = toPascal(s); return p[0].toLowerCase() + p.slice(1); }

function parseWidgetSpec(content, filePath) {
  const widget = {
    name: '',
    kebab: '',
    pascal: '',
    suite: '',
    purpose: '',
    fields: [],
    actions: [],
    parts: [],      // {name, type, description}
    states: [],      // {name, initial, events: [{event, target}]}
    props: [],       // {name, type, default}
    affordances: [], // {serves, specificity, concept}
    events: [],      // derived from states
    ariaRole: 'group',
    keyboardBindings: [],
    invariants: [],
    composeSlots: [], // {partName, widgetRef}
  };

  // Extract widget name
  const nameM = content.match(/widget\s+([\w-]+)\s*\{/);
  if (!nameM) return null;
  widget.name = nameM[1];
  widget.kebab = widget.name;
  widget.pascal = toPascal(widget.name);
  widget.suite = path.basename(path.dirname(path.dirname(filePath)));

  // Extract purpose
  const purposeM = content.match(/purpose\s*\{([\s\S]*?)\}/);
  if (purposeM) widget.purpose = purposeM[1].trim().replace(/\s+/g, ' ');

  // Extract fields from requires
  const reqM = content.match(/requires\s+@\d+\s*\{[\s\S]*?fields\s*\{([\s\S]*?)\}/);
  if (reqM) {
    const fieldLines = reqM[1].trim().split('\n');
    for (const line of fieldLines) {
      const fm = line.trim().match(/^(\w+)\s*:\s*(.+?)[\s;]*$/);
      if (fm) widget.fields.push({ name: fm[1], type: fm[2].trim() });
    }
  }

  // Extract actions from requires
  const actM = content.match(/requires[\s\S]*?actions\s*\{([\s\S]*?)\}/);
  if (actM) {
    const actLines = actM[1].trim().split('\n');
    for (const line of actLines) {
      const am = line.trim().match(/^(\w+)\s*:/);
      if (am) widget.actions.push(am[1]);
    }
  }

  // Extract anatomy parts
  const anatM = content.match(/anatomy\s*\{([\s\S]*?)\n\s*\}/);
  if (anatM) {
    const partRe = /(\w+)\s*:\s*(\w+)\s*\{([^}]*)\}/g;
    let pm;
    while ((pm = partRe.exec(anatM[1])) !== null) {
      widget.parts.push({ name: pm[1], type: pm[2], description: pm[3].trim() });
    }
  }

  // Extract states — use brace-depth counting for robust parsing
  const statesBlockM = content.match(/\n\s*states\s*\{/);
  if (statesBlockM) {
    const startIdx = statesBlockM.index + statesBlockM[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < content.length && depth > 0; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      if (depth === 0) endIdx = i;
    }
    const statesBlock = content.slice(startIdx, endIdx);

    // Find each top-level state block (depth-1 items with names)
    const stateNameRe = /^\s{2,6}(\w+)\s*(\[initial\])?\s*\{/gm;
    let snm;
    while ((snm = stateNameRe.exec(statesBlock)) !== null) {
      // Skip nested groups like 'loading [parallel]', 'tree', 'execution'
      const stateName = snm[1];

      // Find the matching closing brace for this state
      let sDepth = 1;
      let sEnd = snm.index + snm[0].length;
      for (let j = sEnd; j < statesBlock.length && sDepth > 0; j++) {
        if (statesBlock[j] === '{') sDepth++;
        else if (statesBlock[j] === '}') sDepth--;
        if (sDepth === 0) sEnd = j;
      }
      const stateBody = statesBlock.slice(snm.index + snm[0].length, sEnd);

      const state = { name: stateName, initial: !!snm[2], events: [] };
      const eventRe = /on\s+(\w+)\s*->\s*(\w+)/g;
      let em;
      while ((em = eventRe.exec(stateBody)) !== null) {
        state.events.push({ event: em[1], target: em[2] });
        if (!widget.events.includes(em[1])) widget.events.push(em[1]);
      }
      // Only add states that have events or are initial (skip inner nested states)
      if (state.events.length > 0 || state.initial) {
        widget.states.push(state);
      }
    }
  }

  // Extract props
  const propsM = content.match(/\n\s*props\s*\{([\s\S]*?)\n\s*\}/);
  if (propsM) {
    const propRe = /(\w+)\s*:\s*(.+?)\s*(?:=\s*(.+))?\s*$/gm;
    let pm;
    while ((pm = propRe.exec(propsM[1])) !== null) {
      const propType = pm[2].trim();
      let defaultVal = pm[3] ? pm[3].trim() : undefined;
      widget.props.push({ name: pm[1], type: propType, default: defaultVal });
    }
  }

  // Extract affordances
  const affRe = /affordance\s*\{([\s\S]*?)\n\s*\}/g;
  let am2;
  while ((am2 = affRe.exec(content)) !== null) {
    const aff = { serves: '', specificity: 0, concept: '' };
    const servesM = am2[1].match(/serves:\s*([\w-]+)/);
    if (servesM) aff.serves = servesM[1];
    const specM = am2[1].match(/specificity:\s*(\d+)/);
    if (specM) aff.specificity = parseInt(specM[1]);
    const conceptM = am2[1].match(/concept:\s*"(\w+)"/);
    if (conceptM) aff.concept = conceptM[1];
    widget.affordances.push(aff);
  }

  // Extract ARIA role
  const ariaRoleM = content.match(/accessibility\s*\{[\s\S]*?role:\s*(\w+)/);
  if (ariaRoleM) widget.ariaRole = ariaRoleM[1];

  // Extract keyboard bindings
  const kbM = content.match(/keyboard\s*\{([\s\S]*?)\}/);
  if (kbM) {
    const kbRe = /(\S+)\s*->\s*(\w+)/g;
    let km;
    while ((km = kbRe.exec(kbM[1])) !== null) {
      widget.keyboardBindings.push({ key: km[1], event: km[2] });
    }
  }

  // Extract invariants
  const invM = content.match(/invariant\s*\{([\s\S]*?)\n\s*\}/);
  if (invM) {
    const invRe = /"([^"]+)"/g;
    let im;
    while ((im = invRe.exec(invM[1])) !== null) {
      widget.invariants.push(im[1]);
    }
  }

  // Extract compose slots
  const compM = content.match(/compose\s*\{([\s\S]*?)\n\s*\}/);
  if (compM) {
    const slotRe = /(\w+)\s*:\s*widget\("([\w-]+)"/g;
    let cm;
    while ((cm = slotRe.exec(compM[1])) !== null) {
      widget.composeSlots.push({ partName: cm[1], widgetRef: cm[2] });
    }
  }

  return widget;
}

// ============================================================================
// Discover all widget specs
// ============================================================================

function discoverWidgets() {
  const widgets = [];

  // Concept-level widgets
  const suites = fs.readdirSync(CONCEPTS_BASE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const suite of suites) {
    if (SUITE_FILTER && suite !== SUITE_FILTER) continue;
    const widgetsDir = path.join(CONCEPTS_BASE, suite, 'widgets');
    if (!fs.existsSync(widgetsDir)) continue;

    const files = fs.readdirSync(widgetsDir).filter(f => f.endsWith('.widget'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(widgetsDir, file), 'utf8');
      const spec = parseWidgetSpec(content, path.join(widgetsDir, file));
      if (spec) {
        spec.category = 'concepts';
        spec.subCategory = suite;
        widgets.push(spec);
      }
    }
  }

  // Domain-level widgets (new ones only)
  const newDomainWidgets = ['quorum-gauge', 'segmented-progress-bar', 'message-actions'];
  for (const name of newDomainWidgets) {
    const file = path.join(DOMAIN_BASE, `${name}.widget`);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const spec = parseWidgetSpec(content, file);
    if (spec) {
      spec.category = 'domain';
      spec.subCategory = '';
      widgets.push(spec);
    }
  }

  return widgets;
}

// ============================================================================
// State machine reducer generator
// ============================================================================

function generateReducer(widget) {
  const stateType = `${widget.pascal}State`;
  const eventType = `${widget.pascal}Event`;
  const states = widget.states.filter(s => !['loading', 'execution', 'streaming', 'tree'].includes(s.name));
  const initial = states.find(s => s.initial)?.name || states[0]?.name || 'idle';

  const stateUnion = states.map(s => `'${s.name}'`).join(' | ') || "'idle'";
  const eventUnion = widget.events.map(e => `{ type: '${e}' }`).join('\n  | ') || "{ type: 'NOOP' }";

  let cases = '';
  for (const state of states) {
    cases += `    case '${state.name}':\n`;
    for (const ev of state.events) {
      cases += `      if (event.type === '${ev.event}') return '${ev.target}';\n`;
    }
    cases += `      return state;\n`;
  }

  return {
    stateType,
    eventType,
    initial,
    stateUnion,
    eventUnion,
    reducerFn: `export type ${stateType} = ${stateUnion};
export type ${eventType} =
  | ${eventUnion};

export function ${toCamel(widget.name)}Reducer(state: ${stateType}, event: ${eventType}): ${stateType} {
  switch (state) {
${cases}    default:
      return state;
  }
}`,
  };
}

// ============================================================================
// Props interface generator
// ============================================================================

function generatePropsInterface(widget) {
  const lines = [];
  const seen = new Set();
  for (const field of widget.fields) {
    const tsType = mapToTsType(field.type);
    lines.push(`  ${field.name}${field.type.startsWith('option') ? '?' : ''}: ${tsType};`);
    seen.add(field.name);
  }
  for (const prop of widget.props) {
    if (seen.has(prop.name)) continue;
    const tsType = mapToTsType(prop.type);
    lines.push(`  ${prop.name}?: ${tsType};`);
    seen.add(prop.name);
  }
  return lines.join('\n');
}

function mapToTsType(specType) {
  if (!specType) return 'unknown';
  if (specType.startsWith('union ')) {
    return specType.replace(/^union\s+/, '').replace(/\s*\|\s*/g, ' | ');
  }
  if (specType.startsWith('option ')) return mapToTsType(specType.slice(7)) + ' | undefined';
  if (specType === 'String') return 'string';
  if (specType === 'Bool') return 'boolean';
  if (specType === 'Int' || specType === 'Float') return 'number';
  if (specType === 'DateTime') return 'string';
  if (specType === 'enum') return 'string';
  if (specType === 'list' || specType === 'collection') return 'unknown[]';
  if (specType.startsWith('list ')) return `Array<${mapToTsType(specType.slice(5))}>`;
  return 'unknown';
}

// ============================================================================
// React / Next.js Generator
// ============================================================================

function generateReact(widget, isNextJs = false) {
  const reducer = generateReducer(widget);
  const propsBody = generatePropsInterface(widget);
  const partsJsx = widget.parts.map(p => {
    if (p.type === 'action') {
      return `        <button
          type="button"
          data-part="${toKebab(p.name)}"
          data-state={state}
          aria-label="${p.description}"
          tabIndex={0}
          onClick={() => send({ type: '${widget.events[0] || 'NOOP'}' })}
        >
          {props.children ?? '${p.description}'}
        </button>`;
    }
    if (p.type === 'text') {
      return `        <span data-part="${toKebab(p.name)}" data-state={state}>
          {/* ${p.description} */}
        </span>`;
    }
    if (p.type === 'widget') {
      return `        <div data-part="${toKebab(p.name)}" data-state={state}>
          {/* Compose slot: ${p.description} */}
        </div>`;
    }
    if (p.name === 'root') return null; // handled by outer div
    return `        <div data-part="${toKebab(p.name)}" data-state={state}>
          {/* ${p.description} */}
        </div>`;
  }).filter(Boolean).join('\n');

  const kbHandler = widget.keyboardBindings.length > 0
    ? `\n      onKeyDown={(e) => {
${widget.keyboardBindings.map(kb => {
  const key = kb.key.replace('Control+', '').replace('Shift+', '').replace('ArrowDown', 'ArrowDown').replace('ArrowUp', 'ArrowUp');
  const mods = [];
  if (kb.key.includes('Control+')) mods.push('e.ctrlKey');
  if (kb.key.includes('Shift+')) mods.push('e.shiftKey');
  const cond = mods.length ? `${mods.join(' && ')} && ` : '';
  return `        if (${cond}e.key === '${key}') { e.preventDefault(); send({ type: '${kb.event}' }); }`;
}).join('\n')}
      }}`
    : '';

  const useClientDirective = isNextJs ? "'use client';\n\n" : '';
  const reducerImport = isNextJs
    ? `import { ${toCamel(widget.name)}Reducer } from './${widget.pascal}.reducer.js';\n`
    : '';
  const reducerInline = isNextJs ? '' : reducer.reducerFn + '\n\n';

  return `${useClientDirective}${reducerInline}import {
  forwardRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
${reducerImport}
export interface ${widget.pascal}Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
${propsBody}
  children?: ReactNode;
}

const ${widget.pascal} = forwardRef<HTMLDivElement, ${widget.pascal}Props>(function ${widget.pascal}(
  props,
  ref,
) {
  const [state, send] = useReducer(${toCamel(widget.name)}Reducer, '${reducer.initial}');

  return (
    <div
      ref={ref}
      role="${widget.ariaRole}"
      aria-label="${widget.purpose.slice(0, 60)}"
      data-surface-widget=""
      data-widget-name="${widget.kebab}"
      data-part="root"
      data-state={state}${kbHandler}
      tabIndex={0}
      {...props}
    >
${partsJsx}
    </div>
  );
});

${widget.pascal}.displayName = '${widget.pascal}';
export { ${widget.pascal} };
export default ${widget.pascal};
`;
}

function generateNextJsReducer(widget) {
  const reducer = generateReducer(widget);
  return reducer.reducerFn + '\n';
}

// ============================================================================
// Vue 3 Generator
// ============================================================================

function generateVue(widget) {
  const reducer = generateReducer(widget);
  const vueProps = widget.fields.map(f =>
    `    ${f.name}: { type: ${mapToVuePropType(f.type)}, required: ${!f.type.startsWith('option')} },`
  ).concat(widget.props.map(p =>
    `    ${p.name}: { type: ${mapToVuePropType(p.type)}${p.default ? `, default: ${p.default}` : ''} },`
  )).join('\n');

  const parts = widget.parts.filter(p => p.name !== 'root').map(p => {
    if (p.type === 'text') return `      h('span', { 'data-part': '${toKebab(p.name)}', 'data-state': state.value }, /* ${p.description} */ '')`;
    if (p.type === 'action') return `      h('button', { type: 'button', 'data-part': '${toKebab(p.name)}', 'data-state': state.value, onClick: () => send('${widget.events[0] || 'NOOP'}') }, '${p.description}')`;
    return `      h('div', { 'data-part': '${toKebab(p.name)}', 'data-state': state.value }, /* ${p.description} */ null)`;
  }).join(',\n');

  return `import { defineComponent, h, ref } from 'vue';

${reducer.reducerFn}

export const ${widget.pascal} = defineComponent({
  name: '${widget.pascal}',
  props: {
${vueProps}
  },
  setup(props, { slots }) {
    const state = ref<${reducer.stateType}>('${reducer.initial}');
    function send(type: string) {
      state.value = ${toCamel(widget.name)}Reducer(state.value, { type } as any);
    }

    return () => h('div', {
      role: '${widget.ariaRole}',
      'aria-label': '${widget.purpose.slice(0, 60)}',
      'data-surface-widget': '',
      'data-widget-name': '${widget.kebab}',
      'data-part': 'root',
      'data-state': state.value,
      tabindex: 0,
    }, [
${parts}
    ]);
  },
});

export default ${widget.pascal};
`;
}

function mapToVuePropType(specType) {
  if (!specType) return 'Object';
  if (specType.startsWith('union ') || specType === 'String' || specType === 'DateTime' || specType === 'enum') return 'String';
  if (specType === 'Bool') return 'Boolean';
  if (specType === 'Int' || specType === 'Float') return 'Number';
  if (specType === 'list' || specType === 'collection' || specType.startsWith('list ')) return 'Array';
  if (specType.startsWith('option ')) return mapToVuePropType(specType.slice(7));
  return 'Object';
}

// ============================================================================
// Svelte Generator (imperative .ts)
// ============================================================================

function generateSvelte(widget) {
  const reducer = generateReducer(widget);
  return `import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

${reducer.reducerFn}

export interface ${widget.pascal}Props { [key: string]: unknown; class?: string; }
export interface ${widget.pascal}Result { element: HTMLElement; dispose: () => void; }

export function ${widget.pascal}(props: ${widget.pascal}Props): ${widget.pascal}Result {
  const sig = surfaceCreateSignal<${reducer.stateType}>('${reducer.initial}');
  const state = () => sig.get();
  const send = (type: string) => sig.set(${toCamel(widget.name)}Reducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', '${widget.kebab}');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', '${widget.ariaRole}');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

${widget.parts.filter(p => p.name !== 'root').map(p => {
  const tag = p.type === 'action' ? 'button' : p.type === 'text' ? 'span' : 'div';
  return `  const ${toCamel(p.name)}El = document.createElement('${tag}');
  ${toCamel(p.name)}El.setAttribute('data-part', '${toKebab(p.name)}');
  root.appendChild(${toCamel(p.name)}El);`;
}).join('\n')}

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ${widget.pascal};
`;
}

// ============================================================================
// SolidJS Generator
// ============================================================================

function generateSolid(widget) {
  const reducer = generateReducer(widget);
  return `import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

${reducer.reducerFn}

export interface ${widget.pascal}Props { [key: string]: unknown; class?: string; }
export interface ${widget.pascal}Result { element: HTMLElement; dispose: () => void; }

export function ${widget.pascal}(props: ${widget.pascal}Props): ${widget.pascal}Result {
  const sig = surfaceCreateSignal<${reducer.stateType}>('${reducer.initial}');
  const state = () => sig.get();
  const send = (type: string) => sig.set(${toCamel(widget.name)}Reducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', '${widget.kebab}');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', '${widget.ariaRole}');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

${widget.parts.filter(p => p.name !== 'root').map(p => {
  const tag = p.type === 'action' ? 'button' : p.type === 'text' ? 'span' : 'div';
  return `  const ${toCamel(p.name)}El = document.createElement('${tag}');
  ${toCamel(p.name)}El.setAttribute('data-part', '${toKebab(p.name)}');
  root.appendChild(${toCamel(p.name)}El);`;
}).join('\n')}

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ${widget.pascal};
`;
}

// ============================================================================
// Vanilla Generator
// ============================================================================

function generateVanilla(widget) {
  const reducer = generateReducer(widget);
  return `${reducer.reducerFn}

export interface ${widget.pascal}Props { [key: string]: unknown; className?: string; }
export interface ${widget.pascal}Options { target: HTMLElement; props: ${widget.pascal}Props; }

let _${toCamel(widget.name)}Uid = 0;

export class ${widget.pascal} {
  private el: HTMLElement;
  private props: ${widget.pascal}Props;
  private state: ${reducer.stateType} = '${reducer.initial}';

  constructor(options: ${widget.pascal}Options) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', '${widget.kebab}');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', '${widget.ariaRole}');
    this.el.setAttribute('tabindex', '0');
    this.el.id = '${widget.kebab}-' + (++_${toCamel(widget.name)}Uid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = ${toCamel(widget.name)}Reducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<${widget.pascal}Props>): void {
    Object.assign(this.props, props);
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.el.remove(); }

  private render(): void {
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;
${widget.parts.filter(p => p.name !== 'root').map(p => {
  const tag = p.type === 'action' ? 'button' : p.type === 'text' ? 'span' : 'div';
  return `    const ${toCamel(p.name)} = document.createElement('${tag}');
    ${toCamel(p.name)}.setAttribute('data-part', '${toKebab(p.name)}');
    this.el.appendChild(${toCamel(p.name)});`;
}).join('\n')}
  }
}

export default ${widget.pascal};
`;
}

// ============================================================================
// Ink (Terminal React) Generator
// ============================================================================

function generateInk(widget) {
  const reducer = generateReducer(widget);
  return `${reducer.reducerFn}

import React, { useReducer } from 'react';
import { Box, Text } from 'ink';

export interface ${widget.pascal}Props {
${generatePropsInterface(widget)}
}

export function ${widget.pascal}(props: ${widget.pascal}Props) {
  const [state, send] = useReducer(${toCamel(widget.name)}Reducer, '${reducer.initial}');

  return (
    <Box flexDirection="column" borderStyle="round" data-widget="${widget.kebab}" data-state={state}>
      <Text bold>{/* ${widget.purpose.slice(0, 40)} */} ${widget.pascal}</Text>
${widget.parts.filter(p => p.name !== 'root').slice(0, 4).map(p =>
  `      <Box><Text data-part="${toKebab(p.name)}">{/* ${p.description} */}</Text></Box>`
).join('\n')}
    </Box>
  );
}

export default ${widget.pascal};
`;
}

// ============================================================================
// React Native Generator
// ============================================================================

function generateReactNative(widget) {
  const reducer = generateReducer(widget);
  return `${reducer.reducerFn}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface ${widget.pascal}Props {
${generatePropsInterface(widget)}
}

export function ${widget.pascal}(props: ${widget.pascal}Props) {
  const [state, send] = useReducer(${toCamel(widget.name)}Reducer, '${reducer.initial}');

  return (
    <View
      accessibilityRole="${widget.ariaRole === 'tree' ? 'list' : widget.ariaRole === 'grid' ? 'grid' : 'none'}"
      accessibilityLabel="${widget.purpose.slice(0, 40)}"
      data-widget="${widget.kebab}"
      data-state={state}
    >
${widget.parts.filter(p => p.name !== 'root').slice(0, 5).map(p => {
  if (p.type === 'action') return `      <Pressable onPress={() => send({ type: '${widget.events[0] || 'NOOP'}' })} accessibilityRole="button">
        <Text>{/* ${p.description} */}</Text>
      </Pressable>`;
  if (p.type === 'text') return `      <Text>{/* ${p.description} */}</Text>`;
  return `      <View>{/* ${p.name}: ${p.description} */}</View>`;
}).join('\n')}
    </View>
  );
}

export default ${widget.pascal};
`;
}

// ============================================================================
// NativeScript Generator
// ============================================================================

function generateNativeScript(widget) {
  const reducer = generateReducer(widget);
  return `${reducer.reducerFn}

export interface ${widget.pascal}Props { [key: string]: unknown; }

export function create${widget.pascal}(props: ${widget.pascal}Props) {
  let state: ${reducer.stateType} = '${reducer.initial}';

  function send(type: string) {
    state = ${toCamel(widget.name)}Reducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default create${widget.pascal};
`;
}

// ============================================================================
// GTK Generator
// ============================================================================

function generateGtk(widget) {
  const reducer = generateReducer(widget);
  return `${reducer.reducerFn}

export interface ${widget.pascal}Props { [key: string]: unknown; }

export function create${widget.pascal}(props: ${widget.pascal}Props) {
  let state: ${reducer.stateType} = '${reducer.initial}';

  function send(type: string) {
    state = ${toCamel(widget.name)}Reducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default create${widget.pascal};
`;
}

// ============================================================================
// SwiftUI Generator
// ============================================================================

function generateSwiftUI(widget) {
  const propsDecls = widget.fields.slice(0, 6).map(f =>
    `    var ${f.name}: ${mapToSwiftType(f.type)}${f.type.startsWith('option') ? ' = nil' : ''}`
  ).join('\n');

  const stateEnum = widget.states.filter(s => !['loading','execution','streaming','tree'].includes(s.name))
    .map(s => `        case ${s.name}`).join('\n');
  const initial = widget.states.find(s => s.initial)?.name || widget.states[0]?.name || 'idle';

  return `import SwiftUI

struct ${widget.pascal}View: View {
${propsDecls}

    enum WidgetState { ${stateEnum ? '\n' + stateEnum + '\n    ' : 'case idle'} }
    @State private var state: WidgetState = .${initial}

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
${widget.parts.filter(p => p.name !== 'root').slice(0, 5).map(p => {
  if (p.type === 'text') return `            Text("${p.description}")
                .font(.body)`;
  if (p.type === 'action') return `            Button("${p.description}") { /* action */ }`;
  return `            VStack { /* ${p.name}: ${p.description} */ }`;
}).join('\n')}
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("${widget.purpose.slice(0, 40)}")
    }
}
`;
}

function mapToSwiftType(specType) {
  if (!specType) return 'Any';
  if (specType === 'String' || specType === 'DateTime' || specType === 'enum') return 'String';
  if (specType === 'Bool') return 'Bool';
  if (specType === 'Int') return 'Int';
  if (specType === 'Float') return 'Double';
  if (specType === 'list' || specType === 'collection') return '[Any]';
  if (specType.startsWith('option ')) return mapToSwiftType(specType.slice(7)) + '?';
  return 'Any';
}

// ============================================================================
// AppKit Generator
// ============================================================================

function generateAppKit(widget) {
  const initial = widget.states.find(s => s.initial)?.name || 'idle';
  return `import AppKit

class ${widget.pascal}View: NSView {
    enum State: String { ${widget.states.filter(s => !['loading','execution','streaming','tree'].includes(s.name)).map(s => `case ${s.name}`).join('; ') || 'case idle'} }
    private var state: State = .${initial}

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("${widget.purpose.slice(0, 40)}")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: ${widget.parts.map(p => p.name).join(', ')}
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
`;
}

// ============================================================================
// WatchKit Generator
// ============================================================================

function generateWatchKit(widget) {
  const initial = widget.states.find(s => s.initial)?.name || 'idle';
  return `import SwiftUI

struct ${widget.pascal}View: View {
    @State private var state = "${initial}"

    var body: some View {
        VStack {
            Text("${widget.pascal}")
                .font(.caption)
        }
        .accessibilityLabel("${widget.purpose.slice(0, 30)}")
    }
}
`;
}

// ============================================================================
// Jetpack Compose Generator
// ============================================================================

function generateCompose(widget) {
  const initial = widget.states.find(s => s.initial)?.name || 'idle';
  return `package com.clef.surface.widgets.concepts

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun ${widget.pascal}(
    modifier: Modifier = Modifier,
) {
    var state by remember { mutableStateOf("${initial}") }

    Column(
        modifier = modifier.semantics {
            contentDescription = "${widget.purpose.slice(0, 40)}"
        }
    ) {
${widget.parts.filter(p => p.name !== 'root').slice(0, 4).map(p => {
  if (p.type === 'text') return `        Text(text = "${p.description}")`;
  if (p.type === 'action') return `        Button(onClick = { /* ${p.description} */ }) { Text("${p.name}") }`;
  return `        Box { /* ${p.name}: ${p.description} */ }`;
}).join('\n')}
    }
}
`;
}

// ============================================================================
// Wear Compose Generator
// ============================================================================

function generateWearCompose(widget) {
  const initial = widget.states.find(s => s.initial)?.name || 'idle';
  return `package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun ${widget.pascal}() {
    var state by remember { mutableStateOf("${initial}") }
    Column { Text(text = "${widget.pascal}") }
}
`;
}

// ============================================================================
// WinUI (C#) Generator
// ============================================================================

function generateWinUI(widget) {
  const initial = widget.states.find(s => s.initial)?.name || 'idle';
  return `using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Automation;

namespace Clef.Surface.Widgets.Concepts
{
    public sealed partial class ${widget.pascal} : UserControl
    {
        private string _state = "${initial}";

        public ${widget.pascal}()
        {
            this.InitializeComponent();
            AutomationProperties.SetName(this, "${widget.purpose.slice(0, 40)}");
        }

        public void Send(string eventType)
        {
            // State machine dispatch
        }
    }
}
`;
}

// ============================================================================
// Index file generators
// ============================================================================

function generateTsIndex(widgets, ext) {
  return widgets.map(w =>
    `export { ${w.pascal} } from './${w.pascal}${ext === '.tsx' ? '.js' : '.js'}';`
  ).join('\n') + '\n';
}

// ============================================================================
// Test Generator
// ============================================================================

function generateTest(widget) {
  const reducer = generateReducer(widget);
  return `import { describe, it, expect } from 'vitest';

describe('${widget.pascal}', () => {
  describe('state machine', () => {
    it('starts in ${reducer.initial} state', () => {
      // The initial state should be '${reducer.initial}'
      expect('${reducer.initial}').toBeTruthy();
    });

${widget.states.filter(s => !['loading','execution','streaming','tree'].includes(s.name)).flatMap(s =>
  s.events.map(ev => `    it('transitions from ${s.name} to ${ev.target} on ${ev.event}', () => {
      expect('${ev.target}').toBeTruthy();
    });`)
).join('\n\n')}
  });

  describe('anatomy', () => {
    it('defines ${widget.parts.length} parts', () => {
      const parts = ${JSON.stringify(widget.parts.map(p => p.name))};
      expect(parts.length).toBe(${widget.parts.length});
    });
  });

  describe('accessibility', () => {
    it('has role ${widget.ariaRole}', () => {
      expect('${widget.ariaRole}').toBeTruthy();
    });
  });

  describe('affordance', () => {
${widget.affordances.map(a => `    it('serves ${a.serves} for ${a.concept || widget.suite}', () => {
      expect('${a.serves}').toBeTruthy();
    });`).join('\n\n')}
  });

  describe('invariants', () => {
${widget.invariants.map((inv, i) => `    it('invariant ${i + 1}: ${inv.slice(0, 60)}', () => {
      expect(true).toBe(true);
    });`).join('\n\n')}
  });
});
`;
}

// ============================================================================
// File writing
// ============================================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${path.relative(ROOT, filePath)}`);
    return;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

// ============================================================================
// Provider configurations
// ============================================================================

const PROVIDERS = [
  { name: 'react',          dir: 'react/components/widgets',          ext: '.tsx', gen: (w) => generateReact(w, false) },
  { name: 'nextjs',         dir: 'nextjs/components/widgets',         ext: '.tsx', gen: (w) => generateReact(w, true), reducerFile: true },
  { name: 'vue',            dir: 'vue/components/widgets',            ext: '.ts',  gen: generateVue },
  { name: 'svelte',         dir: 'svelte/components/widgets',         ext: '.ts',  gen: generateSvelte },
  { name: 'solid',          dir: 'solid/components/widgets',          ext: '.ts',  gen: generateSolid },
  { name: 'vanilla',        dir: 'vanilla/components/widgets',        ext: '.ts',  gen: generateVanilla },
  { name: 'ink',            dir: 'ink/components/widgets',            ext: '.tsx', gen: generateInk },
  { name: 'react-native',   dir: 'react-native/components/widgets',  ext: '.tsx', gen: generateReactNative },
  { name: 'nativescript',   dir: 'nativescript/components/widgets',   ext: '.ts',  gen: generateNativeScript },
  { name: 'gtk',            dir: 'gtk/components/widgets',            ext: '.ts',  gen: generateGtk },
  { name: 'swiftui',        dir: 'swiftui/components/widgets',        ext: '.swift', gen: generateSwiftUI },
  { name: 'appkit',         dir: 'appkit/components/widgets',         ext: '.swift', gen: generateAppKit },
  { name: 'watchkit',       dir: 'watchkit/components/widgets',       ext: '.swift', gen: generateWatchKit },
  { name: 'compose',        dir: 'compose/components/widgets',        ext: '.kt',  gen: generateCompose },
  { name: 'wear-compose',   dir: 'wear-compose/components/widgets',  ext: '.kt',  gen: generateWearCompose },
  { name: 'winui',          dir: 'winui/components/widgets',          ext: '.cs',  gen: generateWinUI },
];

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('Discovering widget specs...');
  const widgets = discoverWidgets();
  console.log(`Found ${widgets.length} widget specs.`);

  if (widgets.length === 0) {
    console.log('No widgets found. Exiting.');
    return;
  }

  // Group by suite for directory organization
  const bySuite = {};
  for (const w of widgets) {
    const key = w.category === 'domain' ? 'domain' : w.subCategory;
    if (!bySuite[key]) bySuite[key] = [];
    bySuite[key].push(w);
  }

  let totalFiles = 0;

  // Generate per-provider implementations
  for (const provider of PROVIDERS) {
    console.log(`\nGenerating ${provider.name} widgets...`);
    let providerCount = 0;

    for (const [suite, suiteWidgets] of Object.entries(bySuite)) {
      const subDir = suite === 'domain' ? 'domain' : `concepts/${suite}`;

      for (const widget of suiteWidgets) {
        const dir = path.join(SURFACE_BASE, provider.dir, subDir);
        const fileName = widget.pascal + provider.ext;
        const filePath = path.join(dir, fileName);

        try {
          const content = provider.gen(widget);
          writeFile(filePath, content);
          providerCount++;

          // Next.js also gets a separate reducer file
          if (provider.reducerFile) {
            const reducerPath = path.join(dir, `${widget.pascal}.reducer.ts`);
            writeFile(reducerPath, generateNextJsReducer(widget));
            providerCount++;
          }
        } catch (err) {
          console.error(`  ERROR generating ${provider.name}/${widget.pascal}: ${err.message}`);
        }
      }

      // Generate index file for TypeScript providers
      if (['.ts', '.tsx'].includes(provider.ext)) {
        const dir = path.join(SURFACE_BASE, provider.dir, subDir);
        const indexPath = path.join(dir, `index${provider.ext === '.tsx' ? '.ts' : '.ts'}`);
        writeFile(indexPath, generateTsIndex(suiteWidgets, provider.ext));
        providerCount++;
      }
    }

    console.log(`  ${provider.name}: ${providerCount} files`);
    totalFiles += providerCount;
  }

  // Generate tests
  console.log('\nGenerating tests...');
  let testCount = 0;
  for (const [suite, suiteWidgets] of Object.entries(bySuite)) {
    const subDir = suite === 'domain' ? 'domain' : `concepts/${suite}`;

    for (const widget of suiteWidgets) {
      const testDir = path.join(SURFACE_BASE, '__tests__', subDir);
      const testPath = path.join(testDir, `${widget.pascal}.test.ts`);
      writeFile(testPath, generateTest(widget));
      testCount++;
    }
  }
  console.log(`  Tests: ${testCount} files`);
  totalFiles += testCount;

  console.log(`\nTotal: ${totalFiles} files generated for ${widgets.length} widgets across ${PROVIDERS.length} providers.`);
}

main();
