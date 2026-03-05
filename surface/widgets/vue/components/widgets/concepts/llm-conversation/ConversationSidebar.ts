import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type ConversationSidebarState = 'idle' | 'searching' | 'contextOpen';
export type ConversationSidebarEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT' }
  | { type: 'CONTEXT_MENU' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'CLOSE_CONTEXT' }
  | { type: 'ACTION' };

export function conversationSidebarReducer(state: ConversationSidebarState, event: ConversationSidebarEvent): ConversationSidebarState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT') return 'idle';
      if (event.type === 'CONTEXT_MENU') return 'contextOpen';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'idle';
      if (event.type === 'SELECT') return 'idle';
      return state;
    case 'contextOpen':
      if (event.type === 'CLOSE_CONTEXT') return 'idle';
      if (event.type === 'ACTION') return 'idle';
      return state;
    default:
      return state;
  }
}

interface Conversation {
  id: string;
  title: string;
  preview?: string;
  timestamp?: string;
  model?: string;
  group?: string;
}

export const ConversationSidebar = defineComponent({
  name: 'ConversationSidebar',
  props: {
    conversations: { type: Array as PropType<Conversation[]>, required: true },
    selectedId: { type: String, default: undefined },
    groupBy: { type: String as PropType<'date' | 'folder'>, default: 'date' },
    showPreview: { type: Boolean, default: true },
    showModel: { type: Boolean, default: true },
  },
  emits: ['select', 'new', 'delete', 'rename', 'contextAction'],
  setup(props, { emit }) {
    const state = ref<ConversationSidebarState>('idle');
    const searchQuery = ref('');
    const focusIndex = ref(0);
    const contextId = ref<string | null>(null);

    function send(event: ConversationSidebarEvent) {
      state.value = conversationSidebarReducer(state.value, event);
    }

    const filtered = computed(() => {
      if (!searchQuery.value) return props.conversations;
      const q = searchQuery.value.toLowerCase();
      return props.conversations.filter((c) =>
        c.title.toLowerCase().includes(q) || (c.preview?.toLowerCase().includes(q))
      );
    });

    const grouped = computed(() => {
      const groups: Record<string, Conversation[]> = {};
      for (const conv of filtered.value) {
        const key = conv.group ?? 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(conv);
      }
      return groups;
    });

    function handleSearch(val: string) {
      searchQuery.value = val;
      if (val) send({ type: 'SEARCH' });
      else send({ type: 'CLEAR_SEARCH' });
    }

    function handleSelect(id: string) {
      send({ type: 'SELECT' });
      emit('select', id);
    }

    function handleContextMenu(e: MouseEvent, id: string) {
      e.preventDefault();
      contextId.value = id;
      send({ type: 'CONTEXT_MENU' });
    }

    function handleKeydown(e: KeyboardEvent) {
      const items = filtered.value;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusIndex.value = Math.min(focusIndex.value + 1, items.length - 1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusIndex.value = Math.max(focusIndex.value - 1, 0);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[focusIndex.value];
        if (item) handleSelect(item.id);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (state.value === 'contextOpen') send({ type: 'CLOSE_CONTEXT' });
        else if (searchQuery.value) handleSearch('');
      }
    }

    return () => {
      const children: any[] = [];

      // Search
      children.push(h('div', { 'data-part': 'search' }, [
        h('input', {
          type: 'search',
          'data-part': 'search-input',
          placeholder: 'Search conversations...',
          value: searchQuery.value,
          onInput: (e: Event) => handleSearch((e.target as HTMLInputElement).value),
          'aria-label': 'Search conversations',
        }),
        searchQuery.value ? h('button', {
          type: 'button',
          'data-part': 'search-clear',
          onClick: () => handleSearch(''),
          'aria-label': 'Clear search',
        }, '\u2715') : null,
      ]));

      // New button
      children.push(h('button', {
        type: 'button',
        'data-part': 'new-button',
        'aria-label': 'New conversation',
        onClick: () => emit('new'),
      }, '+ New'));

      // Grouped list
      const groupEntries = Object.entries(grouped.value);
      let flatIndex = 0;
      const groupNodes = groupEntries.map(([groupName, convs]) => {
        const items = convs.map((conv) => {
          const idx = flatIndex++;
          const isSelected = props.selectedId === conv.id;
          const isFocused = focusIndex.value === idx;
          const itemChildren: any[] = [
            h('span', { 'data-part': 'item-title' }, conv.title),
          ];
          if (props.showPreview && conv.preview) {
            itemChildren.push(h('span', { 'data-part': 'item-preview' }, conv.preview));
          }
          if (conv.timestamp) {
            itemChildren.push(h('span', { 'data-part': 'item-timestamp' }, conv.timestamp));
          }
          if (props.showModel && conv.model) {
            itemChildren.push(h('div', { 'data-part': 'item-model' }, conv.model));
          }
          return h('div', {
            'data-part': 'conversation-item',
            'aria-selected': isSelected ? 'true' : 'false',
            'data-selected': isSelected ? 'true' : 'false',
            tabindex: isFocused ? 0 : -1,
            role: 'option',
            onClick: () => handleSelect(conv.id),
            onContextmenu: (e: MouseEvent) => handleContextMenu(e, conv.id),
          }, itemChildren);
        });
        return h('div', { 'data-part': 'group', role: 'group' }, [
          h('span', { 'data-part': 'group-header', role: 'heading' }, groupName),
          ...items,
        ]);
      });
      children.push(h('div', {
        'data-part': 'group-list',
        role: 'listbox',
        'aria-label': 'Conversations',
      }, groupNodes));

      // Context menu
      if (state.value === 'contextOpen' && contextId.value) {
        children.push(h('div', {
          'data-part': 'context-menu',
          'data-visible': 'true',
          role: 'menu',
        }, [
          h('button', {
            type: 'button', 'data-part': 'context-rename', role: 'menuitem',
            onClick: () => { emit('rename', contextId.value); send({ type: 'ACTION' }); },
          }, 'Rename'),
          h('button', {
            type: 'button', 'data-part': 'context-delete', role: 'menuitem',
            onClick: () => { emit('delete', contextId.value); send({ type: 'ACTION' }); },
          }, 'Delete'),
        ]));
      }

      return h('div', {
        role: 'navigation',
        'aria-label': 'Conversation history',
        'data-surface-widget': '',
        'data-widget-name': 'conversation-sidebar',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default ConversationSidebar;
