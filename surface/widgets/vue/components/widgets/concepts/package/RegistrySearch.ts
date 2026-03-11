import { defineComponent, h, ref, computed, watch, type PropType } from 'vue';

export type RegistrySearchState = 'idle' | 'searching';
export type RegistrySearchEvent =
  | { type: 'INPUT' }
  | { type: 'SELECT_RESULT'; id?: string }
  | { type: 'RESULTS' }
  | { type: 'CLEAR' };

export function registrySearchReducer(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState {
  switch (state) {
    case 'idle':
      if (event.type === 'INPUT') return 'searching';
      if (event.type === 'SELECT_RESULT') return 'idle';
      return state;
    case 'searching':
      if (event.type === 'RESULTS') return 'idle';
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

interface PackageResult {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  downloads?: number;
  publishedAt?: string;
}

export const RegistrySearch = defineComponent({
  name: 'RegistrySearch',
  props: {
    query: { type: String, required: true },
    results: { type: Array as PropType<PackageResult[]>, required: true },
    sortBy: { type: String as PropType<'relevance' | 'downloads' | 'name' | 'date'>, default: 'relevance' },
    pageSize: { type: Number, default: 20 },
  },
  emits: ['search', 'select', 'page'],
  setup(props, { emit }) {
    const state = ref<RegistrySearchState>('idle');
    const localQuery = ref(props.query);
    const currentPage = ref(0);
    const focusIndex = ref(0);
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function send(event: RegistrySearchEvent) {
      state.value = registrySearchReducer(state.value, event);
    }

    watch(() => props.results, () => { send({ type: 'RESULTS' }); });

    const totalPages = computed(() => Math.max(1, Math.ceil(props.results.length / props.pageSize)));
    const pageResults = computed(() => {
      const start = currentPage.value * props.pageSize;
      return props.results.slice(start, start + props.pageSize);
    });

    function handleInput(val: string) {
      localQuery.value = val;
      send({ type: 'INPUT' });
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { emit('search', val); }, 300);
    }

    function handleSelect(pkg: PackageResult) {
      send({ type: 'SELECT_RESULT' });
      emit('select', pkg);
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, pageResults.value.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const r = pageResults.value[focusIndex.value]; if (r) handleSelect(r); }
      if (e.key === 'Escape') { e.preventDefault(); localQuery.value = ''; send({ type: 'CLEAR' }); }
    }

    return () => {
      const children: any[] = [];

      // Search input
      children.push(h('div', { 'data-part': 'search-input' }, [
        h('input', {
          type: 'search', 'data-part': 'query-input', role: 'combobox',
          'aria-label': 'Search packages', 'aria-expanded': props.results.length > 0 ? 'true' : 'false',
          placeholder: 'Search packages...', value: localQuery.value,
          onInput: (e: Event) => handleInput((e.target as HTMLInputElement).value),
        }),
        localQuery.value ? h('button', { type: 'button', 'data-part': 'clear-button', 'aria-label': 'Clear search', onClick: () => { localQuery.value = ''; send({ type: 'CLEAR' }); emit('search', ''); } }, '\u2715') : null,
      ]));

      // Result list
      children.push(h('div', { 'data-part': 'result-list', role: 'listbox', 'aria-label': 'Search results' },
        pageResults.value.length > 0
          ? pageResults.value.map((pkg, index) => {
              const isFocused = focusIndex.value === index;
              const cardChildren: any[] = [
                h('span', { 'data-part': 'card-name' }, pkg.name),
                h('span', { 'data-part': 'card-version' }, pkg.version),
              ];
              if (pkg.description) cardChildren.push(h('span', { 'data-part': 'card-desc' }, pkg.description));
              if (pkg.keywords && pkg.keywords.length > 0) {
                cardChildren.push(h('div', { 'data-part': 'card-keywords' },
                  pkg.keywords.map((kw) => h('span', { key: kw, 'data-part': 'keyword-badge' }, kw))));
              }
              if (pkg.downloads != null) cardChildren.push(h('span', { 'data-part': 'card-downloads' }, `${pkg.downloads} downloads`));
              if (pkg.publishedAt) cardChildren.push(h('span', { 'data-part': 'card-date' }, pkg.publishedAt));

              return h('div', {
                key: pkg.name, 'data-part': 'result-card', role: 'option',
                tabindex: isFocused ? 0 : -1,
                onClick: () => handleSelect(pkg),
              }, cardChildren);
            })
          : [h('div', { 'data-part': 'empty-state', role: 'status' },
              localQuery.value ? 'No packages found' : 'Type to search packages')]
      ));

      // Pagination
      if (totalPages.value > 1) {
        children.push(h('nav', { 'data-part': 'pagination', role: 'navigation', 'aria-label': 'Pagination' }, [
          h('button', { type: 'button', 'data-part': 'page-prev', disabled: currentPage.value === 0, onClick: () => { currentPage.value--; focusIndex.value = 0; emit('page', currentPage.value); }, 'aria-label': 'Previous page' }, '\u2190'),
          h('span', { 'data-part': 'page-info', role: 'status' }, `Page ${currentPage.value + 1} of ${totalPages.value}`),
          h('button', { type: 'button', 'data-part': 'page-next', disabled: currentPage.value >= totalPages.value - 1, onClick: () => { currentPage.value++; focusIndex.value = 0; emit('page', currentPage.value); }, 'aria-label': 'Next page' }, '\u2192'),
        ]));
      }

      return h('div', {
        role: 'search',
        'aria-label': 'Package registry search',
        'data-surface-widget': '',
        'data-widget-name': 'registry-search',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default RegistrySearch;
