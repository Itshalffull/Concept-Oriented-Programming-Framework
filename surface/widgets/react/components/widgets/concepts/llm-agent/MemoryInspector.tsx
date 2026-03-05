/* ---------------------------------------------------------------------------
 * MemoryInspector — agent memory/context viewer for debugging
 * See widget spec: repertoire/concepts/llm-agent/widgets/memory-inspector.widget
 * ------------------------------------------------------------------------- */

export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH' }
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

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

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

export interface MemoryInspectorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
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
  /** Called when the user confirms deletion of an entry. */
  onDelete?: (id: string) => void;
  /** Called when the active tab changes. */
  onTabChange?: (tab: MemoryInspectorProps['activeTab']) => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const ENTRY_TYPE_ORDER: MemoryEntryType[] = ['fact', 'instruction', 'conversation', 'tool-result'];

const TYPE_LABELS: Record<MemoryEntryType, string> = {
  fact: 'Facts',
  instruction: 'Instructions',
  conversation: 'Conversation',
  'tool-result': 'Tool Results',
};

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
  // Remove empty groups
  for (const [key, val] of map) {
    if (val.length === 0) map.delete(key);
  }
  return map;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const TAB_VALUES: Array<NonNullable<MemoryInspectorProps['activeTab']>> = [
  'working', 'episodic', 'semantic', 'procedural',
];

const TAB_LABELS: Record<string, string> = {
  working: 'Working',
  episodic: 'Episodic',
  semantic: 'Semantic',
  procedural: 'Procedural',
};

const MemoryInspector = forwardRef<HTMLDivElement, MemoryInspectorProps>(function MemoryInspector(
  {
    entries,
    totalTokens,
    maxTokens,
    activeTab = 'working',
    showContext = true,
    onDelete,
    onTabChange,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(memoryInspectorReducer, 'viewing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        (e.source && e.source.toLowerCase().includes(q)),
    );
  }, [entries, searchQuery]);

  // Group filtered entries by type
  const grouped = useMemo(() => groupBy(filteredEntries), [filteredEntries]);

  // Flat list of filtered entries for keyboard navigation
  const flatEntries = useMemo(() => {
    const result: MemoryEntry[] = [];
    for (const type of ENTRY_TYPE_ORDER) {
      const group = grouped.get(type);
      if (group) result.push(...group);
    }
    return result;
  }, [grouped]);

  const selectedEntry = useMemo(
    () => (selectedId ? entries.find((e) => e.id === selectedId) ?? null : null),
    [entries, selectedId],
  );

  const handleSelectEntry = useCallback(
    (id: string) => {
      setSelectedId(id);
      send({ type: 'SELECT_ENTRY', id });
    },
    [],
  );

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    send({ type: 'DESELECT' });
  }, []);

  const handleDelete = useCallback(() => {
    send({ type: 'DELETE' });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (selectedId) onDelete?.(selectedId);
    send({ type: 'CONFIRM' });
    setSelectedId(null);
  }, [selectedId, onDelete]);

  const handleCancelDelete = useCallback(() => {
    send({ type: 'CANCEL' });
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim()) {
        if (state !== 'searching') send({ type: 'SEARCH' });
      } else {
        if (state === 'searching') send({ type: 'CLEAR' });
      }
    },
    [state],
  );

  const handleTabChange = useCallback(
    (tab: NonNullable<MemoryInspectorProps['activeTab']>) => {
      send({ type: 'SWITCH_TAB' });
      onTabChange?.(tab);
    },
    [onTabChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (state === 'deleting') {
          handleCancelDelete();
        } else if (state === 'entrySelected') {
          handleDeselect();
        } else if (state === 'searching') {
          setSearchQuery('');
          send({ type: 'CLEAR' });
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flatEntries.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < flatEntries.length) {
          const entry = flatEntries[focusedIndex];
          if (selectedId === entry.id) {
            handleDeselect();
          } else {
            handleSelectEntry(entry.id);
          }
        }
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        if (state === 'entrySelected') {
          handleDelete();
        }
        return;
      }
    },
    [state, flatEntries, focusedIndex, selectedId, handleDeselect, handleSelectEntry, handleDelete, handleCancelDelete],
  );

  // Token bar percentage
  const tokenPercent = maxTokens > 0 ? Math.min((totalTokens / maxTokens) * 100, 100) : 0;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Memory inspector"
      data-surface-widget=""
      data-widget-name="memory-inspector"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
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
            onClick={() => handleTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div data-part="search" data-state={state}>
        <input
          ref={searchRef}
          type="text"
          role="searchbox"
          aria-label="Search memories"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
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
      <div data-part="working-view" role="list" aria-label="Memory entries" ref={listRef}>
        {ENTRY_TYPE_ORDER.map((type) => {
          const group = grouped.get(type);
          if (!group || group.length === 0) return null;
          return (
            <div key={type} data-part="entry-group" data-type={type} role="group" aria-label={TYPE_LABELS[type]}>
              {/* Group header */}
              <div data-part="group-header" aria-hidden="true">
                <span data-part="group-label">{TYPE_LABELS[type]}</span>
                <span data-part="group-count">{group.length}</span>
              </div>

              {/* Entries */}
              {group.map((entry) => {
                const isSelected = selectedId === entry.id;
                const isFocused = flatEntries[focusedIndex]?.id === entry.id;

                return (
                  <div
                    key={entry.id}
                    data-part="entry"
                    data-type={entry.type}
                    data-selected={isSelected ? 'true' : 'false'}
                    data-focused={isFocused ? 'true' : 'false'}
                    role="listitem"
                    aria-label={`${entry.type}: ${truncate(entry.content, 60)}`}
                    aria-expanded={isSelected}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => {
                      if (isSelected) {
                        handleDeselect();
                      } else {
                        handleSelectEntry(entry.id);
                      }
                    }}
                  >
                    <span data-part="entry-label">
                      {entry.type}
                    </span>

                    <span data-part="entry-content">
                      {isSelected ? entry.content : truncate(entry.content, 120)}
                    </span>

                    {entry.source && (
                      <span data-part="entry-meta" data-meta-type="source">
                        {entry.source}
                      </span>
                    )}

                    {entry.timestamp && (
                      <span data-part="entry-meta" data-meta-type="timestamp">
                        {entry.timestamp}
                      </span>
                    )}

                    {entry.relevance != null && (
                      <span data-part="entry-meta" data-meta-type="relevance">
                        {Math.round(entry.relevance * 100)}%
                      </span>
                    )}

                    {/* Delete button — visible when this entry is selected */}
                    {isSelected && state === 'entrySelected' && (
                      <button
                        type="button"
                        data-part="delete"
                        aria-label="Delete memory entry"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete();
                        }}
                      >
                        Delete
                      </button>
                    )}

                    {/* Confirm/cancel delete — visible in deleting state for this entry */}
                    {isSelected && state === 'deleting' && (
                      <div data-part="delete-confirm" role="alertdialog" aria-label="Confirm deletion">
                        <span>Delete this memory entry?</span>
                        <button
                          type="button"
                          data-part="confirm-button"
                          aria-label="Confirm delete"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDelete();
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          data-part="cancel-button"
                          aria-label="Cancel delete"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDelete();
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {filteredEntries.length === 0 && (
          <div data-part="empty-state" role="status" aria-live="polite">
            {searchQuery ? 'No matching entries found.' : 'No memory entries.'}
          </div>
        )}
      </div>
    </div>
  );
});

MemoryInspector.displayName = 'MemoryInspector';
export { MemoryInspector };
export default MemoryInspector;
