import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';

export interface Guard {
  id?: string;
  name: string;
  description: string;
  status: GuardStatus;
  lastChecked?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<GuardStatus, string> = {
  passing: '\u2713',
  failing: '\u2717',
  pending: '\u23F3',
  bypassed: '\u2298',
};

const STATUS_LABELS: Record<GuardStatus, string> = {
  passing: 'Passing',
  failing: 'Failing',
  pending: 'Pending',
  bypassed: 'Bypassed',
};

type OverallStatus = 'all-passing' | 'has-failing' | 'has-pending';

function deriveOverallStatus(guards: Guard[]): OverallStatus {
  if (guards.length === 0) return 'all-passing';
  if (guards.some((g) => g.status === 'failing')) return 'has-failing';
  if (guards.some((g) => g.status === 'pending')) return 'has-pending';
  return 'all-passing';
}

function formatLastChecked(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GuardStatusPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  guards: Guard[];
  executionStatus: string;
  showConditions?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function GuardStatusPanel({
  guards,
  executionStatus,
  showConditions = true,
  children,
  ...rest
}: GuardStatusPanelProps) {
  const overallStatus = deriveOverallStatus(guards);
  const passingCount = guards.filter((g) => g.status === 'passing').length;
  const hasBlockingGuards = guards.some((g) => g.status === 'failing');

  return (
    <div
      role="region"
      aria-label="Pre-execution guards"
      data-surface-widget=""
      data-widget-name="guard-status-panel"
      data-part="root"
      data-state="idle"
      data-overall-status={overallStatus}
      data-execution-status={executionStatus}
      tabIndex={-1}
      {...rest}
    >
      {/* Header */}
      <div data-part="header" data-state="idle" data-overall-status={overallStatus}>
        <h3 data-part="heading">Pre-execution Guards</h3>
        <span data-part="summary" aria-live="polite">
          {passingCount} of {guards.length} guards passing
        </span>
      </div>

      {/* Blocking banner */}
      {hasBlockingGuards && (
        <div data-part="blocking-banner" data-visible="true" role="alert">
          Execution is blocked by failing guards
        </div>
      )}

      {/* Guard list */}
      <div data-part="guard-list" role="list">
        {guards.map((guard, index) => {
          const guardId = guard.id ?? guard.name;

          return (
            <div
              key={guardId}
              data-part="guard-item"
              data-status={guard.status}
              data-selected="false"
              role="listitem"
              aria-label={`${guard.name} \u2014 ${STATUS_LABELS[guard.status]}`}
              aria-expanded={false}
              tabIndex={index === 0 ? 0 : -1}
            >
              {/* Status icon */}
              <span data-part="guard-icon" data-status={guard.status} aria-hidden="true">
                {STATUS_ICONS[guard.status]}
              </span>

              {/* Guard name */}
              <span data-part="guard-name">{guard.name}</span>

              {/* Guard condition */}
              {showConditions && (
                <span data-part="guard-condition" data-visible="true">
                  {guard.description}
                </span>
              )}

              {/* Status badge */}
              <span data-part="guard-status" data-status={guard.status}>
                {STATUS_LABELS[guard.status]}
              </span>

              {/* Last checked (shown inline for server component) */}
              {guard.lastChecked && (
                <span data-part="guard-last-checked">
                  Last checked: {formatLastChecked(guard.lastChecked)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {children}
    </div>
  );
}

export { GuardStatusPanel };
