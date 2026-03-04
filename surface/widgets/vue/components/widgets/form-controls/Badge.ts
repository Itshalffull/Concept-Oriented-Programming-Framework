// ============================================================
// Badge -- Vue 3 Component
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

export interface BadgeProps {
  /** Text content of the badge (count, status, or category) */
  label?: string;
  /** Visual variant */
  variant?: 'filled' | 'outline' | 'dot';
  /** Colour token */
  color?: string;
  /** Numeric cap -- values above this render as "max+" */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = defineComponent({
  name: 'Badge',

  props: {
    label: { type: String },
    variant: { type: String, default: 'filled' },
    color: { type: String },
    max: { type: Number },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {

    return (): VNode =>
      h('span', {
        'role': 'status',
        'aria-label': ariaLabel,
        'aria-live': 'polite',
        'data-surface-widget': '',
        'data-widget-name': 'badge',
        'data-part': 'root',
        'data-state': isDot ? 'dot' : displayState,
        'data-variant': props.variant,
        'data-size': props.size,
        'data-color': props.color,
      }, [
        !isDot ? h('span', { 'data-part': 'label', 'aria-hidden': isDot ? 'true' : 'false' }, [
            resolvedLabel,
          ]) : null,
      ]);
  },
});

export default Badge;