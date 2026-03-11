import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH'; query?: string }
  | { type: 'SELECT_ENTRY'; id?: string }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' };

export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SWITCH_TAB') return 'viewing';
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'searching':
      if (event.type === 'CLEAR') return 'viewing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'DELETE') return 'deleting';
      return state;
    case 'deleting':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'entrySelected';
      return state;
    default:
      return state;
  }
}

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  type?: string;
  timestamp?: string;
  category?: string;
}

const TABS = ['working', 'episodic', 'semantic', 'procedural'] as const;

export const MemoryInspector = defineComponent({
  name: 'MemoryInspector',
  props: {
    entries: { type: Array as PropType<MemoryEntry[]>, required: true },
    totalTokens: { type: Number, default: 0 },
    maxTokens: { type: Number, default: 0 },
    activeTab: { type: String as PropType<typeof TABS[number]>, default: 'working' },
    showContext: { type: Boolean, default: true },
  },
  emits: ['switchTab', 'selectEntry', 'deleteEntry', 'search'],
  setup(props, { emit }) {
    const state = ref<MemoryInspectorState>('viewing');
    const currentTab = ref(props.activeTab);
    const searchQuery = ref('');
    const selectedId = ref<string | null>(null);
    const focusIndex = ref(0);

    function send(event: MemoryInspectorEvent) {
      state.value = memoryInspectorReducer(state.value, event);
    }

    const filteredEntries = computed(() => {
      let entries = props.entries.filter((e) => !e.category || e.category === currentTab.value);
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        entries = entries.filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q));
      }
      return entries;
    });

    const grouped = computed(() => {
      const groups: Record<string, MemoryEntry[]> = {};
      for (const entry of filteredEntries.value) {
        const key = entry.type ?? 'default';
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
      }
      return groups;
    });

    const selectedEntry = computed(() => filteredEntries.value.find((e) => e.id === selectedId.value));
    const tokenPercent = computed(() => props.maxTokens > 0 ? Math.round((props.totalTokens / props.maxTokens) * 100) : 0);

    function handleSearch(val: string) {
      searchQuery.value = val;
      if (val) { send({ type: 'SEARCH', query: val }); emit('search', val); }
      else send({ type: 'CLEAR' });
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); return; }
      const items = filteredEntries.value;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, items.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const entry = items[focusIndex.value]; if (entry) { selectedId.value = entry.id; send({ type: 'SELECT_ENTRY', id: entry.id }); emit('selectEntry', entry.id); } }
      if (e.key === 'Delete' && state.value === 'entrySelected') { e.preventDefault(); send({ type: 'DELETE' }); }
      if (e.key === 'Escape') { e.preventDefault(); if (state.value === 'deleting') send({ type: 'CANCEL' }); else { selectedId.value = null; send({ type: 'DESELECT' }); } }
    }

    return () => {
      const children: any[] = [];

      // Tabs
      children.push(h('div', { 'data-part': 'tabs', role: 'tablist' },
        TABS.map((tab) => h('button', {
          type: 'button', 'data-part': 'tab', role: 'tab',
          'aria-selected': currentTab.value === tab ? 'true' : 'false',
          'data-active': currentTab.value === tab ? 'true' : 'false',
          onClick: () => { currentTab.value = tab; send({ type: 'SWITCH_TAB' }); emit('switchTab', tab); },
        }, tab.charAt(0).toUpperCase() + tab.slice(1)))));

      // Search
      children.push(h('div', { 'data-part': 'search-bar' }, [
        h('input', {
          type: 'search', 'data-part': 'search-input',
          placeholder: 'Search memory...', value: searchQuery.value,
          onInput: (e: Event) => handleSearch((e.target as HTMLInputElement).value),
          'aria-label': 'Search memory entries',
        }),
        searchQuery.value ? h('button', {
          type: 'button', 'data-part': 'search-clear',
          onClick: () => handleSearch(''), 'aria-label': 'Clear search',
        }, '\u2715') : null,
      ]));

      // Entry list
      const groupEntries = Object.entries(grouped.value);
      const listChildren = groupEntries.flatMap(([group, entries]) => {
        const items = entries.map((entry, idx) => {
          const isSelected = selectedId.value === entry.id;
          return h('div', {
            key: entry.id, 'data-part': 'entry-item',
            'aria-selected': isSelected ? 'true' : 'false',
            'data-selected': isSelected ? 'true' : 'false',
            role: 'listitem', tabindex: -1,
            onClick: () => { selectedId.value = entry.id; send({ type: 'SELECT_ENTRY', id: entry.id }); emit('selectEntry', entry.id); },
          }, [
            h('span', { 'data-part': 'entry-label' }, entry.key),
            h('span', { 'data-part': 'entry-content' }, entry.value.length > 80 ? entry.value.slice(0, 80) + '...' : entry.value),
            entry.timestamp ? h('span', { 'data-part': 'entry-meta' }, entry.timestamp) : null,
          ]);
        });
        return [h('div', { 'data-part': 'group-header' }, group), ...items];
      });

      if (filteredEntries.value.length === 0) {
        listChildren.push(h('div', { 'data-part': 'empty-state', role: 'status' }, searchQuery.value ? 'No entries match' : 'No memory entries'));
      }

      children.push(h('div', { 'data-part': 'entry-list', role: 'list', 'aria-label': 'Memory entries' }, listChildren));

      // Context bar
      if (props.showContext && props.maxTokens > 0) {
        children.push(h('div', { 'data-part': 'context-bar' }, [
          h('span', { 'data-part': 'context-label' }, 'Context Window'),
          h('div', { 'data-part': 'context-gauge', role: 'progressbar', 'aria-valuenow': tokenPercent.value, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
            h('div', { 'data-part': 'context-fill', style: { width: `${tokenPercent.value}%` } }),
          ]),
          h('span', { 'data-part': 'context-count' }, `${props.totalTokens} / ${props.maxTokens}`),
        ]));
      }

      // Delete confirmation
      if (state.value === 'deleting' && selectedEntry.value) {
        children.push(h('div', { 'data-part': 'delete-confirm', role: 'alertdialog', 'aria-label': 'Confirm delete' }, [
          h('span', {}, `Delete "${selectedEntry.value.key}"?`),
          h('button', {
            type: 'button', 'data-part': 'confirm-delete',
            onClick: () => { emit('deleteEntry', selectedId.value); selectedId.value = null; send({ type: 'CONFIRM' }); },
          }, 'Delete'),
          h('button', {
            type: 'button', 'data-part': 'cancel-delete',
            onClick: () => send({ type: 'CANCEL' }),
          }, 'Cancel'),
        ]));
      }

      // Selected entry action
      if (state.value === 'entrySelected' && selectedEntry.value) {
        children.push(h('button', {
          type: 'button', 'data-part': 'delete-button',
          'aria-label': `Delete ${selectedEntry.value.key}`,
          onClick: () => send({ type: 'DELETE' }),
        }, 'Delete'));
      }

      return h('div', {
        role: 'region',
        'aria-label': 'Memory inspector',
        'data-surface-widget': '',
        'data-widget-name': 'memory-inspector',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default MemoryInspector;
