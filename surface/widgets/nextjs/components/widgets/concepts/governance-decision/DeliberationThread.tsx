import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type ArgumentTag = 'for' | 'against' | 'question' | 'amendment';
export type SortMode = 'time' | 'tag' | 'relevance';

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

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

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
      if (parent.depth < maxNesting) {
        node.depth = parent.depth + 1;
      } else {
        node.depth = maxNesting;
      }
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
  entries: DeliberationEntry[];
  status: string;
  summary?: string;
  showSentiment?: boolean;
  showTags?: boolean;
  maxNesting?: number;
  sortMode?: SortMode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Recursive entry renderer (pure, no hooks)
 * ------------------------------------------------------------------------- */

function renderEntryNode(node: EntryNode, showTags: boolean): ReactNode {
  const { entry } = node;
  const hasChildren = node.children.length > 0;

  return (
    <div
      key={entry.id}
      role="article"
      aria-label={`${entry.author}: ${TAG_LABELS[entry.tag]} \u2014 ${formatTimestamp(entry.timestamp)}`}
      data-part="entry"
      data-tag={entry.tag}
      data-selected="false"
      data-depth={node.depth}
      style={{ marginLeft: `${node.depth * 24}px` }}
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

      {/* Reply button (static in server component) */}
      <button
        type="button"
        data-part="reply"
        aria-label={`Reply to ${entry.author}`}
        tabIndex={-1}
      >
        Reply
      </button>

      {/* Collapse toggle (static placeholder — client wrapper needed for interactivity) */}
      {hasChildren && (
        <button
          type="button"
          data-part="collapse-toggle"
          aria-label="Expand replies"
          aria-expanded={true}
          tabIndex={-1}
        >
          {`Hide replies`}
        </button>
      )}

      {/* Nested replies */}
      {hasChildren && (
        <div data-part="replies" role="group" aria-label={`Replies to ${entry.author}`}>
          {node.children.map((child) => renderEntryNode(child, showTags))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function DeliberationThread({
  entries,
  status,
  summary,
  showSentiment = true,
  showTags = true,
  maxNesting = 3,
  sortMode = 'time',
  children,
  ...rest
}: DeliberationThreadProps) {
  const sortedEntries = sortEntries(entries, sortMode);
  const tree = buildTree(sortedEntries, maxNesting);
  const sentiment = computeSentiment(entries);

  return (
    <div
      role="feed"
      aria-label="Deliberation thread"
      data-surface-widget=""
      data-widget-name="deliberation-thread"
      data-part="root"
      data-state="viewing"
      data-status={status}
      tabIndex={0}
      {...rest}
    >
      {/* Header */}
      <div data-part="header" data-state="viewing">
        <span data-part="header-status" style={{ fontWeight: 600, textTransform: 'capitalize' }}>
          {status}
        </span>
        {summary && (
          <p data-part="header-summary" style={{ marginTop: 4 }}>
            {summary}
          </p>
        )}
        {/* Sort controls (static labels — interactivity requires client wrapper) */}
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
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sentiment bar */}
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
            }}
            aria-hidden="true"
          />
          <div
            data-part="sentiment-against"
            style={{
              width: `${(1 - sentiment.ratio) * 100}%`,
              backgroundColor: TAG_COLORS.against,
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
        {tree.map((node) => renderEntryNode(node, showTags))}
      </div>

      {children}
    </div>
  );
}

export { DeliberationThread };
