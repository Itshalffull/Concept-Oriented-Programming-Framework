/* ---------------------------------------------------------------------------
 * GuardStatusPanel state machine
 * States: idle (initial), guardSelected
 * ------------------------------------------------------------------------- */

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD'; id?: string }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
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
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';

export interface Guard {
  /** Unique identifier for the guard. */
  id?: string;
  /** Display name. */
  name: string;
  /** Description of the guard condition. */
  description: string;
  /** Current evaluation status. */
  status: GuardStatus;
  /** ISO-8601 timestamp of the last evaluation, if available. */
  lastChecked?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<GuardStatus, string> = {
  passing: '\u2713',   // checkmark
  failing: '\u2717',   // ballot x
  pending: '\u23F3',   // hourglass
  bypassed: '\u2298',  // circled division slash
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
  const hasAnyFailing = guards.some((g) => g.status === 'failing');
  if (hasAnyFailing) return 'has-failing';
  const hasAnyPending = guards.some((g) => g.status === 'pending');
  if (hasAnyPending) return 'has-pending';
  return 'all-passing';
}

function formatLastChecked(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - date.getTime();
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
  /** Array of guard conditions to display. */
  guards: Guard[];
  /** Current execution status label. */
  executionStatus: string;
  /** Whether to show the condition description for each guard. */
  showConditions?: boolean;
  /** Callback when a guard is selected. */
  onGuardSelect?: (guard: Guard) => void;
  /** Slot content (e.g., additional actions). */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const GuardStatusPanel = forwardRef<HTMLDivElement, GuardStatusPanelProps>(function GuardStatusPanel(
  {
    guards,
    executionStatus,
    showConditions = true,
    onGuardSelect,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(guardStatusPanelReducer, 'idle');
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number>(0);
  const guardRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* Derived values */
  const overallStatus = useMemo(() => deriveOverallStatus(guards), [guards]);
  const passingCount = useMemo(() => guards.filter((g) => g.status === 'passing').length, [guards]);
  const hasBlockingGuards = useMemo(() => guards.some((g) => g.status === 'failing'), [guards]);

  /* Focus management for roving tabindex */
  const focusGuard = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, guards.length - 1));
    setFocusIndex(clamped);
    guardRefs.current[clamped]?.focus();
  }, [guards.length]);

  /* Guard selection toggle */
  const toggleGuard = useCallback((guard: Guard, index: number) => {
    const guardId = guard.id ?? guard.name;
    if (state === 'guardSelected' && selectedGuardId === guardId) {
      setSelectedGuardId(null);
      send({ type: 'DESELECT' });
    } else {
      setSelectedGuardId(guardId);
      setFocusIndex(index);
      send({ type: 'SELECT_GUARD', id: guardId });
      onGuardSelect?.(guard);
    }
  }, [state, selectedGuardId, onGuardSelect]);

  /* Root-level keyboard handler */
  const handleRootKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (guards.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(focusIndex + 1, guards.length - 1);
        focusGuard(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = Math.max(focusIndex - 1, 0);
        focusGuard(prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (guards[focusIndex]) {
          toggleGuard(guards[focusIndex], focusIndex);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (state === 'guardSelected') {
          setSelectedGuardId(null);
          send({ type: 'DESELECT' });
        }
        break;
      }
    }
  }, [focusIndex, guards, focusGuard, toggleGuard, state]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Pre-execution guards"
      data-surface-widget=""
      data-widget-name="guard-status-panel"
      data-part="root"
      data-state={state}
      data-overall-status={overallStatus}
      data-execution-status={executionStatus}
      tabIndex={-1}
      onKeyDown={handleRootKeyDown}
      {...rest}
    >
      {/* Header with summary */}
      <div data-part="header" data-state={state} data-overall-status={overallStatus}>
        <h3 data-part="heading">Pre-execution Guards</h3>
        <span data-part="summary" aria-live="polite">
          {passingCount} of {guards.length} guards passing
        </span>
      </div>

      {/* Blocking banner (alert role, visible when any guard is failing) */}
      {hasBlockingGuards && (
        <div
          data-part="blocking-banner"
          data-visible="true"
          role="alert"
        >
          Execution is blocked by failing guards
        </div>
      )}

      {/* Guard list */}
      <div data-part="guard-list" role="list">
        {guards.map((guard, index) => {
          const guardId = guard.id ?? guard.name;
          const isSelected = state === 'guardSelected' && selectedGuardId === guardId;
          const isFocused = focusIndex === index;

          return (
            <div
              key={guardId}
              ref={(el) => { guardRefs.current[index] = el; }}
              data-part="guard-item"
              data-status={guard.status}
              data-selected={isSelected ? 'true' : 'false'}
              role="listitem"
              aria-label={`${guard.name} \u2014 ${STATUS_LABELS[guard.status]}`}
              aria-expanded={isSelected}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => toggleGuard(guard, index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleGuard(guard, index);
                }
              }}
            >
              {/* Status icon */}
              <span
                data-part="guard-icon"
                data-status={guard.status}
                aria-hidden="true"
              >
                {STATUS_ICONS[guard.status]}
              </span>

              {/* Guard name */}
              <span data-part="guard-name">
                {guard.name}
              </span>

              {/* Guard condition description */}
              {showConditions && (
                <span
                  data-part="guard-condition"
                  data-visible="true"
                >
                  {guard.description}
                </span>
              )}

              {/* Status badge */}
              <span
                data-part="guard-status"
                data-status={guard.status}
              >
                {STATUS_LABELS[guard.status]}
              </span>

              {/* Expandable detail panel */}
              {isSelected && (
                <div data-part="guard-detail" data-status={guard.status}>
                  <p data-part="guard-detail-description">{guard.description}</p>
                  {guard.lastChecked && (
                    <span data-part="guard-last-checked">
                      Last checked: {formatLastChecked(guard.lastChecked)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot for additional content */}
      {children}
    </div>
  );
});

GuardStatusPanel.displayName = 'GuardStatusPanel';
export { GuardStatusPanel };
export default GuardStatusPanel;
