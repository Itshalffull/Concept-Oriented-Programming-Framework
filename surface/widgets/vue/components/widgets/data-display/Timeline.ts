// ============================================================
// Timeline -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface TimelineItem {
  id: string;
  label: string;
  start: string;
  end: string;
  dependencies?: string[];
}

export interface TimelineProps {
  items: TimelineItem[];
  scale?: 'day' | 'week' | 'month';
  ariaLabel?: string;
  resizable?: boolean;
  zoomLevel?: number;
  size?: 'sm' | 'md' | 'lg';
  onSelectItem?: (id: string) => void;
  onDeselectItem?: () => void;
}

export const Timeline = defineComponent({
  name: 'Timeline',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    scale: { type: String, default: 'week' },
    ariaLabel: { type: String, default: 'Timeline' },
    resizable: { type: Boolean, default: false },
    zoomLevel: { type: Number, default: 1.0 },
    size: { type: String, default: 'md' },
    onSelectItem: { type: Function as PropType<(...args: any[]) => any> },
    onDeselectItem: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['deselect-item', 'select-item'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>(timelineInitialState);
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleBarSelect = (id: string) => {
        if (state.selectedId === id) {
          dispatch({ type: 'DESELECT_BAR' });
          props.onDeselectItem?.();
        } else {
          dispatch({ type: 'SELECT_BAR', id });
          props.onSelectItem?.(id);
        }
      };

    const handleBarKeyDown = (e: any, id: string) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleBarSelect(id);
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'DESELECT_BAR' });
            props.onDeselectItem?.();
            break;
        }
      };

    return (): VNode =>
      h('li', {
        'role': 'row',
        'aria-label': item.label,
        'aria-rowindex': rowIndex + 1,
        'data-part': 'row',
      }, [
        h('span', { 'id': labelId, 'data-part': 'row-label' }, [
          item.label,
        ]),
        h('div', {
          'role': 'gridcell',
          'aria-label': `${item.label} from ${item.start} to ${item.end}`,
          'aria-selected': isSelected ? 'true' : 'false',
          'tabindex': isSelected ? 0 : -1,
          'data-part': 'bar',
          'data-state': isSelected ? 'selected' : isHovered ? 'hovered' : 'idle',
          'data-resizable': props.resizable ? 'true' : 'false',
          'onClick': () => handleBarSelect(item.id),
          'onMouseEnter': () => dispatch({ type: 'HOVER_BAR', id: item.id }),
          'onMouseLeave': () => dispatch({ type: 'UNHOVER_BAR' }),
          'onKeyDown': (e) => handleBarKeyDown(e, item.id),
        }),
        ...item.dependencies?.map((depId) => h('div', {
            'data-part': 'dependency-arrow',
            'data-from': depId,
            'data-to': item.id,
            'aria-hidden': 'true',
          })),
      ]);
  },
});

export default Timeline;