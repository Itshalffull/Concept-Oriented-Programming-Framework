import { defineComponent, h, ref, computed, watch, nextTick, type PropType } from 'vue';

export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY'; id?: string }
  | { type: 'INTERRUPT' }
  | { type: 'DESELECT' }
  | { type: 'RESUME' };

export function agentTimelineReducer(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'NEW_ENTRY') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      if (event.type === 'INTERRUPT') return 'interrupted';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'interrupted':
      if (event.type === 'RESUME') return 'idle';
      return state;
    default:
      return state;
  }
}

interface TimelineEntry {
  id: string;
  agentName: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'delegation' | 'thought';
  content: string;
  timestamp?: string;
  delegatedTo?: string;
}

const TYPE_ICONS: Record<string, string> = {
  message: '\u{1F4AC}', tool_call: '\u{1F527}', tool_result: '\u{1F4CB}',
  delegation: '\u{1F91D}', thought: '\u{1F4AD}',
};

export const AgentTimeline = defineComponent({
  name: 'AgentTimeline',
  props: {
    entries: { type: Array as PropType<TimelineEntry[]>, required: true },
    agentName: { type: String, required: true },
    status: { type: String as PropType<'running' | 'idle' | 'interrupted' | 'complete'>, required: true },
    showDelegations: { type: Boolean, default: true },
    autoScroll: { type: Boolean, default: true },
    maxEntries: { type: Number, default: 100 },
  },
  emits: ['selectEntry', 'interrupt', 'resume'],
  setup(props, { emit }) {
    const state = ref<AgentTimelineState>('idle');
    const selectedId = ref<string | null>(null);
    const focusIndex = ref(0);
    const timelineRef = ref<HTMLElement | null>(null);

    function send(event: AgentTimelineEvent) {
      state.value = agentTimelineReducer(state.value, event);
    }

    const visibleEntries = computed(() => {
      let entries = props.entries;
      if (!props.showDelegations) entries = entries.filter((e) => e.type !== 'delegation');
      return entries.slice(-props.maxEntries);
    });

    watch(() => props.entries.length, () => {
      send({ type: 'NEW_ENTRY' });
      if (props.autoScroll) {
        nextTick(() => {
          const el = timelineRef.value;
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      }
    });

    function handleSelect(id: string) {
      selectedId.value = id;
      send({ type: 'SELECT_ENTRY', id });
      emit('selectEntry', id);
    }

    function handleKeydown(e: KeyboardEvent) {
      const items = visibleEntries.value;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, items.length - 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      if (e.key === 'Enter') { e.preventDefault(); const entry = items[focusIndex.value]; if (entry) handleSelect(entry.id); }
      if (e.key === 'Escape') { e.preventDefault(); selectedId.value = null; send({ type: 'DESELECT' }); }
    }

    return () => {
      const children: any[] = [];

      // Header
      children.push(h('div', { 'data-part': 'header' }, [
        h('span', { 'data-part': 'agent-name' }, props.agentName),
        h('div', { 'data-part': 'status-badge', 'data-status': props.status }, props.status),
        props.status === 'running'
          ? h('button', {
              type: 'button', 'data-part': 'interrupt-button',
              'aria-label': 'Interrupt agent',
              onClick: () => { send({ type: 'INTERRUPT' }); emit('interrupt'); },
            }, 'Interrupt')
          : null,
        state.value === 'interrupted'
          ? h('button', {
              type: 'button', 'data-part': 'resume-button',
              'aria-label': 'Resume agent',
              onClick: () => { send({ type: 'RESUME' }); emit('resume'); },
            }, 'Resume')
          : null,
      ]));

      // Timeline
      const entryNodes = visibleEntries.value.map((entry, index) => {
        const isSelected = selectedId.value === entry.id;
        const isFocused = focusIndex.value === index;
        const entryChildren: any[] = [
          h('div', { 'data-part': 'agent-badge' }, entry.agentName),
          h('div', { 'data-part': 'type-badge', 'data-type': entry.type }, [
            h('span', { 'aria-hidden': 'true' }, TYPE_ICONS[entry.type] ?? ''),
            h('span', {}, entry.type),
          ]),
          h('div', { 'data-part': 'content' }, entry.content),
        ];
        if (entry.timestamp) entryChildren.push(h('span', { 'data-part': 'timestamp' }, entry.timestamp));
        if (entry.type === 'delegation' && entry.delegatedTo) {
          entryChildren.push(h('div', { 'data-part': 'delegation' }, `\u2192 ${entry.delegatedTo}`));
        }
        return h('div', {
          key: entry.id,
          'data-part': 'entry',
          'data-type': entry.type,
          'aria-selected': isSelected ? 'true' : 'false',
          'data-selected': isSelected ? 'true' : 'false',
          tabindex: isFocused ? 0 : -1,
          role: 'listitem',
          onClick: () => handleSelect(entry.id),
        }, entryChildren);
      });

      children.push(h('div', {
        'data-part': 'timeline',
        role: 'list',
        'aria-label': 'Agent timeline',
        ref: (el: any) => { timelineRef.value = el; },
      }, entryNodes));

      return h('div', {
        role: 'log',
        'aria-label': `${props.agentName} timeline`,
        'data-surface-widget': '',
        'data-widget-name': 'agent-timeline',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default AgentTimeline;
