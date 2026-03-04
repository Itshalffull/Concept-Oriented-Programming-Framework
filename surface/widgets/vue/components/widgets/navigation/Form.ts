// ============================================================
// Form -- Vue 3 Component
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

export interface FormProps {
  onSubmit?: (e: any) => Promise<void> | void;
  onReset?: () => void;
  onValidate?: () => Promise<string[]> | string[];
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  disabled?: boolean;
  noValidate?: boolean;
  submitLabel?: VNode | string;
  resetLabel?: VNode | string;
  showReset?: boolean;
  variant?: string;
  size?: string;
}

export const Form = defineComponent({
  name: 'Form',

  props: {
    onSubmit: { type: Function as PropType<(...args: any[]) => any> },
    onReset: { type: Function as PropType<(...args: any[]) => any> },
    onValidate: { type: Array as PropType<any[]> },
    validateOnBlur: { type: Boolean, default: true },
    validateOnChange: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    noValidate: { type: Boolean, default: false },
    submitLabel: { type: String, default: 'Submit' },
    resetLabel: { type: String, default: 'Reset' },
    showReset: { type: Boolean, default: false },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['reset'],

  setup(props, { slots, emit }) {
    const state = ref<any>(initialFormState);
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const errorSummaryRef = ref<any>(null);
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (props.disabled || isSubmitting) return;

        dispatch({ type: 'SUBMIT' });

        // Run validation
        if (props.onValidate) {
          try {
            const errors = await props.onValidate();
            if (errors && errors.length > 0) {
              dispatch({ type: 'INVALID', errors });
              return;
            }
          } catch {
            dispatch({ type: 'INVALID', errors: ['Validation failed'] });
            return;
          }
        }

        dispatch({ type: 'VALID' });

        // Run submission
        if (props.onSubmit) {
          try {
            await props.onSubmit(e);
            dispatch({ type: 'SUCCESS' });
          } catch {
            dispatch({ type: 'FAILURE', errors: ['Submission failed'] });
          }
        } else {
          dispatch({ type: 'SUCCESS' });
        }
      };
    const handleReset = () => {
      dispatch({ type: 'RESET' });
      props.onReset?.();
    };
    const isSubmitting = state.submission === 'submitting';
    const hasErrors = state.submission === 'error';

    return (): VNode =>
      h('form', {
        'role': 'form',
        'aria-label': 'Form',
        'aria-busy': isSubmitting ? 'true' : 'false',
        'noValidate': props.noValidate,
        'data-surface-widget': '',
        'data-widget-name': 'form',
        'data-part': 'root',
        'data-state': state.submission,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-variant': props.variant,
        'data-size': props.size,
        'onSubmit': handleSubmit,
        'onReset': handleReset,
      }, [
        h('div', { 'data-part': 'fields', 'data-state': state.submission }, slots.default?.()),
        hasErrors && state.errors.length > 0 ? h('div', {
            'ref': errorSummaryRef,
            'role': 'alert',
            'aria-live': 'assertive',
            'aria-label': 'Form errors',
            'data-part': 'error-summary',
          }, [
            h('ul', {}, [
              ...state.errors.map((error, i) => h('li', {}, [
                  error,
                ])),
            ]),
          ]) : null,
        h('div', { 'data-part': 'actions', 'data-state': state.submission }, [
          h('button', {
            'type': 'submit',
            'aria-disabled': isSubmitting || props.disabled ? 'true' : 'false',
            'disabled': isSubmitting || props.disabled,
            'data-part': 'submit-button',
            'data-state': state.submission,
          }, [
            props.submitLabel,
          ]),
          props.showReset ? h('button', {
              'type': 'reset',
              'aria-disabled': props.disabled ? 'true' : 'false',
              'disabled': props.disabled,
              'data-part': 'reset-button',
            }, [
              props.resetLabel,
            ]) : null,
        ]),
      ]);
  },
});

export default Form;