// ============================================================
// AutomationBuilder -- Vue 3 Component
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

export interface AutomationStep {
  type: string;
  config?: Record<string, unknown>;
  testResult?: { status: string; [k: string]: unknown };
}

export interface AutomationBuilderProps {
  /** Automation steps. */
  steps: AutomationStep[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Currently selected step index. */
  selectedStepIndex?: number;
  /** Whether testing is active. */
  testingActive?: boolean;
  /** Enable branching. */
  branchingEnabled?: boolean;
  /** Maximum steps. */
  maxSteps?: number;
  /** Automation name. */
  automationName?: string;
  /** Called on steps change. */
  onStepsChange?: (steps: AutomationStep[]) => void;
  /** Called on step select. */
  onStepSelect?: (index: number) => void;
  /** Called on add step. */
  onAddStep?: (afterIndex: number) => void;
  /** Called on test. */
  onTestAll?: () => void;
  /** Step config form slot. */
  stepConfigForm?: VNode | string;
  /** Step type picker slot. */
  stepTypePicker?: VNode | string;
}

export const AutomationBuilder = defineComponent({
  name: 'AutomationBuilder',

  props: {
    steps: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Automation Builder' },
    readOnly: { type: Boolean, default: false },
    selectedStepIndex: { type: Number },
    testingActive: { type: Boolean, default: false },
    branchingEnabled: { type: Boolean, default: true },
    maxSteps: { type: Number, default: 50 },
    automationName: { type: String, default: 'Untitled Automation' },
    onStepsChange: { type: Array as PropType<any[]> },
    onStepSelect: { type: Function as PropType<(...args: any[]) => any> },
    onAddStep: { type: Function as PropType<(...args: any[]) => any> },
    onTestAll: { type: Function as PropType<(...args: any[]) => any> },
    stepConfigForm: { type: null as unknown as PropType<any> },
    stepTypePicker: { type: null as unknown as PropType<any> },
  },

  emits: ['step-select', 'add-step'],

  setup(props, { slots, emit }) {
    const state = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {}, [
        index > 0 ? h('div', {
            'data-part': 'connector',
            'aria-hidden': 'true',
            'data-between': `${index - 1}-${index}`,
          }) : null,
        h('div', {
          'role': 'listitem',
          'aria-label': `Step ${index}: ${step.type}`,
          'aria-grabbed': state.value === 'reordering' && isSelected ? true : undefined,
          'aria-current': isSelected ? 'step' : undefined,
          'data-step-index': index,
          'data-step-type': step.type,
          'data-configured': step.config ? 'true' : 'false',
          'data-test-status': step.testResult?.status ?? 'none',
          'data-part': 'step',
          'tabindex': isSelected ? 0 : -1,
          'onClick': () => { send({ type: 'SELECT_STEP', index }); props.onStepSelect?.(index); },
          'onDoubleClick': () => send({ type: 'CONFIGURE' }),
          'onKeyDown': (e) => handleStepKeyDown(e, index),
        }, [
          h('span', {
            'data-part': 'step-icon',
            'data-type': step.type,
            'aria-hidden': 'true',
          }),
          h('span', { 'data-part': 'step-type' }, [
            step.type,
          ]),
          h('div', {
            'data-part': 'step-config',
            'role': 'region',
            'aria-label': `Configuration for step ${index}`,
            'data-state': state.value === 'configuring' && isSelected ? 'editing' : 'summary',
          }, [
            state.value === 'configuring' && isSelected && props.stepConfigForm,
          ]),
          step.testResult ? h('div', {
              'data-part': 'test-panel',
              'role': 'region',
              'aria-label': `Test results for step ${index}`,
              'aria-live': 'polite',
              'data-status': step.testResult.status,
              'data-visible': 'true',
            }) : null,
        ]),
        !props.readOnly && props.steps.length < props.maxSteps ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': `Add step after step ${index}`,
            'data-part': 'add-step',
            'data-after-index': index,
            'data-visible': 'true',
            'onClick': () => { send({ type: 'ADD_STEP' }); props.onAddStep?.(index); },
          }, '+') : null,
        props.branchingEnabled && !props.readOnly ? h('button', {
            'type': 'button',
            'role': 'button',
            'aria-label': 'Add conditional branch',
            'data-part': 'branch-button',
            'data-visible': 'true',
          }, 'Branch') : null,
      ]);
  },
});

export default AutomationBuilder;