import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH'; query?: string }
  | { type: 'SELECT_VAR'; name?: string }
  | { type: 'ADD_WATCH'; name?: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function variableInspectorReducer(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      if (event.type === 'ADD_WATCH') return 'idle';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    default:
      return state;
  }
}

interface ProcessVariable {
  name: string;
  type: string;
  value: unknown;
  scope?: string;
  changed?: boolean;
}

interface WatchExpression {
  id: string;
  expression: string;
  value?: unknown;
}

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function typeBadge(type: string): string {
  const map: Record<string, string> = { string: 'str', number: 'num', boolean: 'bool', object: 'obj', array: 'arr' };
  return map[type.toLowerCase()] ?? type;
}

export const VariableInspector = defineComponent({
  name: 'VariableInspector',
  props: {
    variables: { type: Array as PropType<ProcessVariable[]>, required: true },
    runStatus: { type: String, required: true },
    showTypes: { type: Boolean, default: true },
    showWatch: { type: Boolean, default: true },
    expandDepth: { type: Number, default: 1 },
    watchExpressions: { type: Array as PropType<WatchExpression[]>, default: () => [] },
  },
  emits: ['selectVariable', 'addWatch', 'removeWatch', 'editValue'],
  setup(props, { emit }) {
    const state = ref<VariableInspectorState>('idle');
    const searchQuery = ref('');
    const selectedVar = ref<string | null>(null);
    const focusIndex = ref(0);

    function send(event: VariableInspectorEvent) {
      state.value = variableInspectorReducer(state.value, event);
    }

    const filtered = computed(() => {
      if (!searchQuery.value) return props.variables;
      const q = searchQuery.value.toLowerCase();
      return props.variables.filter((v) => v.name.toLowerCase().includes(q));
    });

    function handleSearch(val: string) {
      searchQuery.value = val;
      if (val) send({ type: 'SEARCH', query: val });
      else send({ type: 'CLEAR' });
    }

    function handleSelect(name: string) {
      selectedVar.value = name;
      send({ type: 'SELECT_VAR', name });
      emit('selectVariable', name);
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, filtered.value.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const v = filtered.value[focusIndex.value]; if (v) handleSelect(v.name); }
      if (e.key === 'Escape') { e.preventDefault(); selectedVar.value = null; send({ type: 'DESELECT' }); }
    }

    function renderValue(value: unknown, depth: number): any {
      if (value === null || value === undefined || typeof value !== 'object') {
        return h('span', { 'data-part': 'primitive-value' }, formatValue(value, depth, props.expandDepth));
      }
      const entries = Array.isArray(value)
        ? value.map((v, i) => [String(i), v] as const)
        : Object.entries(value as Record<string, unknown>);
      const label = Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`;

      // For simplicity use a collapsed view at max depth
      if (depth >= props.expandDepth) {
        return h('span', { 'data-part': 'complex-value' }, label);
      }

      return h('div', { 'data-part': 'complex-value', 'data-expanded': 'true' }, [
        h('span', {}, label),
        h('div', { 'data-part': 'nested-entries', role: 'group' },
          entries.map(([key, val]) => h('div', { key, 'data-part': 'nested-entry', style: { paddingLeft: `${(depth + 1) * 12}px` } }, [
            h('span', { 'data-part': 'entry-key' }, `${key}: `),
            renderValue(val, depth + 1),
          ]))),
      ]);
    }

    return () => {
      const children: any[] = [];

      // Search
      children.push(h('div', { 'data-part': 'search' }, [
        h('input', {
          type: 'search', 'data-part': 'search-input', placeholder: 'Filter variables...',
          value: searchQuery.value,
          onInput: (e: Event) => handleSearch((e.target as HTMLInputElement).value),
          'aria-label': 'Filter variables by name',
        }),
        searchQuery.value ? h('button', { type: 'button', 'data-part': 'search-clear', onClick: () => handleSearch(''), 'aria-label': 'Clear search' }, '\u2715') : null,
      ]));

      // Variable list
      children.push(h('div', { 'data-part': 'variable-list', role: 'list', 'aria-label': 'Variables' },
        filtered.value.length > 0
          ? filtered.value.map((variable, index) => {
              const isSelected = selectedVar.value === variable.name;
              const isFocused = focusIndex.value === index;
              const itemChildren: any[] = [
                h('span', { 'data-part': 'var-name' }, variable.name),
              ];
              if (props.showTypes) itemChildren.push(h('span', { 'data-part': 'var-type', 'data-type': variable.type }, typeBadge(variable.type)));
              if (variable.scope) itemChildren.push(h('span', { 'data-part': 'var-scope' }, variable.scope));
              itemChildren.push(h('div', { 'data-part': 'var-value' }, [renderValue(variable.value, 0)]));
              if (variable.changed) itemChildren.push(h('span', { 'data-part': 'changed-indicator', 'aria-label': 'Value changed' }, '\u2022'));

              return h('div', {
                key: variable.name, 'data-part': 'variable-item', role: 'listitem',
                'aria-selected': isSelected ? 'true' : 'false',
                'data-selected': isSelected ? 'true' : 'false',
                'data-changed': variable.changed ? 'true' : 'false',
                tabindex: isFocused ? 0 : -1,
                onClick: () => handleSelect(variable.name),
              }, itemChildren);
            })
          : [h('div', { 'data-part': 'empty-state', role: 'status' }, searchQuery.value ? 'No variables match the filter' : 'No variables available')]
      ));

      // Watch list
      if (props.showWatch) {
        children.push(h('div', { 'data-part': 'watch-list', 'data-visible': 'true' }, [
          h('div', { 'data-part': 'watch-header' }, [
            h('span', {}, 'Watch Expressions'),
            h('button', {
              type: 'button', 'data-part': 'add-watch', 'aria-label': 'Add watch expression',
              onClick: () => { const expr = selectedVar.value ?? ''; if (expr) { send({ type: 'ADD_WATCH', name: expr }); emit('addWatch', expr); } },
            }, '+ Watch'),
          ]),
          ...props.watchExpressions.map((w) => h('div', { key: w.id, 'data-part': 'watch-item', role: 'listitem' }, [
            h('span', { 'data-part': 'watch-expression' }, w.expression),
            h('span', { 'data-part': 'watch-value' }, w.value !== undefined ? formatValue(w.value, 0, 1) : 'evaluating...'),
            h('button', { type: 'button', 'data-part': 'remove-watch', onClick: () => emit('removeWatch', w.id), 'aria-label': `Remove watch: ${w.expression}` }, '\u2715'),
          ])),
        ]));
      }

      return h('div', {
        role: 'region',
        'aria-label': 'Variable inspector',
        'data-surface-widget': '',
        'data-widget-name': 'variable-inspector',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default VariableInspector;
