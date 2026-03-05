/* ---------------------------------------------------------------------------
 * MemoryInspector — Server Component
 *
 * Inspector panel for viewing agent memory state. Shows memory entries
 * grouped by type with token usage bar, tabs, and search.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type MemoryEntryType = 'fact' | 'instruction' | 'conversation' | 'tool-result';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  source?: string;
  timestamp?: string;
  relevance?: number;
}

/* ---------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const ENTRY_TYPE_ORDER: MemoryEntryType[] = ['fact', 'instruction', 'conversation', 'tool-result'];

const TYPE_LABELS: Record<MemoryEntryType, string> = {
  fact: 'Facts',
  instruction: 'Instructions',
  conversation: 'Conversation',
  'tool-result': 'Tool Results',
};

const TAB_VALUES = ['working', 'episodic', 'semantic', 'procedural'] as const;

const TAB_LABELS: Record<string, string> = {
  working: 'Working',
  episodic: 'Episodic',
  semantic: 'Semantic',
  procedural: 'Procedural',
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

function groupBy(entries: MemoryEntry[]): Map<MemoryEntryType, MemoryEntry[]> {
  const map = new Map<MemoryEntryType, MemoryEntry[]>();
  for (const t of ENTRY_TYPE_ORDER) map.set(t, []);
  for (const entry of entries) {
    const list = map.get(entry.type);
    if (list) list.push(entry);
  }
  for (const [key, val] of map) {
    if (val.length === 0) map.delete(key);
  }
  return map;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MemoryInspectorProps {
  /** Memory entries to display. */
  entries: MemoryEntry[];
  /** Current token usage. */
  totalTokens: number;
  /** Maximum token budget. */
  maxTokens: number;
  /** Active memory type tab. */
  activeTab?: 'working' | 'episodic' | 'semantic' | 'procedural';
  /** Show the context/token bar. */
  showContext?: boolean;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function MemoryInspector({
  entries,
  totalTokens,
  maxTokens,
  activeTab = 'working',
  showContext = true,
}: MemoryInspectorProps) {
  const grouped = groupBy(entries);
  const tokenPercent = maxTokens > 0 ? Math.min((totalTokens / maxTokens) * 100, 100) : 0;

  return (
    <div
      role="region"
      aria-label="Memory inspector"
      data-surface-widget=""
      data-widget-name="memory-inspector"
      data-part="root"
      data-state="viewing"
      tabIndex={0}
    >
      {/* Tabs */}
      <div data-part="tabs" data-active={activeTab} role="tablist" aria-label="Memory types">
        {TAB_VALUES.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === activeTab}
            data-part="tab"
            data-active={tab === activeTab ? 'true' : 'false'}
            tabIndex={tab === activeTab ? 0 : -1}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div data-part="search" data-state="viewing">
        <input
          type="text"
          role="searchbox"
          aria-label="Search memories"
          placeholder="Search memories..."
          data-part="search-input"
        />
      </div>

      {/* Context / token usage bar */}
      {showContext && (
        <div
          data-part="context-bar"
          data-visible="true"
          role="img"
          aria-label={`Context window allocation: ${formatNumber(totalTokens)} of ${formatNumber(maxTokens)} tokens used`}
        >
          <div
            data-part="context-bar-fill"
            style={{ width: `${tokenPercent}%` }}
            aria-hidden="true"
          />
          <span data-part="context-bar-label" aria-hidden="true">
            {formatNumber(totalTokens)} / {formatNumber(maxTokens)} tokens
          </span>
        </div>
      )}

      {/* Entry list grouped by type */}
      <div data-part="working-view" role="list" aria-label="Memory entries">
        {ENTRY_TYPE_ORDER.map((type) => {
          const group = grouped.get(type);
          if (!group || group.length === 0) return null;
          return (
            <div key={type} data-part="entry-group" data-type={type} role="group" aria-label={TYPE_LABELS[type]}>
              <div data-part="group-header" aria-hidden="true">
                <span data-part="group-label">{TYPE_LABELS[type]}</span>
                <span data-part="group-count">{group.length}</span>
              </div>

              {group.map((entry) => (
                <div
                  key={entry.id}
                  data-part="entry"
                  data-type={entry.type}
                  data-selected="false"
                  role="listitem"
                  aria-label={`${entry.type}: ${truncate(entry.content, 60)}`}
                  tabIndex={-1}
                >
                  <span data-part="entry-label">{entry.type}</span>
                  <span data-part="entry-content">{truncate(entry.content, 120)}</span>

                  {entry.source && (
                    <span data-part="entry-meta" data-meta-type="source">{entry.source}</span>
                  )}
                  {entry.timestamp && (
                    <span data-part="entry-meta" data-meta-type="timestamp">{entry.timestamp}</span>
                  )}
                  {entry.relevance != null && (
                    <span data-part="entry-meta" data-meta-type="relevance">
                      {Math.round(entry.relevance * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {entries.length === 0 && (
          <div data-part="empty-state" role="status" aria-live="polite">
            No memory entries.
          </div>
        )}
      </div>
    </div>
  );
}

export { MemoryInspector };
