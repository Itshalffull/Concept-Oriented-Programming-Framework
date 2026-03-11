// ============================================================
// FacetedSearch -- Vue 3 Component
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

export interface FacetDef {
  key: string;
  name: string;
  type: 'checkbox' | 'radio' | 'range';
  items?: FacetItemDef[];
  min?: number;
  max?: number;
}

export interface FacetItemDef {
  value: string;
  label: string;
  count: number;
}

export interface ActiveFilter {
  facetKey: string;
  facetName: string;
  value: string;
  displayValue: string;
}

export interface FacetedSearchProps {
  query?: string;
  facets: FacetDef[];
  activeFilters?: ActiveFilter[];
  results?: Record<string, unknown>[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  facetTruncateAt?: number;
  showResultCount?: boolean;
  showPagination?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  onChange?: (query: string, filters: ActiveFilter[]) => void;
  onSearch?: (query: string) => void;
  onPageChange?: (page: number) => void;
  renderResult?: (result: Record<string, unknown>, index: number) => VNode | string;
  renderFacetItem?: (item: FacetItemDef, active: boolean) => VNode | string;
}

export const FacetedSearch = defineComponent({
  name: 'FacetedSearch',

  props: {
    query: { type: String, default: '' },
    facets: { type: Array as PropType<any[]>, required: true as const },
    activeFilters: { type: Array as PropType<any[]>, default: () => ([]) },
    results: { type: Array as PropType<any[]>, default: () => ([]) },
    totalCount: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    loading: { type: Boolean, default: false },
    facetTruncateAt: { type: Number, default: 5 },
    showResultCount: { type: Boolean, default: true },
    showPagination: { type: Boolean, default: true },
    placeholder: { type: String, default: 'Search...' },
    emptyMessage: { type: String, default: 'No results found' },
    onChange: { type: Array as PropType<any[]> },
    onSearch: { type: Function as PropType<(...args: any[]) => any> },
    onPageChange: { type: Function as PropType<(...args: any[]) => any> },
    renderResult: { type: Function as PropType<(...args: any[]) => any> },
    renderFacetItem: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['search', 'change', 'page-change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ search: props.results.length > 0 ? 'hasResults' : 'idle', expandedFacets: initialExpanded, expandedShowMore: new Set(), query: props.query, });
    const send = (action: any) => { /* state machine dispatch */ };
    const handleSearch = (query: string) => {
        send({ type: 'SET_QUERY', props.query });
        props.onSearch?.(props.query);
        props.onChange?.(props.query, props.activeFilters);
      };

    const handleApplyFacet = (facetKey: string, facetName: string, value: string, displayValue: string) => {
        const next = [...activeFilters, { facetKey, facetName, value, displayValue }];
        props.onChange?.(effectiveQuery, next);
      };

    const handleRemoveFacet = (facetKey: string, value: string) => {
        const next = props.activeFilters.filter(
          (f) => !(f.facetKey === facetKey && f.value === value),
        );
        props.onChange?.(effectiveQuery, next);
      };

    const handleClearAll = () => {
      props.onChange?.('';
    const initialExpanded = new Set(props.facets.map((f) => f.key));
    const effectiveQuery = props.query ?? state.value.query;
    const totalPages = Math.ceil(props.totalCount / props.pageSize);

    return (): VNode =>
      h('label', {
        'data-part': 'facet-item',
        'data-facet': facet.key,
        'data-value': item.value,
        'data-active': active ? 'true' : 'false',
        'data-count': item.count,
      }, [
        props.renderFacetItem
          ? props.renderFacetItem(item, active)
          : [
            h('input', {
              'type': 'checkbox',
              'checked': active,
              'onChange': () =>
                                      active
                                        ? handleRemoveFacet(facet.key, item.value)
                                        : handleApplyFacet(facet.key, facet.name, item.value, item.label),
            }),
            item.label,
            h('span', { 'data-part': 'facet-count', 'aria-hidden': 'true' }, [
              '(',
              item.count,
              ')',
            ]),
          ],
      ]);
  },
});
});

export default FacetedSearch;