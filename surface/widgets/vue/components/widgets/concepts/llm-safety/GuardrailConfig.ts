import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type GuardrailConfigState = 'viewing' | 'ruleSelected' | 'testing' | 'adding';
export type GuardrailConfigEvent =
  | { type: 'SELECT_RULE'; id?: string }
  | { type: 'TEST' }
  | { type: 'ADD_RULE' }
  | { type: 'DESELECT' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function guardrailConfigReducer(state: GuardrailConfigState, event: GuardrailConfigEvent): GuardrailConfigState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SELECT_RULE') return 'ruleSelected';
      if (event.type === 'TEST') return 'testing';
      if (event.type === 'ADD_RULE') return 'adding';
      return state;
    case 'ruleSelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'viewing';
      return state;
    case 'adding':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

interface GuardrailRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'block' | 'warn' | 'log';
  description?: string;
  violations?: number;
}

const SEVERITIES = ['block', 'warn', 'log'] as const;
const SEVERITY_LABELS: Record<string, string> = { block: 'Block', warn: 'Warn', log: 'Log' };

export const GuardrailConfig = defineComponent({
  name: 'GuardrailConfig',
  props: {
    rules: { type: Array as PropType<GuardrailRule[]>, required: true },
    name: { type: String, required: true },
    guardrailType: { type: String, required: true },
    showHistory: { type: Boolean, default: true },
    showTest: { type: Boolean, default: true },
  },
  emits: ['toggleRule', 'updateSeverity', 'addRule', 'test', 'selectRule'],
  setup(props, { emit }) {
    const state = ref<GuardrailConfigState>('viewing');
    const selectedRuleId = ref<string | null>(null);
    const testInput = ref('');
    const testResult = ref<string | null>(null);
    const newRuleName = ref('');
    const focusIndex = ref(0);

    function send(event: GuardrailConfigEvent) {
      state.value = guardrailConfigReducer(state.value, event);
    }

    const selectedRule = computed(() => props.rules.find((r) => r.id === selectedRuleId.value));

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, props.rules.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const r = props.rules[focusIndex.value]; if (r) { selectedRuleId.value = r.id; send({ type: 'SELECT_RULE', id: r.id }); emit('selectRule', r.id); } }
      if (e.key === 'Escape') { e.preventDefault(); selectedRuleId.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'guardrail-name' }, props.name),
        h('div', { 'data-part': 'type-badge' }, props.guardrailType),
      ]));

      // Rule list
      children.push(h('div', { 'data-part': 'rule-list', role: 'list', 'aria-label': 'Guardrail rules' },
        props.rules.map((rule, index) => {
          const isSelected = selectedRuleId.value === rule.id;
          const isFocused = focusIndex.value === index;
          return h('div', {
            key: rule.id, 'data-part': 'rule-item',
            'data-selected': isSelected ? 'true' : 'false',
            'data-enabled': rule.enabled ? 'true' : 'false',
            role: 'listitem', tabindex: isFocused ? 0 : -1,
            onClick: () => { selectedRuleId.value = rule.id; send({ type: 'SELECT_RULE', id: rule.id }); emit('selectRule', rule.id); },
          }, [
            h('button', {
              type: 'button', 'data-part': 'rule-toggle', role: 'switch',
              'aria-checked': rule.enabled ? 'true' : 'false',
              'aria-label': `${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`,
              onClick: (e: Event) => { e.stopPropagation(); emit('toggleRule', rule.id, !rule.enabled); },
            }, rule.enabled ? '\u2713' : '\u25CB'),
            h('span', { 'data-part': 'rule-name' }, rule.name),
            h('select', {
              'data-part': 'rule-severity', value: rule.severity,
              onChange: (e: Event) => { e.stopPropagation(); emit('updateSeverity', rule.id, (e.target as HTMLSelectElement).value); },
              'aria-label': `Severity for ${rule.name}`,
              onClick: (e: Event) => e.stopPropagation(),
            }, SEVERITIES.map((s) => h('option', { value: s }, SEVERITY_LABELS[s]))),
            rule.description ? h('span', { 'data-part': 'rule-description' }, rule.description) : null,
            props.showHistory && rule.violations != null
              ? h('div', { 'data-part': 'rule-history' }, `${rule.violations} violations`)
              : null,
          ]);
        })));

      // Add button
      if (state.value === 'viewing') {
        children.push(h('button', {
          type: 'button', 'data-part': 'add-button',
          onClick: () => send({ type: 'ADD_RULE' }),
          'aria-label': 'Add new rule',
        }, '+ Add Rule'));
      }

      // Add form
      if (state.value === 'adding') {
        children.push(h('div', { 'data-part': 'add-form' }, [
          h('input', {
            type: 'text', 'data-part': 'new-rule-name', placeholder: 'Rule name',
            value: newRuleName.value,
            onInput: (e: Event) => { newRuleName.value = (e.target as HTMLInputElement).value; },
            'aria-label': 'New rule name',
          }),
          h('button', {
            type: 'button', 'data-part': 'save-rule',
            onClick: () => { emit('addRule', newRuleName.value); newRuleName.value = ''; send({ type: 'SAVE' }); },
          }, 'Save'),
          h('button', {
            type: 'button', 'data-part': 'cancel-add',
            onClick: () => { newRuleName.value = ''; send({ type: 'CANCEL' }); },
          }, 'Cancel'),
        ]));
      }

      // Test panel
      if (props.showTest) {
        children.push(h('div', { 'data-part': 'test-panel', 'data-visible': 'true' }, [
          h('textarea', {
            'data-part': 'test-input', placeholder: 'Enter text to test against rules...',
            value: testInput.value,
            onInput: (e: Event) => { testInput.value = (e.target as HTMLTextAreaElement).value; },
            'aria-label': 'Test input',
            rows: 3,
          }),
          h('button', {
            type: 'button', 'data-part': 'test-button',
            disabled: state.value === 'testing',
            onClick: () => { send({ type: 'TEST' }); emit('test', testInput.value); setTimeout(() => send({ type: 'TEST_COMPLETE' }), 500); },
          }, state.value === 'testing' ? 'Testing...' : 'Test'),
          testResult.value ? h('div', { 'data-part': 'test-result' }, testResult.value) : null,
        ]));
      }

      return h('div', {
        role: 'form',
        'aria-label': `Guardrail config: ${props.name}`,
        'data-surface-widget': '',
        'data-widget-name': 'guardrail-config',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default GuardrailConfig;
