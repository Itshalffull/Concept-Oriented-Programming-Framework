import { defineComponent, h, ref, computed, watch, onUnmounted, nextTick } from 'vue';

/* ---------------------------------------------------------------------------
 * DeliberationThread state machine
 * States: viewing (initial), composing, entrySelected
 * ------------------------------------------------------------------------- */

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO'; entryId: string }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export interface DeliberationThreadMachineContext {
  state: DeliberationThreadState;
  replyTargetId: string | null;
  selectedEntryId: string | null;
}

export function deliberationThreadReducer(
  ctx: DeliberationThreadMachineContext,
  event: DeliberationThreadEvent,
): DeliberationThreadMachineContext {
  switch (ctx.state) {
    case 'viewing':
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      if (event.type === 'SELECT_ENTRY')
        return { state: 'entrySelected', replyTargetId: null, selectedEntryId: event.entryId };
      return ctx;
    case 'composing':
      if (event.type === 'SEND')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'CANCEL')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      return ctx;
    case 'entrySelected':
      if (event.type === 'DESELECT')
        return { state: 'viewing', replyTargetId: null, selectedEntryId: null };
      if (event.type === 'REPLY_TO')
        return { state: 'composing', replyTargetId: event.entryId, selectedEntryId: null };
      return ctx;
    default:
      return ctx;
  }
}

/* ---------------------------------------------------------------------------
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = {
  for: '#22c55e', against: '#ef4444', question: '#3b82f6', amendment: '#eab308',
};
const TAG_LABELS: Record<ArgumentTag, string> = {
  for: 'For', against: 'Against', question: 'Question', amendment: 'Amendment',
};

export interface DeliberationEntry {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
  tag: ArgumentTag;
  parentId?: string | null;
  relevance?: number;
}

interface EntryNode {
  entry: DeliberationEntry;
  children: EntryNode[];
  depth: number;
}

function buildTree(entries: DeliberationEntry[], maxNesting: number): EntryNode[] {
  const byId = new Map<string, EntryNode>();
  const roots: EntryNode[] = [];
  for (const entry of entries) {
    byId.set(entry.id, { entry, children: [], depth: 0 });
  }
  for (const entry of entries) {
    const node = byId.get(entry.id)!;
    if (entry.parentId && byId.has(entry.parentId)) {
      const parent = byId.get(entry.parentId)!;
      node.depth = parent.depth < maxNesting ? parent.depth + 1 : maxNesting;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function sortEntries(entries: DeliberationEntry[], mode: SortMode): DeliberationEntry[] {
  const sorted = [...entries];
  switch (mode) {
    case 'time':
      return sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    case 'tag': {
      const order: Record<ArgumentTag, number> = { for: 0, against: 1, question: 2, amendment: 3 };
      return sorted.sort((a, b) => order[a.tag] - order[b.tag]);
    }
    case 'relevance':
      return sorted.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
    default:
      return sorted;
  }
}

function flattenTree(nodes: EntryNode[], collapsedIds: Set<string>): EntryNode[] {
  const result: EntryNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (!collapsedIds.has(node.entry.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, collapsedIds));
    }
  }
  return result;
}

function computeSentiment(entries: DeliberationEntry[]) {
  let forCount = 0;
  let againstCount = 0;
  for (const e of entries) {
    if (e.tag === 'for') forCount++;
    else if (e.tag === 'against') againstCount++;
  }
  const total = forCount + againstCount;
  return { forCount, againstCount, ratio: total > 0 ? forCount / total : 0.5 };
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const INITIAL_CTX: DeliberationThreadMachineContext = {
  state: 'viewing', replyTargetId: null, selectedEntryId: null,
};

export const DeliberationThread = defineComponent({
  name: 'DeliberationThread',
  props: {
    entries: { type: Array as () => DeliberationEntry[], required: true },
    status: { type: String, required: true },
    summary: { type: String, default: undefined },
    showSentiment: { type: Boolean, default: true },
    showTags: { type: Boolean, default: true },
    maxNesting: { type: Number, default: 3 },
    sortMode: { type: String as () => SortMode, default: undefined },
  },
  emits: ['reply', 'sortChange', 'entrySelect'],
  setup(props, { slots, emit }) {
    const ctx = ref<DeliberationThreadMachineContext>({ ...INITIAL_CTX });
    const send = (event: DeliberationThreadEvent) => {
      ctx.value = deliberationThreadReducer(ctx.value, event);
    };

    const collapsedIds = ref<Set<string>>(new Set());
    const focusIndex = ref(0);
    const internalSortMode = ref<SortMode>('time');
    const composeText = ref('');

    const sortMode = computed(() => props.sortMode ?? internalSortMode.value);
    const sortedEntries = computed(() => sortEntries(props.entries, sortMode.value));
    const tree = computed(() => buildTree(sortedEntries.value, props.maxNesting));
    const flatNodes = computed(() => flattenTree(tree.value, collapsedIds.value));
    const sentiment = computed(() => computeSentiment(props.entries));

    const toggleCollapse = (id: string) => {
      const next = new Set(collapsedIds.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      collapsedIds.value = next;
    };

    const handleSortChange = (mode: SortMode) => {
      internalSortMode.value = mode;
      emit('sortChange', mode);
    };

    const handleSend = () => {
      if (ctx.value.replyTargetId && composeText.value.trim()) {
        emit('reply', ctx.value.replyTargetId, composeText.value.trim());
      }
      composeText.value = '';
      send({ type: 'SEND' });
    };

    const handleCancel = () => {
      composeText.value = '';
      send({ type: 'CANCEL' });
    };

    // Keep focusIndex in bounds
    watch(() => flatNodes.value.length, (len) => {
      if (focusIndex.value >= len && len > 0) focusIndex.value = len - 1;
    });

    const handleRootKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusIndex.value = Math.min(focusIndex.value + 1, flatNodes.value.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusIndex.value = Math.max(focusIndex.value - 1, 0);
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const node = flatNodes.value[focusIndex.value];
          if (node && collapsedIds.value.has(node.entry.id)) toggleCollapse(node.entry.id);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const node = flatNodes.value[focusIndex.value];
          if (node && !collapsedIds.value.has(node.entry.id) && node.children.length > 0)
            toggleCollapse(node.entry.id);
          break;
        }
        case 'Enter':
        case 'r': {
          e.preventDefault();
          const node = flatNodes.value[focusIndex.value];
          if (node) send({ type: 'REPLY_TO', entryId: node.entry.id });
          break;
        }
        case 'Escape':
          e.preventDefault();
          if (ctx.value.state === 'composing') handleCancel();
          else if (ctx.value.state === 'entrySelected') send({ type: 'DESELECT' });
          break;
      }
    };

    function renderEntryNode(node: EntryNode, index: number): ReturnType<typeof h> {
      const { entry } = node;
      const isCollapsed = collapsedIds.value.has(entry.id);
      const isSelected = ctx.value.selectedEntryId === entry.id;
      const isReplyTarget = ctx.value.replyTargetId === entry.id;
      const isFocused = flatNodes.value[focusIndex.value]?.entry.id === entry.id;
      const hasChildren = node.children.length > 0;

      return h('div', {
        key: entry.id,
        role: 'article',
        'aria-label': `${entry.author}: ${TAG_LABELS[entry.tag]} \u2014 ${formatTimestamp(entry.timestamp)}`,
        'aria-setsize': -1,
        'aria-posinset': index + 1,
        'data-part': 'entry',
        'data-tag': entry.tag,
        'data-selected': isSelected ? 'true' : 'false',
        'data-depth': node.depth,
        tabindex: isFocused ? 0 : -1,
        style: {
          marginLeft: `${node.depth * 24}px`,
          outline: isSelected ? '2px solid var(--ring, #6366f1)' : undefined,
        },
        onClick: () => {
          if (ctx.value.state === 'entrySelected' && isSelected) {
            send({ type: 'DESELECT' });
          } else {
            send({ type: 'SELECT_ENTRY', entryId: entry.id });
            emit('entrySelect', entry.id);
          }
        },
      }, [
        // Avatar
        h('div', { 'data-part': 'entry-avatar', 'aria-hidden': 'true' }, [
          entry.avatar
            ? h('img', { src: entry.avatar, alt: '', style: { width: '28px', height: '28px', borderRadius: '50%' } })
            : h('span', {
                style: {
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: '#e5e7eb', fontSize: '14px', fontWeight: 600,
                },
              }, entry.author.charAt(0).toUpperCase()),
        ]),
        h('span', { 'data-part': 'entry-author' }, entry.author),
        // Tag badge
        props.showTags
          ? h('span', {
              'data-part': 'entry-tag', 'data-tag': entry.tag, 'data-visible': 'true',
              style: {
                display: 'inline-block', padding: '2px 8px', borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600, color: '#fff',
                backgroundColor: TAG_COLORS[entry.tag],
              },
            }, TAG_LABELS[entry.tag])
          : null,
        h('div', { 'data-part': 'entry-content' }, entry.content),
        h('span', { 'data-part': 'entry-timestamp', style: { fontSize: '12px', color: '#6b7280' } }, formatTimestamp(entry.timestamp)),
        // Reply button
        h('button', {
          type: 'button', 'data-part': 'reply', 'aria-label': `Reply to ${entry.author}`,
          tabindex: -1,
          onClick: (e: MouseEvent) => { e.stopPropagation(); send({ type: 'REPLY_TO', entryId: entry.id }); },
        }, 'Reply'),
        // Collapse toggle
        hasChildren
          ? h('button', {
              type: 'button', 'data-part': 'collapse-toggle',
              'aria-label': isCollapsed ? 'Expand replies' : 'Collapse replies',
              'aria-expanded': !isCollapsed, tabindex: -1,
              onClick: (e: MouseEvent) => { e.stopPropagation(); toggleCollapse(entry.id); },
            }, isCollapsed ? `Show replies (${node.children.length})` : 'Hide replies')
          : null,
        // Compose box
        ctx.value.state === 'composing' && isReplyTarget
          ? h('div', {
              'data-part': 'compose', 'data-visible': 'true',
              role: 'group', 'aria-label': 'Reply compose box',
              style: { marginLeft: '24px', marginTop: '8px' },
            }, [
              h('textarea', {
                'data-part': 'compose-input', 'aria-label': 'Add contribution',
                role: 'textbox', placeholder: 'Add your contribution...',
                value: composeText.value,
                onInput: (e: Event) => { composeText.value = (e.target as HTMLTextAreaElement).value; },
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
                  if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
                },
                rows: 3, style: { width: '100%', resize: 'vertical' },
              }),
              h('div', { 'data-part': 'compose-actions', style: { marginTop: '4px', display: 'flex', gap: '8px' } }, [
                h('button', { type: 'button', 'data-part': 'compose-send', 'aria-label': 'Send reply', onClick: handleSend }, 'Send'),
                h('button', { type: 'button', 'data-part': 'compose-cancel', 'aria-label': 'Cancel reply', onClick: handleCancel }, 'Cancel'),
              ]),
            ])
          : null,
        // Nested replies
        hasChildren && !isCollapsed
          ? h('div', { 'data-part': 'replies', role: 'group', 'aria-label': `Replies to ${entry.author}` },
              node.children.map((child, childIdx) => renderEntryNode(child, childIdx)))
          : null,
      ]);
    }

    return () => h('div', {
      role: 'feed',
      'aria-label': 'Deliberation thread',
      'data-surface-widget': '',
      'data-widget-name': 'deliberation-thread',
      'data-part': 'root',
      'data-state': ctx.value.state,
      'data-status': props.status,
      tabindex: 0,
      onKeydown: handleRootKeyDown,
    }, [
      // Header
      h('div', { 'data-part': 'header', 'data-state': ctx.value.state }, [
        h('span', { 'data-part': 'header-status', style: { fontWeight: 600, textTransform: 'capitalize' } }, props.status),
        props.summary ? h('p', { 'data-part': 'header-summary', style: { marginTop: '4px' } }, props.summary) : null,
        h('div', { 'data-part': 'sort-controls', role: 'group', 'aria-label': 'Sort entries' },
          (['time', 'tag', 'relevance'] as SortMode[]).map((mode) =>
            h('button', {
              key: mode, type: 'button', 'data-part': 'sort-button',
              'data-sort': mode, 'data-active': sortMode.value === mode ? 'true' : 'false',
              'aria-pressed': sortMode.value === mode, tabindex: -1,
              onClick: () => handleSortChange(mode),
            }, mode.charAt(0).toUpperCase() + mode.slice(1)),
          ),
        ),
      ]),
      // Sentiment bar
      props.showSentiment
        ? h('div', {
            'data-part': 'sentiment', 'data-visible': 'true', role: 'img',
            'aria-label': `Sentiment: ${sentiment.value.forCount} for, ${sentiment.value.againstCount} against`,
            style: { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' },
          }, [
            h('div', {
              'data-part': 'sentiment-for', 'aria-hidden': 'true',
              style: { width: `${sentiment.value.ratio * 100}%`, backgroundColor: TAG_COLORS.for, transition: 'width 0.3s ease' },
            }),
            h('div', {
              'data-part': 'sentiment-against', 'aria-hidden': 'true',
              style: { width: `${(1 - sentiment.value.ratio) * 100}%`, backgroundColor: TAG_COLORS.against, transition: 'width 0.3s ease' },
            }),
          ])
        : null,
      // Entry list
      h('div', { 'data-part': 'entry-list', role: 'feed', 'aria-label': 'Contributions' }, [
        tree.value.length === 0
          ? h('p', { 'data-part': 'empty-state', style: { color: '#9ca3af', fontStyle: 'italic' } }, 'No contributions yet.')
          : null,
        ...tree.value.map((node, idx) => renderEntryNode(node, idx)),
      ]),
      slots.default ? slots.default() : null,
    ]);
  },
});

export default DeliberationThread;
