export type TraceTimelineViewerState = 'idle' | 'playing' | 'cellSelected';
export type TraceTimelineViewerEvent =
  | { type: 'PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'SELECT_CELL' }
  | { type: 'ZOOM' }
  | { type: 'PAUSE' }
  | { type: 'STEP_END' }
  | { type: 'DESELECT' };

export function traceTimelineViewerReducer(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState {
  switch (state) {
    case 'idle':
      if (event.type === 'PLAY') return 'playing';
      if (event.type === 'STEP_FORWARD') return 'idle';
      if (event.type === 'STEP_BACKWARD') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      if (event.type === 'ZOOM') return 'idle';
      return state;
    case 'playing':
      if (event.type === 'PAUSE') return 'idle';
      if (event.type === 'STEP_END') return 'idle';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useState,
  useEffect,
  useRef,
  useCallback,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/** A single trace step from a verification run. */
export interface TraceStep {
  index: number;
  label: string;
  state: Record<string, string>;
  isError?: boolean;
  timestamp?: string;
}

export interface TraceTimelineViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Ordered list of trace steps to display. */
  steps: TraceStep[];
  /** Variable names to show as lanes (rows) in the grid. Defaults to all keys found in steps. */
  variables?: string[];
  /** Externally-controlled current step index. */
  currentStep?: number;
  /** Seconds between auto-advance ticks during playback. */
  playbackSpeed?: number;
  /** When true, only cells whose value changed from the previous step are shown. */
  showChangesOnly?: boolean;
  /** Zoom factor (1.0 = 100%). */
  zoom?: number;
  /** Called when the active step changes (user navigation or playback). */
  onStepChange?: (stepIndex: number) => void;
  children?: ReactNode;
}

const TraceTimelineViewer = forwardRef<HTMLDivElement, TraceTimelineViewerProps>(function TraceTimelineViewer(
  {
    steps,
    variables: variablesProp,
    currentStep: controlledStep,
    playbackSpeed = 1.0,
    showChangesOnly = false,
    zoom = 1.0,
    onStepChange,
    children,
    ...rest
  },
  ref,
) {
  const [widgetState, send] = useReducer(traceTimelineViewerReducer, 'idle');

  // --- Derive variable names --------------------------------------------------
  const variables: string[] = variablesProp ?? (() => {
    const keys = new Set<string>();
    for (const step of steps) {
      for (const k of Object.keys(step.state)) keys.add(k);
    }
    return Array.from(keys);
  })();

  // --- Active step (internal + optional controlled) ---------------------------
  const [internalStep, setInternalStep] = useState(0);
  const activeStep = controlledStep ?? internalStep;

  const goToStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, steps.length - 1));
      setInternalStep(clamped);
      onStepChange?.(clamped);
    },
    [steps.length, onStepChange],
  );

  // Sync with controlled prop
  useEffect(() => {
    if (controlledStep !== undefined) setInternalStep(controlledStep);
  }, [controlledStep]);

  // --- Selected cell (for cellSelected state) ---------------------------------
  const [selectedCell, setSelectedCell] = useState<{ step: number; variable: string } | null>(null);

  // --- Playback timer ---------------------------------------------------------
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (widgetState === 'playing') {
      const intervalMs = Math.max(100, (1 / playbackSpeed) * 1000);
      playbackRef.current = setInterval(() => {
        setInternalStep((prev) => {
          const next = prev + 1;
          if (next >= steps.length) {
            send({ type: 'STEP_END' });
            return prev;
          }
          onStepChange?.(next);
          return next;
        });
      }, intervalMs);
    }
    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, [widgetState, playbackSpeed, steps.length, onStepChange]);

  // --- Focused lane for keyboard navigation -----------------------------------
  const [focusedLane, setFocusedLane] = useState(0);

  // --- Helpers ----------------------------------------------------------------
  const didValueChange = (stepIdx: number, variable: string): boolean => {
    if (stepIdx === 0) return false;
    const prev = steps[stepIdx - 1]?.state[variable];
    const curr = steps[stepIdx]?.state[variable];
    return prev !== curr;
  };

  const currentStepData = steps[activeStep] as TraceStep | undefined;

  // --- Keyboard handler -------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          send({ type: 'STEP_FORWARD' });
          goToStep(activeStep + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          send({ type: 'STEP_BACKWARD' });
          goToStep(activeStep - 1);
          break;
        case ' ':
          e.preventDefault();
          if (widgetState === 'playing') {
            send({ type: 'PAUSE' });
          } else {
            send({ type: 'PLAY' });
          }
          break;
        case 'Home':
          e.preventDefault();
          goToStep(0);
          break;
        case 'End':
          e.preventDefault();
          goToStep(steps.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedLane((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedLane((prev) => Math.min(variables.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (variables[focusedLane] !== undefined) {
            setSelectedCell({ step: activeStep, variable: variables[focusedLane] });
            send({ type: 'SELECT_CELL' });
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedCell(null);
          send({ type: 'DESELECT' });
          break;
        default:
          break;
      }
    },
    [widgetState, activeStep, focusedLane, variables, steps.length, goToStep],
  );

  // --- Render -----------------------------------------------------------------
  return (
    <div
      ref={ref}
      role="grid"
      aria-label="Trace timeline"
      aria-rowcount={variables.length}
      data-surface-widget=""
      data-widget-name="trace-timeline-viewer"
      data-part="root"
      data-state={widgetState}
      data-zoom={zoom}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Time axis: horizontal row of step numbers */}
      <div data-part="time-axis" data-state={widgetState} data-step-count={steps.length} role="row">
        {/* Empty corner cell for the lane-label column */}
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
      <div data-part="lanes" data-state={widgetState}>
        {variables.map((variable, laneIdx) => (
          <div
            key={variable}
            data-part="lane"
            data-state={widgetState}
            data-variable={variable}
            data-focused={laneIdx === focusedLane ? 'true' : undefined}
            role="row"
            aria-label={variable}
          >
            <span data-part="lane-label" data-state={widgetState}>
              {variable}
            </span>

            {steps.map((step) => {
              const value = step.state[variable] ?? '';
              const changed = didValueChange(step.index, variable);
              if (showChangesOnly && !changed && step.index !== 0) return null;

              const isCurrent = step.index === activeStep;
              const isSelected =
                selectedCell?.step === step.index && selectedCell?.variable === variable;

              return (
                <div
                  key={step.index}
                  data-part="cell"
                  data-state={widgetState}
                  data-step={step.index}
                  data-changed={changed ? 'true' : 'false'}
                  data-error={step.isError ? 'true' : undefined}
                  data-selected={isSelected ? 'true' : undefined}
                  role="gridcell"
                  aria-label={`${variable} at step ${step.index}: ${value}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    ...(step.isError ? { backgroundColor: 'var(--trace-error-bg, #fee2e2)', color: 'var(--trace-error-color, red)' } : {}),
                    ...(changed ? { fontWeight: 'bold' } : {}),
                    ...(isSelected ? { outline: '2px solid var(--trace-selected-outline, currentColor)' } : {}),
                  }}
                  onClick={() => {
                    setSelectedCell({ step: step.index, variable });
                    goToStep(step.index);
                    send({ type: 'SELECT_CELL' });
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
      <div data-part="step-cursor" data-state={widgetState} data-position={activeStep} aria-hidden="true" />

      {/* Playback controls */}
      <div data-part="controls" data-state={widgetState} role="toolbar" aria-label="Playback controls">
        <button
          type="button"
          data-part="step-back-btn"
          aria-label="Step backward"
          disabled={activeStep <= 0}
          onClick={() => {
            send({ type: 'STEP_BACKWARD' });
            goToStep(activeStep - 1);
          }}
          tabIndex={0}
        >
          &laquo;
        </button>
        <button
          type="button"
          data-part="play-pause-btn"
          aria-label={widgetState === 'playing' ? 'Pause' : 'Play'}
          onClick={() => {
            if (widgetState === 'playing') {
              send({ type: 'PAUSE' });
            } else {
              send({ type: 'PLAY' });
            }
          }}
          tabIndex={0}
        >
          {widgetState === 'playing' ? '\u23F8' : '\u25B6'}
        </button>
        <button
          type="button"
          data-part="step-fwd-btn"
          aria-label="Step forward"
          disabled={activeStep >= steps.length - 1}
          onClick={() => {
            send({ type: 'STEP_FORWARD' });
            goToStep(activeStep + 1);
          }}
          tabIndex={0}
        >
          &raquo;
        </button>
        <span data-part="step-counter" aria-live="polite">
          {steps.length > 0 ? `${activeStep + 1} / ${steps.length}` : '0 / 0'}
        </span>
      </div>

      {/* Zoom controls */}
      <div data-part="zoom-control" data-state={widgetState}>
        <button
          type="button"
          data-part="zoom-in-btn"
          aria-label="Zoom in"
          onClick={() => send({ type: 'ZOOM' })}
          tabIndex={0}
        >
          +
        </button>
        <button
          type="button"
          data-part="zoom-out-btn"
          aria-label="Zoom out"
          onClick={() => send({ type: 'ZOOM' })}
          tabIndex={0}
        >
          -
        </button>
      </div>

      {/* Detail panel: shown when a cell is selected */}
      {widgetState === 'cellSelected' && currentStepData && (
        <div
          data-part="detail-panel"
          data-state={widgetState}
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
                <dd
                  style={
                    didValueChange(activeStep, key) ? { fontWeight: 'bold' } : undefined
                  }
                >
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
});

TraceTimelineViewer.displayName = 'TraceTimelineViewer';
export { TraceTimelineViewer };
export default TraceTimelineViewer;
