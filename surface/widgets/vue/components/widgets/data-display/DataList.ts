// ============================================================
// DataList -- Vue 3 Component
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

export interface DataListItem {
  label: string;
  value: string | VNode | string;
}

export interface DataListProps {
  items: DataListItem[];
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DataList = defineComponent({
  name: 'DataList',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    orientation: { type: String, default: 'horizontal' },
    ariaLabel: { type: String },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();

    return (): VNode =>
      h('div', {
        'role': 'listitem',
        'data-part': 'item',
        'data-orientation': props.orientation,
      }, [
        h('dt', {
          'id': termId,
          'role': 'term',
          'data-part': 'term',
        }, [
          item.label,
        ]),
        h('dd', {
          'role': 'definition',
          'data-part': 'detail',
          'aria-labelledby': termId,
        }, [
          item.value,
        ]),
      ]);
  },
});

export default DataList;