import { defineComponent, h, ref, computed, watch, nextTick, type PropType } from 'vue';

export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT'; value?: string }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT'; variable?: string }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

export const ExpressionToggleInput = defineComponent({
  name: 'ExpressionToggleInput',
  props: {
    value: { type: String, required: true },
    mode: { type: String, required: true },
    fieldType: { type: String as PropType<'text' | 'number' | 'boolean' | 'object'>, default: 'text' },
    variables: { type: Array as PropType<string[]>, default: () => [] },
    expression: { type: String, default: '' },
    previewValue: { type: String, default: undefined },
    expressionValid: { type: Boolean, default: undefined },
  },
  emits: ['change', 'expressionChange', 'toggleMode'],
  setup(props, { emit }) {
    const state = ref<ExpressionToggleInputState>('fixed');
    const fixedValue = ref(props.value);
    const expressionValue = ref(props.expression);
    const acQuery = ref('');
    const acIndex = ref(0);
    const expressionRef = ref<HTMLTextAreaElement | null>(null);

    function send(event: ExpressionToggleInputEvent) {
      state.value = expressionToggleInputReducer(state.value, event);
    }

    watch(() => props.value, (v) => { fixedValue.value = v; });
    watch(() => props.expression, (v) => { expressionValue.value = v; });

    watch(state, (s) => {
      if (s === 'expression' || s === 'autocompleting') {
        nextTick(() => expressionRef.value?.focus());
      }
    });

    const isExpressionMode = computed(() => state.value !== 'fixed');
    const suggestions = computed(() => {
      if (!acQuery.value) return props.variables;
      const q = acQuery.value.toLowerCase();
      return props.variables.filter((v) => v.toLowerCase().includes(q));
    });

    function handleToggle() {
      const newMode = state.value === 'fixed' ? 'expression' : 'fixed';
      send({ type: 'TOGGLE' });
      emit('toggleMode', newMode);
    }

    function handleFixedChange(val: string) {
      fixedValue.value = val;
      send({ type: 'INPUT', value: val });
      emit('change', val);
    }

    function handleExpressionChange(val: string) {
      expressionValue.value = val;
      send({ type: 'INPUT', value: val });
      emit('expressionChange', val);
      const lastWord = val.split(/[\s()+\-*/,]+/).pop() ?? '';
      if (lastWord.length > 0 && props.variables.some((v) => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
        acQuery.value = lastWord;
        acIndex.value = 0;
        send({ type: 'SHOW_AC' });
      }
    }

    function handleSelectSuggestion(variable: string) {
      const parts = expressionValue.value.split(/[\s()+\-*/,]+/);
      const lastPart = parts[parts.length - 1] ?? '';
      const newExpr = expressionValue.value.slice(0, expressionValue.value.length - lastPart.length) + variable;
      expressionValue.value = newExpr;
      emit('expressionChange', newExpr);
      send({ type: 'SELECT', variable });
      nextTick(() => expressionRef.value?.focus());
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'e') { e.preventDefault(); handleToggle(); return; }
      if (state.value === 'autocompleting') {
        if (e.key === 'ArrowDown') { e.preventDefault(); acIndex.value = Math.min(acIndex.value + 1, suggestions.value.length - 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); acIndex.value = Math.max(acIndex.value - 1, 0); return; }
        if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); const s = suggestions.value[acIndex.value]; if (s) handleSelectSuggestion(s); return; }
        if (e.key === 'Escape') { e.preventDefault(); send({ type: 'DISMISS' }); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); send({ type: 'DISMISS' }); }
    }

    function renderFixedInput() {
      switch (props.fieldType) {
        case 'boolean':
          return h('label', { 'data-part': 'boolean-label' }, [
            h('input', { type: 'checkbox', 'data-part': 'fixed-checkbox', checked: fixedValue.value === 'true', onChange: (e: Event) => handleFixedChange(String((e.target as HTMLInputElement).checked)), 'aria-label': 'Fixed boolean value' }),
            fixedValue.value === 'true' ? 'true' : 'false',
          ]);
        case 'number':
          return h('input', { type: 'number', 'data-part': 'fixed-number', value: fixedValue.value, onInput: (e: Event) => handleFixedChange((e.target as HTMLInputElement).value), 'aria-label': 'Fixed number value' });
        case 'object':
          return h('textarea', { 'data-part': 'fixed-object', value: fixedValue.value, onInput: (e: Event) => handleFixedChange((e.target as HTMLTextAreaElement).value), 'aria-label': 'Fixed object value (JSON)', rows: 4 });
        default:
          return h('input', { type: 'text', 'data-part': 'fixed-text', value: fixedValue.value, onInput: (e: Event) => handleFixedChange((e.target as HTMLInputElement).value), 'aria-label': 'Fixed text value' });
      }
    }

    return () => {
      const children: any[] = [];

      // Toggle
      children.push(h('button', {
        type: 'button', 'data-part': 'mode-toggle', role: 'switch',
        'aria-label': 'Expression mode', 'aria-checked': isExpressionMode.value ? 'true' : 'false',
        onClick: handleToggle,
      }, isExpressionMode.value ? 'Expression' : 'Fixed'));

      // Fixed input
      children.push(h('div', {
        'data-part': 'fixed-input', 'data-visible': !isExpressionMode.value ? 'true' : 'false',
        'aria-hidden': isExpressionMode.value ? 'true' : 'false',
      }, !isExpressionMode.value ? [renderFixedInput()] : null));

      // Expression editor
      children.push(h('div', {
        'data-part': 'expression-input', 'data-visible': isExpressionMode.value ? 'true' : 'false',
        'aria-hidden': !isExpressionMode.value ? 'true' : 'false',
      }, isExpressionMode.value ? [
        h('textarea', {
          ref: (el: any) => { expressionRef.value = el; },
          'data-part': 'expression-textarea', role: 'textbox',
          'aria-label': 'Expression editor', value: expressionValue.value,
          onInput: (e: Event) => handleExpressionChange((e.target as HTMLTextAreaElement).value),
          rows: 3, spellcheck: false,
        }),
      ] : null));

      // Autocomplete
      children.push(h('div', {
        'data-part': 'autocomplete', 'data-visible': state.value === 'autocompleting' ? 'true' : 'false',
        role: 'listbox', 'aria-label': 'Variable suggestions',
      }, state.value === 'autocompleting' ? [
        ...suggestions.value.map((variable, index) => h('div', {
          key: variable, 'data-part': 'autocomplete-item', role: 'option',
          'aria-selected': acIndex.value === index ? 'true' : 'false',
          'data-focused': acIndex.value === index ? 'true' : 'false',
          onClick: () => handleSelectSuggestion(variable),
          onMouseenter: () => { acIndex.value = index; },
        }, variable)),
        suggestions.value.length === 0 ? h('div', { 'data-part': 'autocomplete-empty', role: 'option', 'aria-disabled': 'true' }, 'No matching variables') : null,
      ] : null));

      // Preview
      children.push(h('div', { 'data-part': 'preview', role: 'status', 'aria-live': 'polite' }, [
        isExpressionMode.value && props.previewValue !== undefined ? h('span', { 'data-part': 'preview-value', 'data-valid': props.expressionValid !== false ? 'true' : 'false' }, props.previewValue) : null,
        isExpressionMode.value && props.previewValue === undefined && expressionValue.value ? h('span', { 'data-part': 'preview-placeholder' }, 'Enter expression to preview') : null,
      ]));

      return h('div', {
        role: 'group',
        'aria-label': 'Expression toggle input',
        'data-surface-widget': '',
        'data-widget-name': 'expression-toggle-input',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ExpressionToggleInput;
