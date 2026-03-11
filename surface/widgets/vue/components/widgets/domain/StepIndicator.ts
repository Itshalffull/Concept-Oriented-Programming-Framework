// ============================================================
// StepIndicator -- Vue 3 Component
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

export interface StepDef {
  label: string;
  description?: string;
}

export interface StepIndicatorProps {
  /** Zero-based index of the current step. */
  currentStep?: number;
  /** Array of step definitions. */
  steps: StepDef[];
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether steps are clickable to navigate. */
  clickable?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Called when a clickable step is selected. */
  onStepClick?: (index: number) => void;
  /** Custom render for step number. */
  renderStepNumber?: (index: number, status: StepStatus) => VNode | string;
}

export const StepIndicator = defineComponent({
  name: 'StepIndicator',

  props: {
    currentStep: { type: Number, default: 0 },
    steps: { type: Array as PropType<any[]>, required: true as const },
    orientation: { type: String, default: 'horizontal' },
    ariaLabel: { type: String, default: 'Progress' },
    clickable: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    onStepClick: { type: Function as PropType<(...args: any[]) => any> },
    renderStepNumber: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['step-click'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ currentStep: props.currentStep });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', { 'data-part': 'step-wrapper', 'data-orientation': props.orientation }, [
        h('div', {
          'role': 'listitem',
          'aria-current': status === 'current' ? 'step' : undefined,
          'aria-label': `Step ${index + 1} of ${steps.length}: ${step.label}, ${status}`,
          'data-part': 'step',
          'data-status': status,
          'data-index': index,
          'data-orientation': props.orientation,
          'data-clickable': props.clickable ? 'true' : 'false',
          'tabindex': status === 'current' ? 0 : -1,
          'onClick': () => handleStepClick(index),
          'onKeyDown': (e) => handleStepKeyDown(e, index),
        }, [
          h('span', {
            'data-part': 'step-number',
            'data-status': status,
            'aria-hidden': 'true',
          }, [
            props.renderStepNumber
                  ? props.renderStepNumber(index, status)
                  : status === 'completed'
                    ? '\u2713'
                    : index + 1,
          ]),
          h('span', { 'data-part': 'step-label', 'data-status': status }, [
            step.label,
          ]),
          step.description ? h('span', {
              'data-part': 'step-description',
              'data-visible': 'true',
              'data-status': status,
            }, [
              step.description,
            ]) : null,
        ]),
        !isLast ? h('div', {
            'data-part': 'connector',
            'data-status': index < activeStep ? 'completed' : 'upcoming',
            'data-orientation': props.orientation,
            'aria-hidden': 'true',
          }) : null,
      ]);
  },
});

export default StepIndicator;