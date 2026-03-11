// ============================================================
// ProgressBar -- Vue 3 Component
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

export interface ProgressBarProps {
  /** Current progress value. Omit for indeterminate mode. */
  value?: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Visible label describing the progress */
  label?: string;
  /** Show the numeric value text */
  showValueText?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar = defineComponent({
  name: 'ProgressBar',

  props: {
    value: { type: Number },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    label: { type: String },
    showValueText: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('div', {
        'role': 'progressbar',
        'aria-label': props.label ?? 'Progress',
        'aria-valuenow': isIndeterminate ? undefined : props.value,
        'aria-valuemin': props.min,
        'aria-valuemax': props.max,
        'aria-valuetext': valueText,
        'aria-busy': isIndeterminate ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'progress-bar',
        'data-part': 'root',
        'data-state': dataState,
        'data-value': props.value,
        'data-size': props.size,
      }, [
        props.label ? h('span', { 'data-part': 'label' }, [
            props.label,
          ]) : null,
        h('div', { 'data-part': 'track', 'data-state': isIndeterminate ? 'indeterminate' : 'determinate' }, [
          h('div', {
            'data-part': 'fill',
            'data-state': isIndeterminate ? 'indeterminate' : 'determinate',
            'data-animation': isIndeterminate ? 'indeterminate' : 'none',
            'style': { width: fillWidth },
          }),
        ]),
        props.showValueText && !isIndeterminate ? h('span', { 'data-part': 'valueText', 'aria-hidden': 'true' }, [
            valueText,
          ]) : null,
      ]);
  },
});

export default ProgressBar;