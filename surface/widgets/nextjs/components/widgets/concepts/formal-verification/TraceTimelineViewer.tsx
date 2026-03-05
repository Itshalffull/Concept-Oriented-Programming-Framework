import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TraceTimelineViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  steps: TraceStep[];
  variables?: string[];
  currentStep?: number;
  showChangesOnly?: boolean;
  zoom?: number;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function TraceTimelineViewer({
  steps,
  variables: variablesProp,
  currentStep = 0,
  showChangesOnly = false,
  zoom = 1.0,
  children,
  ...rest
}: TraceTimelineViewerProps) {
  // Derive variable names
  const variables: string[] = variablesProp ?? (() => {
    const keys = new Set<string>();
    for (const step of steps) {
      for (const k of Object.keys(step.state)) keys.add(k);
    }
    return Array.from(keys);
  })();

  const activeStep = Math.max(0, Math.min(currentStep, steps.length - 1));

  const didValueChange = (stepIdx: number, variable: string): boolean => {
    if (stepIdx === 0) return false;
    const prev = steps[stepIdx - 1]?.state[variable];
    const curr = steps[stepIdx]?.state[variable];
    return prev !== curr;
  };

  const currentStepData = steps[activeStep] as TraceStep | undefined;

  return (
    <div
      role="grid"
      aria-label="Trace timeline"
      aria-rowcount={variables.length}
      data-surface-widget=""
      data-widget-name="trace-timeline-viewer"
      data-part="root"
      data-state="idle"
      data-zoom={zoom}
      tabIndex={0}
      {...rest}
    >
      {/* Time axis */}
      <div data-part="time-axis" data-state="idle" data-step-count={steps.length} role="row">
        <span data-part="time-axis-corner" role="columnheader" />
        {steps.map((step) => (
          <span
            key={step.index}
            data-part="time-axis-label"
            data-step={step.index}
            data-error={step.isError ? 'true' : undefined}
            role="columnheader"
            aria-label={`Step ${step.index}${step.isError ? ' (error)' : ''}`}
            style={step.isError ? { color: 'var(--trace-error-color, red)' } : undefined}
          >
            {step.index}
          </span>
        ))}
      </div>

      {/* Variable lanes */}
      <div data-part="lanes" data-state="idle">
        {variables.map((variable) => (
          <div
            key={variable}
            data-part="lane"
            data-state="idle"
            data-variable={variable}
            role="row"
            aria-label={variable}
          >
            <span data-part="lane-label" data-state="idle">
              {variable}
            </span>

            {steps.map((step) => {
              const value = step.state[variable] ?? '';
              const changed = didValueChange(step.index, variable);
              if (showChangesOnly && !changed && step.index !== 0) return null;

              const isCurrent = step.index === activeStep;

              return (
                <div
                  key={step.index}
                  data-part="cell"
                  data-state="idle"
                  data-step={step.index}
                  data-changed={changed ? 'true' : 'false'}
                  data-error={step.isError ? 'true' : undefined}
                  role="gridcell"
                  aria-label={`${variable} at step ${step.index}: ${value}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    ...(step.isError ? { backgroundColor: 'var(--trace-error-bg, #fee2e2)', color: 'var(--trace-error-color, red)' } : {}),
                    ...(changed ? { fontWeight: 'bold' } : {}),
                  }}
                  tabIndex={-1}
                >
                  {value}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Step cursor */}
      <div data-part="step-cursor" data-state="idle" data-position={activeStep} aria-hidden="true" />

      {/* Playback controls (static — interactivity requires client wrapper) */}
      <div data-part="controls" data-state="idle" role="toolbar" aria-label="Playback controls">
        <button type="button" data-part="step-back-btn" aria-label="Step backward" disabled={activeStep <= 0} tabIndex={0}>
          &laquo;
        </button>
        <button type="button" data-part="play-pause-btn" aria-label="Play" tabIndex={0}>
          {'\u25B6'}
        </button>
        <button type="button" data-part="step-fwd-btn" aria-label="Step forward" disabled={activeStep >= steps.length - 1} tabIndex={0}>
          &raquo;
        </button>
        <span data-part="step-counter" aria-live="polite">
          {steps.length > 0 ? `${activeStep + 1} / ${steps.length}` : '0 / 0'}
        </span>
      </div>

      {/* Zoom controls */}
      <div data-part="zoom-control" data-state="idle">
        <button type="button" data-part="zoom-in-btn" aria-label="Zoom in" tabIndex={0}>+</button>
        <button type="button" data-part="zoom-out-btn" aria-label="Zoom out" tabIndex={0}>-</button>
      </div>

      {/* Detail panel for current step */}
      {currentStepData && (
        <div
          data-part="detail-panel"
          data-state="idle"
          data-step={activeStep}
          role="region"
          aria-label={`State detail for step ${activeStep}`}
          aria-live="polite"
        >
          <h3 data-part="detail-title">
            Step {currentStepData.index}: {currentStepData.label}
            {currentStepData.isError && (
              <span data-part="detail-error-badge" style={{ color: 'var(--trace-error-color, red)' }}> (error)</span>
            )}
          </h3>
          {currentStepData.timestamp && (
            <time data-part="detail-timestamp" dateTime={currentStepData.timestamp}>
              {currentStepData.timestamp}
            </time>
          )}
          <dl data-part="detail-state">
            {Object.entries(currentStepData.state).map(([key, value]) => (
              <div key={key} data-part="detail-entry" data-changed={didValueChange(activeStep, key) ? 'true' : 'false'}>
                <dt>{key}</dt>
                <dd style={didValueChange(activeStep, key) ? { fontWeight: 'bold' } : undefined}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {children}
    </div>
  );
}

export { TraceTimelineViewer };
