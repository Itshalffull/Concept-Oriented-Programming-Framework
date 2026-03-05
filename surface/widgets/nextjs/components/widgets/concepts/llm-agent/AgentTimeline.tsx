/* ---------------------------------------------------------------------------
 * AgentTimeline — Server Component
 *
 * Chronological timeline of agent actions: thoughts, tool calls,
 * tool results, responses, and errors with type badges and status.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

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
 * Constants
 * ------------------------------------------------------------------------- */

const TYPE_TEXT_ICONS: Record<EntryType, string> = {
  'thought': '\u2022\u2022\u2022',
  'tool-call': '\u2699',
  'tool-result': '\u2611',
  'response': '\u25B6',
  'error': '\u2717',
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
 * Props
 * ------------------------------------------------------------------------- */

export interface AgentTimelineProps {
  /** Timeline entries to display chronologically. */
  entries: TimelineEntry[];
  /** Name of the agent. */
  agentName: string;
  /** Agent execution status. */
  status: string;
  /** Show delegation indicators. */
  showDelegations?: boolean;
  /** Maximum number of entries to display. */
  maxEntries?: number;
  /** Children rendered in the interrupt button slot. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function AgentTimeline({
  entries,
  agentName,
  status,
  showDelegations: _showDelegations = true,
  maxEntries = 100,
  children,
}: AgentTimelineProps) {
  const visibleEntries = entries.slice(-maxEntries);
  const allTypes: EntryType[] = ['thought', 'tool-call', 'tool-result', 'response', 'error'];

  return (
    <div
      role="log"
      aria-label={`Agent timeline: ${agentName}`}
      aria-live="polite"
      data-surface-widget=""
      data-widget-name="agent-timeline"
      data-part="root"
      data-state="idle"
      data-agent={agentName}
      tabIndex={0}
    >
      {/* Header */}
      <div data-part="header" data-status={status}>
        <span data-part="agent-badge">{agentName}</span>
        <span data-part="status-indicator" data-status={status}>
          {status === 'running' ? '\u25CF' : '\u25CB'} {status}
        </span>
        {status === 'running' && (
          <button
            type="button"
            data-part="interrupt"
            data-visible="true"
            aria-label="Interrupt agent"
            tabIndex={0}
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
          data-active="true"
          aria-pressed={true}
        >
          All
        </button>
        {allTypes.map((t) => (
          <button
            key={t}
            type="button"
            data-part="filter-button"
            data-filter-type={t}
            data-active="false"
            aria-pressed={false}
          >
            {TYPE_TEXT_ICONS[t]} {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Timeline entries */}
      <div
        data-part="timeline"
        role="list"
        aria-label="Timeline entries"
      >
        {visibleEntries.map((entry) => {
          const isRunning = entry.status === 'running';

          return (
            <div
              key={entry.id}
              role="listitem"
              aria-label={`${TYPE_LABELS[entry.type]}: ${entry.label}`}
              data-part="entry"
              data-type={entry.type}
              data-status={entry.status ?? 'complete'}
              data-selected="false"
              data-expanded="false"
              tabIndex={-1}
            >
              {/* Type icon */}
              <span data-part="type-badge" data-type={entry.type} aria-hidden="true">
                {TYPE_TEXT_ICONS[entry.type]}
              </span>

              {/* Entry label and metadata */}
              <div data-part="entry-body">
                <span data-part="entry-label">{entry.label}</span>

                {isRunning && (
                  <span
                    data-part="running-indicator"
                    data-visible="true"
                    role="status"
                    aria-label="Running"
                  >
                    {'\u25CB'}
                  </span>
                )}

                {entry.duration != null && entry.status !== 'running' && (
                  <span data-part="duration" data-visible="true">
                    {formatDuration(entry.duration)}
                  </span>
                )}

                <span data-part="timestamp">{entry.timestamp}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { AgentTimeline };
