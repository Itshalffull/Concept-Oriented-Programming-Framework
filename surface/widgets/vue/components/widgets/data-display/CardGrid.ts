// ============================================================
// CardGrid -- Vue 3 Component
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

export interface CardGridProps {
  columns?: number;
  gap?: number;
  minCardWidth?: string;
  ariaLabel?: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  emptyContent?: VNode | string;
}

export const CardGrid = defineComponent({
  name: 'CardGrid',

  props: {
    columns: { type: Number, default: 3 },
    gap: { type: Number, default: 16 },
    minCardWidth: { type: String, default: '280px' },
    ariaLabel: { type: String },
    loading: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    emptyContent: { type: null as unknown as PropType<any> },
  },

  setup(props, { slots, emit }) {
    const resolvedState = props.loading ? 'loading' : state.value;
    const isEmpty = !props.loading && !slots.default?.();

    return (): VNode =>
      h('div', {
        'role': 'list',
        'aria-label': props.ariaLabel,
        'aria-busy': props.loading ? 'true' : 'false',
        'data-surface-widget': '',
        'data-widget-name': 'card-grid',
        'data-part': 'root',
        'data-state': isEmpty ? 'empty' : resolvedState,
        'data-columns': props.columns,
        'data-gap': props.gap,
        'data-size': props.size,
        'style': {
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
          gap: `${gap}px`,
        },
      }, [
        isEmpty && props.emptyContent ? emptyContent : slots.default?.(),
      ]);
  },
});

export default CardGrid;