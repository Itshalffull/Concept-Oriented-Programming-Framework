/* ---------------------------------------------------------------------------
 * AgentTimeline — chronological timeline of agent actions
 * Shows thinking, tool calls, tool results, responses, and errors with
 * expand/collapse, filtering, keyboard navigation, and running indicators.
 * See widget spec: repertoire/concepts/llm-agent/widgets/agent-timeline.widget
 * ------------------------------------------------------------------------- */

export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY'; id?: string }
  | { type: 'INTERRUPT' }
  | { type: 'DESELECT' }
  | { type: 'RESUME' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' };

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
    case 'inactive':
      if (event.type === 'STREAM_START') return 'active';
      return state;
    case 'active':
      if (event.type === 'STREAM_END') return 'inactive';
      return state;
    default:
      return state;
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
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type EntryType = 'thought' | 'tool-call' | 'tool-result' | 'response' | 'error';
export type EntryStatus = 'running' | 'complete' | 'error';

export interface TimelineEntry {
  id: string;
  type: EntryType;
  label: string;
  timestamp: string;
  duration?: number;
  detail?: ReactNode;
  status?: EntryStatus;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface AgentTimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Timeline entries to display chronologically. */
  entries: TimelineEntry[];
  /** Name of the agent. */
  agentName: string;
  /** Agent execution status (e.g. "running", "idle", "complete"). */
  status: string;
  /** Show delegation indicators. */
  showDelegations?: boolean;
  /** Auto-scroll to latest entry. */
  autoScroll?: boolean;
  /** Maximum number of entries to display. */
  maxEntries?: number;
  /** Callback fired when the interrupt button is pressed. */
  onInterrupt?: () => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

// Text-based icons (no emoji) per the spec
const TYPE_TEXT_ICONS: Record<EntryType, string> = {
  'thought': '\u2022\u2022\u2022',  // bullet dots for thinking
  'tool-call': '\u2699',            // gear for tool-call
  'tool-result': '\u2611',          // ballot box with check for tool-result
  'response': '\u25B6',             // play triangle for response
  'error': '\u2717',                // x mark for error
};

const TYPE_LABELS: Record<EntryType, string> = {
  'thought': 'Thought',
  'tool-call': 'Tool Call',
  'tool-result': 'Tool Result',
  'response': 'Response',
  'error': 'Error',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const AgentTimeline = forwardRef<HTMLDivElement, AgentTimelineProps>(function AgentTimeline(
  {
    entries,
    agentName,
    status,
    showDelegations = true,
    autoScroll = true,
    maxEntries = 100,
    onInterrupt,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(agentTimelineReducer, 'idle');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<EntryType | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const timelineRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Apply maxEntries limit
  const visibleEntries = useMemo(() => {
    const limited = entries.slice(-maxEntries);
    if (typeFilter) {
      return limited.filter((e) => e.type === typeFilter);
    }
    return limited;
  }, [entries, maxEntries, typeFilter]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

  // Toggle expand/collapse for an entry
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle entry click — select and expand
  const handleEntryClick = useCallback((entry: TimelineEntry, index: number) => {
    setSelectedEntryId(entry.id);
    setFocusedIndex(index);
    toggleExpand(entry.id);
    send({ type: 'SELECT_ENTRY', id: entry.id });
  }, [toggleExpand]);

  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    send({ type: 'INTERRUPT' });
    onInterrupt?.();
  }, [onInterrupt]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.min(prev + 1, visibleEntries.length - 1);
        const entry = visibleEntries[next];
        if (entry) {
          const el = entryRefs.current.get(entry.id);
          el?.focus();
        }
        return next;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        const entry = visibleEntries[next];
        if (entry) {
          const el = entryRefs.current.get(entry.id);
          el?.focus();
        }
        return next;
      });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < visibleEntries.length) {
        const entry = visibleEntries[focusedIndex];
        toggleExpand(entry.id);
        setSelectedEntryId(entry.id);
        send({ type: 'SELECT_ENTRY', id: entry.id });
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedEntryId(null);
      send({ type: 'DESELECT' });
    }
    if (e.key === 'i') {
      // Only interrupt when not typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleInterrupt();
      }
    }
  }, [focusedIndex, visibleEntries, toggleExpand, handleInterrupt]);

  // Filter button types
  const allTypes: EntryType[] = ['thought', 'tool-call', 'tool-result', 'response', 'error'];

  return (
    <div
      ref={ref}
      role="log"
      aria-label={`Agent timeline: ${agentName}`}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="agent-timeline"
      data-part="root"
      data-state={state}
      data-agent={agentName}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Header — agent name and status */}
      <div data-part="header" data-status={status}>
        <span data-part="agent-badge">{agentName}</span>
        <span data-part="status-indicator" data-status={status}>
          {status === 'running' ? '\u25CF' : '\u25CB'}{/* filled/empty circle */}
          {' '}{status}
        </span>
        {status === 'running' && (
          <button
            type="button"
            data-part="interrupt"
            data-visible="true"
            aria-label="Interrupt agent"
            tabIndex={0}
            onClick={handleInterrupt}
          >
            {children ?? 'Interrupt'}
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div data-part="filter-bar" role="toolbar" aria-label="Filter by entry type">
        <button
          type="button"
          data-part="filter-button"
          data-active={typeFilter === null ? 'true' : 'false'}
          aria-pressed={typeFilter === null}
          onClick={() => setTypeFilter(null)}
        >
          All
        </button>
        {allTypes.map((t) => (
          <button
            key={t}
            type="button"
            data-part="filter-button"
            data-filter-type={t}
            data-active={typeFilter === t ? 'true' : 'false'}
            aria-pressed={typeFilter === t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
          >
            {TYPE_TEXT_ICONS[t]} {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Interrupted banner */}
      {state === 'interrupted' && (
        <div data-part="interrupt-banner" role="alert">
          Agent execution interrupted
        </div>
      )}

      {/* Timeline entries */}
      <div
        ref={timelineRef}
        data-part="timeline"
        role="list"
        aria-label="Timeline entries"
      >
        {visibleEntries.map((entry, index) => {
          const isExpanded = expandedIds.has(entry.id);
          const isSelected = selectedEntryId === entry.id;
          const isFocused = focusedIndex === index;
          const isRunning = entry.status === 'running';

          return (
            <div
              key={entry.id}
              ref={(el) => {
                if (el) {
                  entryRefs.current.set(entry.id, el);
                } else {
                  entryRefs.current.delete(entry.id);
                }
              }}
              role="listitem"
              aria-label={`${TYPE_LABELS[entry.type]}: ${entry.label}`}
              data-part="entry"
              data-type={entry.type}
              data-status={entry.status ?? 'complete'}
              data-selected={isSelected ? 'true' : 'false'}
              data-expanded={isExpanded ? 'true' : 'false'}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => handleEntryClick(entry, index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEntryClick(entry, index);
                }
              }}
            >
              {/* Type icon */}
              <span data-part="type-badge" data-type={entry.type} aria-hidden="true">
                {TYPE_TEXT_ICONS[entry.type]}
              </span>

              {/* Entry label and metadata */}
              <div data-part="entry-body">
                <span data-part="entry-label">{entry.label}</span>

                {/* Running indicator */}
                {isRunning && (
                  <span
                    data-part="running-indicator"
                    data-visible="true"
                    role="status"
                    aria-label="Running"
                  >
                    {'\u25CB'}{/* spinning circle placeholder */}
                  </span>
                )}

                {/* Duration for completed entries */}
                {entry.duration != null && entry.status !== 'running' && (
                  <span data-part="duration" data-visible="true">
                    {formatDuration(entry.duration)}
                  </span>
                )}

                {/* Timestamp */}
                <span data-part="timestamp">{entry.timestamp}</span>
              </div>

              {/* Expanded detail content */}
              {isExpanded && entry.detail && (
                <div data-part="content" data-visible="true">
                  {entry.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

AgentTimeline.displayName = 'AgentTimeline';
export { AgentTimeline };
export default AgentTimeline;
