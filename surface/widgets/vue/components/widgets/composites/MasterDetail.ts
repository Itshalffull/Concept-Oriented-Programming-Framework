// ============================================================
// MasterDetail -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

export interface MasterDetailItem {
  id: string;
  title: string;
  meta?: string;
  [key: string]: unknown;
}

export interface MasterDetailProps {
  items?: MasterDetailItem[];
  selectedId?: string;
  orientation?: 'horizontal' | 'vertical';
  masterWidth?: string;
  minMasterWidth?: string;
  maxMasterWidth?: string;
  collapsible?: boolean;
  collapseBreakpoint?: number;
  showSearch?: boolean;
  resizable?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  renderDetail?: (item: MasterDetailItem) => VNode | string;
  renderListItem?: (item: MasterDetailItem) => VNode | string;
}

export const MasterDetail = defineComponent({
  name: 'MasterDetail',

  props: {
    items: { type: Array as PropType<any[]>, default: () => ([]) },
    selectedId: { type: String },
    orientation: { type: String, default: 'horizontal' },
    masterWidth: { type: String, default: '320px' },
    minMasterWidth: { type: String, default: '200px' },
    maxMasterWidth: { type: String, default: '500px' },
    collapsible: { type: Boolean, default: true },
    collapseBreakpoint: { type: Number, default: 768 },
    showSearch: { type: Boolean, default: false },
    resizable: { type: Boolean, default: true },
    loading: { type: Boolean, default: false },
    emptyTitle: { type: String, default: 'No item selected' },
    emptyDescription: { type: String, default: 'Select an item from the list to view details' },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onDeselect: { type: Function as PropType<(...args: any[]) => any> },
    renderDetail: { type: Function as PropType<(...args: any[]) => any> },
    renderListItem: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['select', 'deselect'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ selection: props.selectedId ? 'hasSelection' : 'noSelection', layout: 'split', stackedView: 'showingList', loading: props.loading ? 'loading' : 'idle', selectedId: props.selectedId ?? null, searchQuery: '', });
    const send = (action: any) => { /* state machine dispatch */ };
    const detailRef = ref<any>(null);
    const handleSelect = (id: string) => {
        send({ type: 'SELECT', id });
        props.onSelect?.(id);
        // Scroll detail to top
        detailRef.value?.scrollTo(0, 0);
      };

    const handleBack = () => {
      send({ type: 'BACK' });
      props.onDeselect?.();
    };
    const effectiveSelectedId = props.selectedId ?? state.value.selectedId;
    const selectedItem = props.items.find((item) => item.id === effectiveSelectedId);
    const hasSelection = Boolean(effectiveSelectedId && selectedItem);
    const masterHidden = state.value.layout === 'stacked' && state.value.stackedView === 'showingDetail';
    const detailHidden = state.value.layout === 'stacked' && state.value.stackedView === 'showingList';
    onMounted(() => {
      if (!props.collapsible) return;
      const checkWidth = () => {
      if (window.innerWidth < props.collapseBreakpoint) {
      send({ type: 'COLLAPSE' });
      } else {
      send({ type: 'EXPAND' });
      }
      };
      checkWidth();
      window.addEventListener('resize', checkWidth);
    });
    onUnmounted(() => {
      window.removeEventListener('resize', checkWidth)
    });

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-label': 'Master detail view',
        'data-surface-widget': '',
        'data-widget-name': 'master-detail',
        'data-part': 'root',
        'data-selection': hasSelection ? 'has-selection' : 'no-selection',
        'data-layout': state.value.layout,
        'data-orientation': props.orientation,
      }, [
        h('div', {
          'role': 'region',
          'aria-label': 'Item list',
          'data-part': 'master-pane',
          'data-width': props.masterWidth,
          'hidden': masterHidden,
        }, [
          h('div', { 'data-part': 'master-header' }, [
            props.showSearch ? h('input', {
                'type': 'search',
                'data-part': 'master-search',
                'placeholder': 'Search...',
                'aria-label': 'Search items',
                'value': state.value.searchQuery,
                'onChange': (e) => send({ type: 'SET_SEARCH', value: e.target.value }),
              }) : null,
          ]),
          h('div', {
            'role': 'listbox',
            'aria-label': 'Items',
            'aria-activedescendant': effectiveSelectedId ? `item-${effectiveSelectedId}` : undefined,
            'data-part': 'list',
          }, [
            filteredItems.map((item) => (
              <div
                key={item.id}
                role="option"
                aria-selected={item.id === effectiveSelectedId ? 'true' : 'false'}
                data-part="list-item"
                data-selected={item.id === effectiveSelectedId ? 'true' : 'false'}
                id={`item-${item.id}`}
                tabIndex={item.id === effectiveSelectedId ? 0 : -1}
                onClick={() => handleSelect(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(item.id);
                }}
              >
                {props.renderListItem ? (
                  props.renderListItem(item)
                ) : (
                  <>
                    <span data-part="list-item-title">{item.title}</span>
                    {item.meta ? h('span', { 'data-part': 'list-item-meta', 'aria-hidden': 'true' }, [
                item.meta,
              ]) : null,
          ]),
        ]),
        props.resizable && state.value.layout === 'split' ? h('div', {
            'role': 'separator',
            'aria-orientation': props.orientation === 'horizontal' ? 'vertical' : 'horizontal',
            'aria-label': 'Resize panels',
            'aria-valuemin': parseInt(props.minMasterWidth),
            'aria-valuemax': parseInt(props.maxMasterWidth),
            'aria-valuenow': parseInt(props.masterWidth),
            'data-part': 'splitter',
            'data-orientation': props.orientation,
            'tabindex': 0,
          }) : null,
        h('div', {
          'ref': detailRef,
          'role': 'region',
          'aria-label': 'Item details',
          'aria-live': 'polite',
          'aria-busy': props.loading ? 'true' : 'false',
          'data-part': 'detail-pane',
          'data-state': hasSelection ? 'has-selection' : 'no-selection',
          'hidden': detailHidden,
        }, [
          state.value.layout === 'stacked' && state.value.stackedView === 'showingDetail' ? h('button', {
              'type': 'button',
              'data-part': 'back-button',
              'aria-label': 'Back to list',
              'onClick': handleBack,
            }, 'Back') : null,
          hasSelection && selectedItem
            ? [
              h('div', { 'data-part': 'detail-header' }, [
                h('span', { 'data-part': 'detail-title' }, [
                  selectedItem.title,
                ]),
              ]),
              h('div', { 'data-part': 'detail-content' }, [
                props.renderDetail ? props.renderDetail(selectedItem) : slots.default?.(),
              ]),
              h('div', { 'data-part': 'detail-actions' }),
            ]
            : h('div', {
              'data-part': 'empty-detail',
              'role': 'status',
              'aria-label': 'No item selected',
            }, [
              h('h3', {}, [
                props.emptyTitle,
              ]),
              h('p', {}, [
                props.emptyDescription,
              ]),
            ]),
        ]),
      ]);
  },
});
  },
});))

export default MasterDetail;