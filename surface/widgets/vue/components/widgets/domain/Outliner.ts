// ============================================================
// Outliner -- Vue 3 Component
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

export interface OutlineItem {
  id: string;
  content: string;
  children?: OutlineItem[];
  collapsed?: boolean;
}

export interface OutlinerProps {
  /** Tree of outline items. */
  items: OutlineItem[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Current zoom path (item IDs from root to zoom target). */
  zoomPath?: string[];
  /** Read-only mode. */
  readOnly?: boolean;
  /** Enable collapsing. */
  collapsible?: boolean;
  /** Enable drag reorder. */
  draggable?: boolean;
  /** Placeholder for new items. */
  placeholder?: string;
  /** Show bullet indicators. */
  showBullets?: boolean;
  /** Called when items change. */
  onItemsChange?: (items: OutlineItem[]) => void;
  /** Called when zoom changes. */
  onZoomChange?: (path: string[]) => void;
  /** Called when collapse toggles. */
  onToggleCollapse?: (id: string) => void;
  /** Breadcrumb slot. */
  breadcrumb?: VNode | string;
}

export const Outliner = defineComponent({
  name: 'Outliner',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Outliner' },
    zoomPath: { type: Array as PropType<any[]>, default: () => ([]) },
    readOnly: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: true },
    draggable: { type: Boolean, default: true },
    placeholder: { type: String, default: 'New item...' },
    showBullets: { type: Boolean, default: true },
    onItemsChange: { type: Array as PropType<any[]> },
    onZoomChange: { type: Array as PropType<any[]> },
    onToggleCollapse: { type: Function as PropType<(...args: any[]) => any> },
    breadcrumb: { type: null as unknown as PropType<any> },
  },

  emits: ['zoom-change', 'toggle-collapse'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ drag: 'idle', focusedId: null });
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'tree',
        'aria-label': props.ariaLabel,
        'aria-multiselectable': false,
        'data-surface-widget': '',
        'data-widget-name': 'outliner',
        'data-zoom-depth': props.zoomPath.length,
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-draggable': props.draggable ? 'true' : 'false',
      }, [
        props.zoomPath.length > 0 ? h('div', {
            'data-part': 'breadcrumb',
            'data-visible': 'true',
            'aria-label': 'Zoom navigation',
          }, [
            props.breadcrumb,
          ]) : null,
        ...props.items.map((item, index) => h('OutlineItemNode', {
            'item': item,
            'depth': 1,
            'index': index,
            'siblingCount': props.items.length,
            'props': true,
            'readonly': props.readOnly,
            'props': true,
            'collapsible': props.collapsible,
            'props': true,
            'draggable': props.draggable,
            'props': true,
            'placeholder': props.placeholder,
            'props': true,
            'showBullets': props.showBullets,
            'onZoomIn': handleZoomIn,
            'props': true,
            'onToggleCollapse': handleToggleCollapse,
          })),
      ]);
  },
});

export default Outliner;