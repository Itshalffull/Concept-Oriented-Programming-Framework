/* ---------------------------------------------------------------------------
 * ExecutionPipeline state machine
 * States: idle (initial), stageSelected, failed
 * See widget spec: execution-pipeline.widget
 * ------------------------------------------------------------------------- */

export type ExecutionPipelineState = 'idle' | 'stageSelected' | 'failed';
export type ExecutionPipelineEvent =
  | { type: 'ADVANCE' }
  | { type: 'SELECT_STAGE'; stageId?: string }
  | { type: 'FAIL' }
  | { type: 'DESELECT' }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export function executionPipelineReducer(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'ADVANCE') return 'idle';
      if (event.type === 'SELECT_STAGE') return 'stageSelected';
      if (event.type === 'FAIL') return 'failed';
      return state;
    case 'stageSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'idle';
      if (event.type === 'RESET') return 'idle';
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
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/** Status of an individual pipeline stage. */
export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

/** A single stage in the execution pipeline. */
export interface PipelineStage {
  /** Unique identifier for this stage. */
  id: string;
  /** Human-readable stage name (e.g. "Timelock Queued"). */
  name: string;
  /** Current status of the stage. */
  status: PipelineStageStatus;
  /** Description or detail text (timing info, error message, etc.). */
  description?: string;
  /** Whether this is a timelock stage (shows countdown timer slot). */
  isTimelock?: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** SVG checkmark icon for completed stages. */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8.5L6.5 12L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SVG X icon for failed stages. */
function FailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SVG dot icon for pending / active stages. */
function DotIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

/** SVG skip icon for skipped stages. */
function SkipIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4L12 8L4 12V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Choose the icon component for a given stage status. */
function iconForStatus(status: PipelineStageStatus) {
  switch (status) {
    case 'complete':
      return <CheckIcon />;
    case 'failed':
      return <FailIcon />;
    case 'skipped':
      return <SkipIcon />;
    default:
      return <DotIcon />;
  }
}

/** Derive the connector status between two adjacent stages. */
function connectorStatus(left: PipelineStageStatus, right: PipelineStageStatus): string {
  if (left === 'complete' && (right === 'complete' || right === 'active')) return 'complete';
  if (left === 'complete' && right === 'pending') return 'upcoming';
  if (left === 'failed' || right === 'failed') return 'failed';
  return 'pending';
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ExecutionPipelineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Ordered array of pipeline stages. */
  stages: PipelineStage[];
  /** ID of the currently active stage. */
  currentStage: string;
  /** Overall pipeline status (e.g. "in-progress", "complete", "failed"). */
  status: string;
  /** Whether to show the timelock timer compose slot. */
  showTimer?: boolean;
  /** Whether to show the action bar (cancel / force-execute buttons). */
  showActions?: boolean;
  /** Use a compact layout. */
  compact?: boolean;
  /** Callback when a stage is selected. */
  onStageSelect?: (stageId: string) => void;
  /** Callback when retry is triggered from failed state. */
  onRetry?: () => void;
  /** Callback when cancel is triggered from the action bar. */
  onCancel?: () => void;
  /** Callback when force-execute is triggered from the action bar. */
  onForceExecute?: () => void;
  /** Slot content for the timelock timer compose area. */
  timerSlot?: ReactNode;
  /** Slot content for custom action buttons. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ExecutionPipeline = forwardRef<HTMLDivElement, ExecutionPipelineProps>(function ExecutionPipeline(
  {
    stages,
    currentStage,
    status,
    showTimer = true,
    showActions = true,
    compact = false,
    onStageSelect,
    onRetry,
    onCancel,
    onForceExecute,
    timerSlot,
    children,
    ...rest
  },
  ref,
) {
  const [widgetState, send] = useReducer(executionPipelineReducer, 'idle');

  /** Track which stage is currently selected (by index). */
  const selectedIndexRef = useRef<number>(-1);
  /** Refs for each stage element (roving tabindex). */
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** The index of the currently active stage. */
  const activeIndex = useMemo(
    () => stages.findIndex((s) => s.id === currentStage),
    [stages, currentStage],
  );

  /** Focused / selected stage index for the detail panel. */
  const selectedStageIndex = useMemo(() => {
    if (widgetState === 'stageSelected' && selectedIndexRef.current >= 0) {
      return selectedIndexRef.current;
    }
    return -1;
  }, [widgetState]);

  /** The selected stage object, if any. */
  const selectedStage = selectedStageIndex >= 0 ? stages[selectedStageIndex] : null;

  /** Whether any stage is a timelock stage and currently active. */
  const hasActiveTimelock = useMemo(
    () => stages.some((s) => s.isTimelock && s.status === 'active'),
    [stages],
  );

  /** Whether the pipeline is in a failed overall state. */
  const isFailed = status === 'failed' || widgetState === 'failed';

  /* ---- Stage selection ---- */

  const selectStage = useCallback(
    (index: number) => {
      if (index < 0 || index >= stages.length) return;
      selectedIndexRef.current = index;
      send({ type: 'SELECT_STAGE', stageId: stages[index].id });
      onStageSelect?.(stages[index].id);
    },
    [stages, onStageSelect],
  );

  const deselectStage = useCallback(() => {
    selectedIndexRef.current = -1;
    send({ type: 'DESELECT' });
  }, []);

  /* ---- Roving focus helpers ---- */

  const focusStage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, stages.length - 1));
      stageRefs.current[clamped]?.focus();
    },
    [stages.length],
  );

  /* ---- Keyboard handler (roving tabindex on stages) ---- */

  const handleStageKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, index: number) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault();
          const next = index < stages.length - 1 ? index + 1 : 0;
          focusStage(next);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = index > 0 ? index - 1 : stages.length - 1;
          focusStage(prev);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          selectStage(index);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          deselectStage();
          break;
        }
        default:
          break;
      }
    },
    [stages.length, focusStage, selectStage, deselectStage],
  );

  /* ---- Render ---- */

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Execution pipeline: ${status}`}
      data-surface-widget=""
      data-widget-name="execution-pipeline"
      data-part="root"
      data-state={widgetState}
      data-status={status}
      data-compact={compact ? 'true' : 'false'}
      {...rest}
    >
      {/* Pipeline: horizontal sequence of stage nodes */}
      <div data-part="pipeline" role="list" data-state={widgetState}>
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStage;
          const isSelected = selectedStageIndex === index;

          return (
            <div key={stage.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {/* Stage node */}
              <div
                ref={(el) => {
                  stageRefs.current[index] = el;
                }}
                data-part="stage"
                data-status={stage.status}
                data-current={isCurrent ? 'true' : 'false'}
                data-selected={isSelected ? 'true' : 'false'}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${stage.name} \u2014 ${stage.status}`}
                tabIndex={index === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1}
                onClick={() => selectStage(index)}
                onKeyDown={(e) => handleStageKeyDown(e, index)}
              >
                {/* Stage icon */}
                <div
                  data-part="stage-icon"
                  data-status={stage.status}
                  aria-hidden="true"
                  data-animate={stage.status === 'active' ? 'pulse' : undefined}
                >
                  {iconForStatus(stage.status)}
                </div>

                {/* Stage label */}
                <span data-part="stage-label">
                  {stage.name}
                </span>

                {/* Stage detail (compact hides this inline, shown in detail panel instead) */}
                {!compact && stage.description && (
                  <span data-part="stage-detail">
                    {stage.description}
                  </span>
                )}
              </div>

              {/* Connector arrow between stages (skip after last) */}
              {index < stages.length - 1 && (
                <div
                  data-part="connector"
                  data-status={connectorStatus(stage.status, stages[index + 1].status)}
                  aria-hidden="true"
                >
                  <svg
                    width="24"
                    height="16"
                    viewBox="0 0 24 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 8H20M20 8L14 3M20 8L14 13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage detail panel (visible when a stage is selected) */}
      {widgetState === 'stageSelected' && selectedStage && (
        <div
          data-part="stage-detail-panel"
          role="region"
          aria-label={`Details for ${selectedStage.name}`}
          aria-live="polite"
        >
          <strong>{selectedStage.name}</strong>
          {selectedStage.description && (
            <span data-part="stage-detail">{selectedStage.description}</span>
          )}
          <span data-part="stage-status-badge" data-status={selectedStage.status}>
            {selectedStage.status}
          </span>
        </div>
      )}

      {/* Timelock timer compose slot (visible during active timelock stage) */}
      {showTimer && hasActiveTimelock && (
        <div
          data-part="timelock-timer"
          data-visible="true"
        >
          {timerSlot ?? (
            <span aria-live="polite" role="timer">
              Timelock countdown active
            </span>
          )}
        </div>
      )}

      {/* Failure banner (visible when pipeline has failed) */}
      {isFailed && (
        <div
          data-part="failure-banner"
          role="alert"
          aria-live="assertive"
        >
          <span>Pipeline execution failed</span>
          {onRetry && (
            <button
              type="button"
              data-part="retry-button"
              onClick={() => {
                send({ type: 'RETRY' });
                onRetry();
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Action bar: cancel or force-execute buttons */}
      {showActions && (
        <div
          data-part="actions"
          data-visible="true"
          role="toolbar"
          aria-label="Pipeline actions"
        >
          {children ?? (
            <>
              {onCancel && (
                <button
                  type="button"
                  data-part="cancel-button"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              )}
              {onForceExecute && (
                <button
                  type="button"
                  data-part="force-execute-button"
                  onClick={onForceExecute}
                >
                  Force Execute
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

ExecutionPipeline.displayName = 'ExecutionPipeline';
export { ExecutionPipeline };
export default ExecutionPipeline;
