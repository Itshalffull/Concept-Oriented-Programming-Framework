import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export function deliberationThreadReducer(state: DeliberationThreadState, event: DeliberationThreadEvent): DeliberationThreadState {
  switch (state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return 'composing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'composing':
      if (event.type === 'SEND') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'REPLY_TO') return 'composing';
      return state;
    default:
      return state;
  }
}

/* --- Types --- */

type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
type SortMode = 'time' | 'tag' | 'relevance';

const TAG_COLORS: Record<ArgumentTag, string> = {
  for: '#22c55e',
  against: '#ef4444',
  question: '#3b82f6',
  amendment: '#eab308',
};

const TAG_LABELS: Record<ArgumentTag, string> = {
  for: 'For',
  against: 'Against',
  question: 'Question',
  amendment: 'Amendment',
};

interface DeliberationEntry {
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

/* --- Helpers --- */

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
      node.depth = Math.min(parent.depth + 1, maxNesting);
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

function computeSentiment(entries: DeliberationEntry[]): { forCount: number; againstCount: number; ratio: number } {
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
  } catch {
    return iso;
  }
}

export interface DeliberationThreadProps { [key: string]: unknown; class?: string; }
export interface DeliberationThreadResult { element: HTMLElement; dispose: () => void; }

export function DeliberationThread(props: DeliberationThreadProps): DeliberationThreadResult {
  const sig = surfaceCreateSignal<DeliberationThreadState>('viewing');
  const state = () => sig.get();
  const send = (type: string) => sig.set(deliberationThreadReducer(sig.get(), { type } as any));

  const entries = (props.entries ?? []) as DeliberationEntry[];
  const status = String(props.status ?? 'open');
  const summary = props.summary != null ? String(props.summary) : undefined;
  const showSentiment = props.showSentiment !== false;
  const showTags = props.showTags !== false;
  const maxNesting = typeof props.maxNesting === 'number' ? props.maxNesting : 3;
  const onReply = props.onReply as ((parentId: string, content: string) => void) | undefined;
  const onSortChange = props.onSortChange as ((mode: SortMode) => void) | undefined;
  const onEntrySelect = props.onEntrySelect as ((entryId: string) => void) | undefined;

  let currentSortMode: SortMode = (props.sortMode as SortMode) ?? 'time';
  let collapsedIds = new Set<string>();
  let focusIndex = 0;
  let replyTargetId: string | null = null;
  let selectedEntryId: string | null = null;
  let composeText = '';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'deliberation-thread');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'feed');
  root.setAttribute('aria-label', 'Deliberation thread');
  root.setAttribute('data-state', state());
  root.setAttribute('data-status', status);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', state());
  root.appendChild(headerEl);

  const headerStatusEl = document.createElement('span');
  headerStatusEl.setAttribute('data-part', 'header-status');
  headerStatusEl.style.fontWeight = '600';
  headerStatusEl.style.textTransform = 'capitalize';
  headerStatusEl.textContent = status;
  headerEl.appendChild(headerStatusEl);

  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.setAttribute('data-part', 'header-summary');
    summaryEl.textContent = summary;
    headerEl.appendChild(summaryEl);
  }

  /* Sort controls */
  const sortControlsEl = document.createElement('div');
  sortControlsEl.setAttribute('data-part', 'sort-controls');
  sortControlsEl.setAttribute('role', 'group');
  sortControlsEl.setAttribute('aria-label', 'Sort entries');
  headerEl.appendChild(sortControlsEl);

  const sortModes: SortMode[] = ['time', 'tag', 'relevance'];
  const sortButtons: HTMLButtonElement[] = [];
  for (const mode of sortModes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-part', 'sort-button');
    btn.setAttribute('data-sort', mode);
    btn.setAttribute('data-active', currentSortMode === mode ? 'true' : 'false');
    btn.setAttribute('aria-pressed', String(currentSortMode === mode));
    btn.setAttribute('tabindex', '-1');
    btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    btn.addEventListener('click', () => {
      currentSortMode = mode;
      onSortChange?.(mode);
      rebuildEntryList();
      sortButtons.forEach((b) => {
        const m = b.getAttribute('data-sort');
        b.setAttribute('data-active', m === mode ? 'true' : 'false');
        b.setAttribute('aria-pressed', String(m === mode));
      });
    });
    sortControlsEl.appendChild(btn);
    sortButtons.push(btn);
  }

  /* Sentiment bar */
  let sentimentEl: HTMLElement | null = null;
  let sentimentForEl: HTMLElement | null = null;
  let sentimentAgainstEl: HTMLElement | null = null;

  if (showSentiment) {
    const sentiment = computeSentiment(entries);
    sentimentEl = document.createElement('div');
    sentimentEl.setAttribute('data-part', 'sentiment');
    sentimentEl.setAttribute('data-visible', 'true');
    sentimentEl.setAttribute('role', 'img');
    sentimentEl.setAttribute('aria-label', `Sentiment: ${sentiment.forCount} for, ${sentiment.againstCount} against`);
    sentimentEl.style.display = 'flex';
    sentimentEl.style.height = '8px';
    sentimentEl.style.borderRadius = '4px';
    sentimentEl.style.overflow = 'hidden';
    sentimentEl.style.marginBottom = '8px';

    sentimentForEl = document.createElement('div');
    sentimentForEl.setAttribute('data-part', 'sentiment-for');
    sentimentForEl.style.width = `${sentiment.ratio * 100}%`;
    sentimentForEl.style.backgroundColor = TAG_COLORS.for;
    sentimentForEl.style.transition = 'width 0.3s ease';
    sentimentForEl.setAttribute('aria-hidden', 'true');
    sentimentEl.appendChild(sentimentForEl);

    sentimentAgainstEl = document.createElement('div');
    sentimentAgainstEl.setAttribute('data-part', 'sentiment-against');
    sentimentAgainstEl.style.width = `${(1 - sentiment.ratio) * 100}%`;
    sentimentAgainstEl.style.backgroundColor = TAG_COLORS.against;
    sentimentAgainstEl.style.transition = 'width 0.3s ease';
    sentimentAgainstEl.setAttribute('aria-hidden', 'true');
    sentimentEl.appendChild(sentimentAgainstEl);

    root.appendChild(sentimentEl);
  }

  /* Entry list */
  const entryListEl = document.createElement('div');
  entryListEl.setAttribute('data-part', 'entry-list');
  entryListEl.setAttribute('role', 'feed');
  entryListEl.setAttribute('aria-label', 'Contributions');
  root.appendChild(entryListEl);

  let flatNodes: EntryNode[] = [];
  const entryRefMap = new Map<string, HTMLDivElement>();

  function renderEntryNode(node: EntryNode): HTMLDivElement {
    const { entry } = node;
    const el = document.createElement('div');
    el.setAttribute('role', 'article');
    el.setAttribute('aria-label', `${entry.author}: ${TAG_LABELS[entry.tag]} \u2014 ${formatTimestamp(entry.timestamp)}`);
    el.setAttribute('data-part', 'entry');
    el.setAttribute('data-tag', entry.tag);
    el.setAttribute('data-selected', selectedEntryId === entry.id ? 'true' : 'false');
    el.setAttribute('data-depth', String(node.depth));
    el.setAttribute('tabindex', '-1');
    el.style.marginLeft = `${node.depth * 24}px`;
    entryRefMap.set(entry.id, el);

    el.addEventListener('click', () => {
      if (sig.get() === 'entrySelected' && selectedEntryId === entry.id) {
        selectedEntryId = null;
        send('DESELECT');
      } else {
        selectedEntryId = entry.id;
        send('SELECT_ENTRY');
        onEntrySelect?.(entry.id);
      }
      updateEntrySelections();
    });

    /* Avatar */
    const avatarEl = document.createElement('div');
    avatarEl.setAttribute('data-part', 'entry-avatar');
    avatarEl.setAttribute('aria-hidden', 'true');
    if (entry.avatar) {
      const img = document.createElement('img');
      img.src = entry.avatar;
      img.alt = '';
      img.style.width = '28px';
      img.style.height = '28px';
      img.style.borderRadius = '50%';
      avatarEl.appendChild(img);
    } else {
      const sp = document.createElement('span');
      sp.textContent = entry.author.charAt(0).toUpperCase();
      avatarEl.appendChild(sp);
    }
    el.appendChild(avatarEl);

    /* Author */
    const authorEl = document.createElement('span');
    authorEl.setAttribute('data-part', 'entry-author');
    authorEl.textContent = entry.author;
    el.appendChild(authorEl);

    /* Tag */
    if (showTags) {
      const tagEl = document.createElement('span');
      tagEl.setAttribute('data-part', 'entry-tag');
      tagEl.setAttribute('data-tag', entry.tag);
      tagEl.setAttribute('data-visible', 'true');
      tagEl.style.display = 'inline-block';
      tagEl.style.padding = '2px 8px';
      tagEl.style.borderRadius = '9999px';
      tagEl.style.fontSize = '12px';
      tagEl.style.fontWeight = '600';
      tagEl.style.color = '#fff';
      tagEl.style.backgroundColor = TAG_COLORS[entry.tag];
      tagEl.textContent = TAG_LABELS[entry.tag];
      el.appendChild(tagEl);
    }

    /* Content */
    const contentEl = document.createElement('div');
    contentEl.setAttribute('data-part', 'entry-content');
    contentEl.textContent = entry.content;
    el.appendChild(contentEl);

    /* Timestamp */
    const timestampEl = document.createElement('span');
    timestampEl.setAttribute('data-part', 'entry-timestamp');
    timestampEl.style.fontSize = '12px';
    timestampEl.style.color = '#6b7280';
    timestampEl.textContent = formatTimestamp(entry.timestamp);
    el.appendChild(timestampEl);

    /* Reply button */
    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.setAttribute('data-part', 'reply');
    replyBtn.setAttribute('aria-label', `Reply to ${entry.author}`);
    replyBtn.setAttribute('tabindex', '-1');
    replyBtn.textContent = 'Reply';
    replyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      replyTargetId = entry.id;
      send('REPLY_TO');
      rebuildEntryList();
    });
    el.appendChild(replyBtn);

    /* Collapse toggle */
    if (node.children.length > 0) {
      const isCollapsed = collapsedIds.has(entry.id);
      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.setAttribute('data-part', 'collapse-toggle');
      collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expand replies' : 'Collapse replies');
      collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
      collapseBtn.setAttribute('tabindex', '-1');
      collapseBtn.textContent = isCollapsed ? `Show replies (${node.children.length})` : 'Hide replies';
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collapsedIds.has(entry.id)) collapsedIds.delete(entry.id);
        else collapsedIds.add(entry.id);
        rebuildEntryList();
      });
      el.appendChild(collapseBtn);
    }

    /* Nested replies */
    if (node.children.length > 0 && !collapsedIds.has(entry.id)) {
      const repliesEl = document.createElement('div');
      repliesEl.setAttribute('data-part', 'replies');
      repliesEl.setAttribute('role', 'group');
      repliesEl.setAttribute('aria-label', `Replies to ${entry.author}`);
      for (const child of node.children) {
        repliesEl.appendChild(renderEntryNode(child));
      }
      el.appendChild(repliesEl);
    }

    return el;
  }

  function renderComposeBox(parentEntryEl: HTMLDivElement, entryId: string): void {
    const composeEl = document.createElement('div');
    composeEl.setAttribute('data-part', 'compose');
    composeEl.setAttribute('data-visible', 'true');
    composeEl.setAttribute('role', 'group');
    composeEl.setAttribute('aria-label', 'Reply compose box');
    composeEl.style.marginLeft = '24px';
    composeEl.style.marginTop = '8px';

    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-part', 'compose-input');
    textarea.setAttribute('aria-label', 'Add contribution');
    textarea.setAttribute('role', 'textbox');
    textarea.placeholder = 'Add your contribution...';
    textarea.rows = 3;
    textarea.style.width = '100%';
    textarea.style.resize = 'vertical';
    textarea.value = composeText;
    textarea.addEventListener('input', () => { composeText = textarea.value; });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
    composeEl.appendChild(textarea);

    const actionsEl = document.createElement('div');
    actionsEl.setAttribute('data-part', 'compose-actions');
    actionsEl.style.marginTop = '4px';
    actionsEl.style.display = 'flex';
    actionsEl.style.gap = '8px';

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.setAttribute('data-part', 'compose-send');
    sendBtn.setAttribute('aria-label', 'Send reply');
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', handleSend);
    actionsEl.appendChild(sendBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('data-part', 'compose-cancel');
    cancelBtn.setAttribute('aria-label', 'Cancel reply');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', handleCancel);
    actionsEl.appendChild(cancelBtn);

    composeEl.appendChild(actionsEl);
    parentEntryEl.appendChild(composeEl);

    requestAnimationFrame(() => textarea.focus());
  }

  function handleSend(): void {
    if (replyTargetId && composeText.trim()) {
      onReply?.(replyTargetId, composeText.trim());
    }
    composeText = '';
    replyTargetId = null;
    send('SEND');
    rebuildEntryList();
  }

  function handleCancel(): void {
    composeText = '';
    replyTargetId = null;
    send('CANCEL');
    rebuildEntryList();
  }

  function updateEntrySelections(): void {
    for (const [id, el] of entryRefMap) {
      el.setAttribute('data-selected', selectedEntryId === id ? 'true' : 'false');
      if (selectedEntryId === id) {
        el.style.outline = '2px solid var(--ring, #6366f1)';
      } else {
        el.style.outline = '';
      }
    }
  }

  function rebuildEntryList(): void {
    entryListEl.innerHTML = '';
    entryRefMap.clear();

    const sorted = sortEntries(entries, currentSortMode);
    const tree = buildTree(sorted, maxNesting);
    flatNodes = flattenTree(tree, collapsedIds);

    if (tree.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.setAttribute('data-part', 'empty-state');
      emptyEl.style.color = '#9ca3af';
      emptyEl.style.fontStyle = 'italic';
      emptyEl.textContent = 'No contributions yet.';
      entryListEl.appendChild(emptyEl);
    }

    for (const node of tree) {
      const entryEl = renderEntryNode(node);
      entryListEl.appendChild(entryEl);
    }

    /* Attach compose box to reply target */
    if (sig.get() === 'composing' && replyTargetId) {
      const targetEl = entryRefMap.get(replyTargetId);
      if (targetEl) renderComposeBox(targetEl, replyTargetId);
    }

    /* Restore focus */
    if (focusIndex >= flatNodes.length && flatNodes.length > 0) {
      focusIndex = flatNodes.length - 1;
    }
    const focusedNode = flatNodes[focusIndex];
    if (focusedNode) {
      const el = entryRefMap.get(focusedNode.entry.id);
      if (el) {
        el.setAttribute('tabindex', '0');
      }
    }
  }

  /* Keyboard handler */
  root.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusIndex = Math.min(focusIndex + 1, flatNodes.length - 1);
        focusCurrentEntry();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusIndex = Math.max(focusIndex - 1, 0);
        focusCurrentEntry();
        break;
      case 'ArrowRight': {
        e.preventDefault();
        const node = flatNodes[focusIndex];
        if (node && collapsedIds.has(node.entry.id)) {
          collapsedIds.delete(node.entry.id);
          rebuildEntryList();
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const node = flatNodes[focusIndex];
        if (node && !collapsedIds.has(node.entry.id) && node.children.length > 0) {
          collapsedIds.add(node.entry.id);
          rebuildEntryList();
        }
        break;
      }
      case 'Enter':
      case 'r': {
        e.preventDefault();
        const node = flatNodes[focusIndex];
        if (node) {
          replyTargetId = node.entry.id;
          send('REPLY_TO');
          rebuildEntryList();
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        if (sig.get() === 'composing') handleCancel();
        else if (sig.get() === 'entrySelected') {
          selectedEntryId = null;
          send('DESELECT');
          updateEntrySelections();
        }
        break;
    }
  });

  function focusCurrentEntry(): void {
    for (const el of entryRefMap.values()) el.setAttribute('tabindex', '-1');
    const node = flatNodes[focusIndex];
    if (node) {
      const el = entryRefMap.get(node.entry.id);
      if (el) {
        el.setAttribute('tabindex', '0');
        el.focus();
      }
    }
  }

  rebuildEntryList();

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default DeliberationThread;
