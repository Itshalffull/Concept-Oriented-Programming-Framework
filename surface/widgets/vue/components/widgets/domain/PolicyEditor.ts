// ============================================================
// PolicyEditor -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface ServiceDef {
  name: string;
  actions: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface PolicyEditorProps {
  /** Policy object. */
  policy?: Record<string, unknown>;
  /** JSON string of policy. */
  policyJson?: string;
  /** Available services and their actions. */
  services: ServiceDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Editor mode. */
  mode?: 'visual' | 'json';
  /** Validation errors. */
  validationErrors?: ValidationError[];
  /** Simulation results. */
  simulationResults?: Record<string, unknown>;
  /** Called on mode change. */
  onModeChange?: (mode: 'visual' | 'json') => void;
  /** Called on policy change. */
  onPolicyChange?: (json: string) => void;
  /** Called on validate. */
  onValidate?: () => void;
  /** Called on simulate. */
  onSimulate?: () => void;
  /** Service selector slot. */
  serviceSelector?: VNode | string;
  /** Action selector slot. */
  actionSelector?: VNode | string;
  /** Resource selector slot. */
  resourceSelector?: VNode | string;
  /** JSON editor slot. */
  jsonEditor?: VNode | string;
}

export const PolicyEditor = defineComponent({
  name: 'PolicyEditor',

  props: {
    policy: { type: Object as PropType<any> },
    policyJson: { type: String, default: '{}' },
    services: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Policy Editor' },
    readOnly: { type: Boolean, default: false },
    mode: { type: String, default: 'visual' },
    validationErrors: { type: Array as PropType<any[]>, default: () => ([]) },
    simulationResults: { type: Object as PropType<any> },
    onModeChange: { type: Function as PropType<(...args: any[]) => any> },
    onPolicyChange: { type: Function as PropType<(...args: any[]) => any> },
    onValidate: { type: Function as PropType<(...args: any[]) => any> },
    onSimulate: { type: Function as PropType<(...args: any[]) => any> },
    serviceSelector: { type: null as unknown as PropType<any> },
    actionSelector: { type: null as unknown as PropType<any> },
    resourceSelector: { type: null as unknown as PropType<any> },
    jsonEditor: { type: null as unknown as PropType<any> },
  },

  emits: ['mode-change', 'policy-change', 'validate', 'simulate'],

  setup(props, { slots, emit }) {
    const state = ref<any>(props.mode === 'json' ? 'json' : 'visual');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': props.ariaLabel,
        'aria-roledescription': 'policy editor',
        'aria-busy': isBusy || undefined,
        'data-surface-widget': '',
        'data-widget-name': 'policy-editor',
        'data-state': state.value,
        'data-mode': props.mode,
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-valid': props.validationErrors.length === 0 ? 'true' : 'false',
      }, [
        h('div', {
          'data-part': 'mode-toggle',
          'data-mode': props.mode,
          'aria-label': 'Editor mode',
          'role': 'radiogroup',
        }, [
          h('button', {
            'type': 'button',
            'role': 'radio',
            'aria-checked': isVisual,
            'onClick': () => handleModeSwitch('visual'),
          }, 'Visual'),
          h('button', {
            'type': 'button',
            'role': 'radio',
            'aria-checked': !isVisual,
            'onClick': () => handleModeSwitch('json'),
          }, 'JSON'),
        ]),
        isVisual ? h('div', {
            'data-part': 'visual-editor',
            'role': 'form',
            'aria-label': 'Visual policy editor',
            'data-visible': 'true',
          }, [
            h('div', { 'data-part': 'service-selector', 'aria-label': 'Service' }, [
              props.serviceSelector,
            ]),
            h('div', {
              'data-part': 'action-selector',
              'role': 'group',
              'aria-label': 'Actions',
            }, [
              props.actionSelector,
            ]),
            h('div', { 'data-part': 'resource-selector', 'aria-label': 'Resource ARN pattern' }, [
              props.resourceSelector,
            ]),
          ]) : null,
        !isVisual ? h('div', {
            'data-part': 'json-editor',
            'role': 'textbox',
            'aria-label': 'JSON policy editor',
            'aria-multiline': 'true',
            'data-visible': 'true',
            'data-valid': props.validationErrors.length === 0 ? 'true' : 'false',
            'data-error-count': props.validationErrors.length,
            'contenteditable': !props.readOnly,
            'suppressContentEditableWarning': true,
            'onInput': (e) => props.onPolicyChange?.((e.target as HTMLElement).textContent ?? ''),
          }, [
            props.jsonEditor ?? props.policyJson,
          ]) : null,
        h('button', {
          'type': 'button',
          'role': 'button',
          'aria-label': 'Validate policy',
          'data-part': 'validate',
          'data-state': state.value === 'validating' ? 'loading' : 'idle',
          'aria-disabled': state.value === 'validating' || undefined,
          'onClick': () => { send({ type: 'VALIDATE' }); props.onValidate?.(); },
        }, 'Validate'),
        h('button', {
          'type': 'button',
          'role': 'button',
          'aria-label': 'Simulate policy',
          'data-part': 'simulate',
          'data-state': state.value === 'simulating' ? 'loading' : 'idle',
          'aria-disabled': state.value === 'simulating' || props.validationErrors.length > 0 || undefined,
          'onClick': () => { send({ type: 'SIMULATE' }); props.onSimulate?.(); },
        }, 'Simulate'),
        slots.default?.(),
      ]);
  },
});

export default PolicyEditor;