// ============================================================
// Skeleton -- Vue 3 Component
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

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  lines?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Skeleton = defineComponent({
  name: 'Skeleton',

  props: {
    variant: { type: String, default: 'text' },
    width: { type: String },
    height: { type: String },
    lines: { type: Number, default: 1 },
    animate: { type: Boolean, default: true },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const resolvedWidth = props.width || defaultDimensions[props.variant].width;
    const resolvedHeight = props.height || defaultDimensions[props.variant].height;

    return (): VNode =>
      h('div', {
        'role': 'presentation',
        'aria-hidden': 'true',
        'data-surface-widget': '',
        'data-widget-name': 'skeleton',
        'data-part': 'skeleton',
        'data-variant': props.variant,
        'data-animate': props.animate ? 'true' : 'false',
        'data-state': state.value,
        'data-size': props.size,
      }, [
        props.variant === 'text' ? Array.from({ length: props.lines }, (_, i) => (
            <div
              key={i}
              data-part="line"
              data-props.variant="text"
              data-visible="true"
              data-count={props.lines}
              aria-hidden="true"
              style={{ width: resolvedWidth, height: resolvedHeight }}
            />
          )) : null,
        props.variant === 'circular' ? h('div', {
            'data-part': 'circle',
            'data-variant': 'circular',
            'data-visible': 'true',
            'aria-hidden': 'true',
            'style': {
              width: resolvedWidth,
              height: resolvedHeight,
              borderRadius: '50%',
            },
          }) : null,
        props.variant === 'rectangular' ? h('div', {
            'data-part': 'rect',
            'data-variant': 'rectangular',
            'data-visible': 'true',
            'aria-hidden': 'true',
            'style': { width: resolvedWidth, height: resolvedHeight },
          }) : null,
        slots.default?.(),
      ]);
  },
});

export default Skeleton;