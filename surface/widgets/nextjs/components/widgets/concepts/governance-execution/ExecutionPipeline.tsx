import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type PipelineStageStatus = 'pending' | 'active' | 'complete' | 'failed' | 'skipped';

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStageStatus;
  description?: string;
  isTimelock?: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 8L4 12V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function iconForStatus(status: PipelineStageStatus) {
  switch (status) {
    case 'complete': return <CheckIcon />;
    case 'failed': return <FailIcon />;
    case 'skipped': return <SkipIcon />;
    default: return <DotIcon />;
  }
}

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
  stages: PipelineStage[];
  currentStage: string;
  status: string;
  showTimer?: boolean;
  showActions?: boolean;
  compact?: boolean;
  timerSlot?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function ExecutionPipeline({
  stages,
  currentStage,
  status,
  showTimer = true,
  showActions = true,
  compact = false,
  timerSlot,
  children,
  ...rest
}: ExecutionPipelineProps) {
  const hasActiveTimelock = stages.some((s) => s.isTimelock && s.status === 'active');
  const isFailed = status === 'failed';

  return (
    <div
      role="group"
      aria-label={`Execution pipeline: ${status}`}
      data-surface-widget=""
      data-widget-name="execution-pipeline"
      data-part="root"
      data-state="idle"
      data-status={status}
      data-compact={compact ? 'true' : 'false'}
      {...rest}
    >
      {/* Pipeline: horizontal sequence of stage nodes */}
      <div data-part="pipeline" role="list" data-state="idle">
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStage;

          return (
            <div key={stage.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {/* Stage node */}
              <div
                data-part="stage"
                data-status={stage.status}
                data-current={isCurrent ? 'true' : 'false'}
                data-selected="false"
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${stage.name} \u2014 ${stage.status}`}
                tabIndex={isCurrent ? 0 : -1}
              >
                <div
                  data-part="stage-icon"
                  data-status={stage.status}
                  aria-hidden="true"
                  data-animate={stage.status === 'active' ? 'pulse' : undefined}
                >
                  {iconForStatus(stage.status)}
                </div>

                <span data-part="stage-label">
                  {stage.name}
                </span>

                {!compact && stage.description && (
                  <span data-part="stage-detail">
                    {stage.description}
                  </span>
                )}
              </div>

              {/* Connector arrow */}
              {index < stages.length - 1 && (
                <div
                  data-part="connector"
                  data-status={connectorStatus(stage.status, stages[index + 1].status)}
                  aria-hidden="true"
                >
                  <svg width="24" height="16" viewBox="0 0 24 16" fill="none" aria-hidden="true">
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

      {/* Timelock timer compose slot */}
      {showTimer && hasActiveTimelock && (
        <div data-part="timelock-timer" data-visible="true">
          {timerSlot ?? (
            <span aria-live="polite" role="timer">
              Timelock countdown active
            </span>
          )}
        </div>
      )}

      {/* Failure banner */}
      {isFailed && (
        <div data-part="failure-banner" role="alert" aria-live="assertive">
          <span>Pipeline execution failed</span>
        </div>
      )}

      {/* Action bar */}
      {showActions && (
        <div
          data-part="actions"
          data-visible="true"
          role="toolbar"
          aria-label="Pipeline actions"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export { ExecutionPipeline };
