/* ---------------------------------------------------------------------------
 * DeliberationThread state machine
 * States: viewing (initial), composing, entrySelected
 * See widget spec: deliberation-thread.widget
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
  /** ID of the entry being replied to (composing state). */
  replyTargetId: string | null;
  /** ID of the currently selected entry (entrySelected state). */
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

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Argument tag types and color mapping
 * Invariant: green=for, red=against, blue=question, yellow=amendment
 * ------------------------------------------------------------------------- */

/** Valid argument tags for deliberation entries. */
export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';

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

/** Sort mode for entries within the thread. */
export type SortMode = 'time' | 'tag' | 'relevance';

/* ---------------------------------------------------------------------------
 * Entry types
 * ------------------------------------------------------------------------- */

/** A single deliberation entry (message/argument). */
export interface DeliberationEntry {
  /** Unique identifier for the entry. */
  id: string;
  /** Author display name. */
  author: string;
  /** Optional avatar URL or initial. */
  avatar?: string;
  /** Entry body content (plain text or markdown). */
  content: string;
  /** ISO timestamp string. */
  timestamp: string;
  /** Argument tag classification. */
  tag: ArgumentTag;
  /** ID of the parent entry if this is a reply; null/undefined for top-level. */
  parentId?: string | null;
  /** Relevance score (0-100) used for relevance sorting. */
  relevance?: number;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Build a nested tree from a flat entries array. */
interface EntryNode {
  entry: DeliberationEntry;
  children: EntryNode[];
  depth: number;
}

function buildTree(entries: DeliberationEntry[], maxNesting: number): EntryNode[] {
  const byId = new Map<string, EntryNode>();
  const roots: EntryNode[] = [];

  // First pass: create nodes
  for (const entry of entries) {
    byId.set(entry.id, { entry, children: [], depth: 0 });
  }

  // Second pass: link parent-child, respecting maxNesting
  for (const entry of entries) {
    const node = byId.get(entry.id)!;
    if (entry.parentId && byId.has(entry.parentId)) {
      const parent = byId.get(entry.parentId)!;
      // If parent depth already at max, attach to the last valid ancestor
      if (parent.depth < maxNesting) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        // Cap at maxNesting: attach as sibling at max depth
        node.depth = maxNesting;
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Sort entries according to the selected mode. */
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

/** Flatten a tree into a list for keyboard navigation, in display order. */
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

/** Compute sentiment summary from entries. */
function computeSentiment(entries: DeliberationEntry[]): { forCount: number; againstCount: number; ratio: number } {
  let forCount = 0;
  let againstCount = 0;
  for (const e of entries) {
    if (e.tag === 'for') forCount++;
    else if (e.tag === 'against') againstCount++;
  }
  const total = forCount + againstCount;
  return {
    forCount,
    againstCount,
    ratio: total > 0 ? forCount / total : 0.5,
  };
}

/** Format a timestamp for display. */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DeliberationThreadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of deliberation entries (flat; nesting derived from parentId). */
  entries: DeliberationEntry[];
  /** Thread status (e.g. "open", "closed", "voting"). */
  status: string;
  /** Optional summary text for the thread header. */
  summary?: string;
  /** Whether to display the sentiment bar (default: true). */
  showSentiment?: boolean;
  /** Whether to display argument tags (default: true). */
  showTags?: boolean;
  /** Maximum nesting depth for replies (default: 3). */
  maxNesting?: number;
  /** Sort mode (default: "time"). */
  sortMode?: SortMode;
  /** Callback when a reply is submitted. Receives parent entry ID and content. */
  onReply?: (parentId: string, content: string) => void;
  /** Callback when sort mode changes. */
  onSortChange?: (mode: SortMode) => void;
  /** Callback when an entry is selected. */
  onEntrySelect?: (entryId: string) => void;
  /** Optional slot content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const INITIAL_CTX: DeliberationThreadMachineContext = {
  state: 'viewing',
  replyTargetId: null,
  selectedEntryId: null,
};

const DeliberationThread = forwardRef<HTMLDivElement, DeliberationThreadProps>(function DeliberationThread(
  {
    entries,
    status,
    summary,
    showSentiment = true,
    showTags = true,
    maxNesting = 3,
    sortMode: controlledSortMode,
    onReply,
    onSortChange,
    onEntrySelect,
    children,
    ...rest
  },
  ref,
) {
  const [ctx, send] = useReducer(deliberationThreadReducer, INITIAL_CTX);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [internalSortMode, setInternalSortMode] = useState<SortMode>('time');
  const [composeText, setComposeText] = useState('');
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const sortMode = controlledSortMode ?? internalSortMode;

  // Sort entries, build tree, flatten for navigation
  const sortedEntries = useMemo(() => sortEntries(entries, sortMode), [entries, sortMode]);
  const tree = useMemo(() => buildTree(sortedEntries, maxNesting), [sortedEntries, maxNesting]);
  const flatNodes = useMemo(() => flattenTree(tree, collapsedIds), [tree, collapsedIds]);

  // Sentiment
  const sentiment = useMemo(() => computeSentiment(entries), [entries]);

  // Focus compose box when entering composing state
  useEffect(() => {
    if (ctx.state === 'composing') {
      // Defer to next tick so the textarea is rendered
      requestAnimationFrame(() => {
        composeRef.current?.focus();
      });
    }
  }, [ctx.state]);

  // Keep focusIndex in bounds
  useEffect(() => {
    if (focusIndex >= flatNodes.length && flatNodes.length > 0) {
      setFocusIndex(flatNodes.length - 1);
    }
  }, [flatNodes.length, focusIndex]);

  // Focus the current entry element when focusIndex changes
  useEffect(() => {
    const node = flatNodes[focusIndex];
    if (node) {
      const el = entryRefs.current.get(node.entry.id);
      el?.focus();
    }
  }, [focusIndex, flatNodes]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSortChange = useCallback(
    (mode: SortMode) => {
      setInternalSortMode(mode);
      onSortChange?.(mode);
    },
    [onSortChange],
  );

  const handleSend = useCallback(() => {
    if (ctx.replyTargetId && composeText.trim()) {
      onReply?.(ctx.replyTargetId, composeText.trim());
    }
    setComposeText('');
    send({ type: 'SEND' });
  }, [ctx.replyTargetId, composeText, onReply]);

  const handleCancel = useCallback(() => {
    setComposeText('');
    send({ type: 'CANCEL' });
  }, []);

  /** Root keyboard handler for feed navigation. */
  const handleRootKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Do not intercept typing in compose box
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
          setFocusIndex((i) => Math.min(i + 1, flatNodes.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((i) => Math.max(i - 1, 0));
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const node = flatNodes[focusIndex];
          if (node && collapsedIds.has(node.entry.id)) {
            toggleCollapse(node.entry.id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const node = flatNodes[focusIndex];
          if (node && !collapsedIds.has(node.entry.id) && node.children.length > 0) {
            toggleCollapse(node.entry.id);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const node = flatNodes[focusIndex];
          if (node) {
            send({ type: 'REPLY_TO', entryId: node.entry.id });
          }
          break;
        }
        case 'r': {
          e.preventDefault();
          const node = flatNodes[focusIndex];
          if (node) {
            send({ type: 'REPLY_TO', entryId: node.entry.id });
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          if (ctx.state === 'composing') {
            handleCancel();
          } else if (ctx.state === 'entrySelected') {
            send({ type: 'DESELECT' });
          }
          break;
      }
    },
    [flatNodes, focusIndex, collapsedIds, ctx.state, toggleCollapse, handleCancel],
  );

  /** Ref callback to register entry DOM elements. */
  const setEntryRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      entryRefs.current.set(id, el);
    } else {
      entryRefs.current.delete(id);
    }
  }, []);

  /* ---------------------------------------------------------------------------
   * Recursive entry renderer
   * ------------------------------------------------------------------------- */

  function renderEntryNode(node: EntryNode, index: number): ReactNode {
    const { entry } = node;
    const isCollapsed = collapsedIds.has(entry.id);
    const isSelected = ctx.selectedEntryId === entry.id;
    const isReplyTarget = ctx.replyTargetId === entry.id;
    const isFocused = flatNodes[focusIndex]?.entry.id === entry.id;
    const hasChildren = node.children.length > 0;

    return (
      <div
        key={entry.id}
        ref={(el) => setEntryRef(entry.id, el)}
        role="article"
        aria-label={`${entry.author}: ${TAG_LABELS[entry.tag]} \u2014 ${formatTimestamp(entry.timestamp)}`}
        aria-setsize={-1}
        aria-posinset={index + 1}
        data-part="entry"
        data-tag={entry.tag}
        data-selected={isSelected ? 'true' : 'false'}
        data-depth={node.depth}
        tabIndex={isFocused ? 0 : -1}
        style={{
          marginLeft: `${node.depth * 24}px`,
          outline: isSelected ? '2px solid var(--ring, #6366f1)' : undefined,
        }}
        onClick={() => {
          if (ctx.state === 'entrySelected' && isSelected) {
            send({ type: 'DESELECT' });
          } else {
            send({ type: 'SELECT_ENTRY', entryId: entry.id });
            onEntrySelect?.(entry.id);
          }
        }}
      >
        {/* Entry avatar */}
        <div data-part="entry-avatar" aria-hidden="true">
          {entry.avatar ? (
            <img
              src={entry.avatar}
              alt=""
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {entry.author.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Entry author */}
        <span data-part="entry-author">{entry.author}</span>

        {/* Argument tag badge */}
        {showTags && (
          <span
            data-part="entry-tag"
            data-tag={entry.tag}
            data-visible="true"
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              backgroundColor: TAG_COLORS[entry.tag],
            }}
          >
            {TAG_LABELS[entry.tag]}
          </span>
        )}

        {/* Entry content */}
        <div data-part="entry-content">{entry.content}</div>

        {/* Entry timestamp */}
        <span data-part="entry-timestamp" style={{ fontSize: 12, color: '#6b7280' }}>
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Reply button */}
        <button
          type="button"
          data-part="reply"
          aria-label={`Reply to ${entry.author}`}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            send({ type: 'REPLY_TO', entryId: entry.id });
          }}
        >
          Reply
        </button>

        {/* Collapse/expand toggle for entries with children */}
        {hasChildren && (
          <button
            type="button"
            data-part="collapse-toggle"
            aria-label={isCollapsed ? 'Expand replies' : 'Collapse replies'}
            aria-expanded={!isCollapsed}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(entry.id);
            }}
          >
            {isCollapsed ? `Show replies (${node.children.length})` : 'Hide replies'}
          </button>
        )}

        {/* Inline compose box when replying to this entry */}
        {ctx.state === 'composing' && isReplyTarget && (
          <div
            data-part="compose"
            data-visible="true"
            role="group"
            aria-label="Reply compose box"
            style={{ marginLeft: 24, marginTop: 8 }}
          >
            <textarea
              ref={composeRef}
              data-part="compose-input"
              aria-label="Add contribution"
              role="textbox"
              placeholder="Add your contribution..."
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSend();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancel();
                }
              }}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <div data-part="compose-actions" style={{ marginTop: 4, display: 'flex', gap: 8 }}>
              <button
                type="button"
                data-part="compose-send"
                aria-label="Send reply"
                onClick={handleSend}
              >
                Send
              </button>
              <button
                type="button"
                data-part="compose-cancel"
                aria-label="Cancel reply"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {hasChildren && !isCollapsed && (
          <div data-part="replies" role="group" aria-label={`Replies to ${entry.author}`}>
            {node.children.map((child, childIdx) => renderEntryNode(child, childIdx))}
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------- */

  return (
    <div
      ref={ref}
      role="feed"
      aria-label="Deliberation thread"
      data-surface-widget=""
      data-widget-name="deliberation-thread"
      data-part="root"
      data-state={ctx.state}
      data-status={status}
      tabIndex={0}
      onKeyDown={handleRootKeyDown}
      {...rest}
    >
      {/* Header: thread status and summary */}
      <div data-part="header" data-state={ctx.state}>
        <span data-part="header-status" style={{ fontWeight: 600, textTransform: 'capitalize' }}>
          {status}
        </span>
        {summary && (
          <p data-part="header-summary" style={{ marginTop: 4 }}>
            {summary}
          </p>
        )}
        {/* Sort controls */}
        <div data-part="sort-controls" role="group" aria-label="Sort entries">
          {(['time', 'tag', 'relevance'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              data-part="sort-button"
              data-sort={mode}
              data-active={sortMode === mode ? 'true' : 'false'}
              aria-pressed={sortMode === mode}
              tabIndex={-1}
              onClick={() => handleSortChange(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sentiment bar: for/against ratio */}
      {showSentiment && (
        <div
          data-part="sentiment"
          data-visible="true"
          role="img"
          aria-label={`Sentiment: ${sentiment.forCount} for, ${sentiment.againstCount} against`}
          style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}
        >
          <div
            data-part="sentiment-for"
            style={{
              width: `${sentiment.ratio * 100}%`,
              backgroundColor: TAG_COLORS.for,
              transition: 'width 0.3s ease',
            }}
            aria-hidden="true"
          />
          <div
            data-part="sentiment-against"
            style={{
              width: `${(1 - sentiment.ratio) * 100}%`,
              backgroundColor: TAG_COLORS.against,
              transition: 'width 0.3s ease',
            }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Entry list */}
      <div data-part="entry-list" role="feed" aria-label="Contributions">
        {tree.length === 0 && (
          <p data-part="empty-state" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
            No contributions yet.
          </p>
        )}
        {tree.map((node, idx) => renderEntryNode(node, idx))}
      </div>

      {/* Slot for custom content */}
      {children}
    </div>
  );
});

DeliberationThread.displayName = 'DeliberationThread';
export { DeliberationThread };
export default DeliberationThread;
