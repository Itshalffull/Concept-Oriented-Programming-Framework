'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cronReducer } from './CronEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CronEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current cron expression. */
  cronExpression?: string;
  /** Base frequency for simple mode. */
  frequency?: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  /** Hour for simple mode. */
  hour?: number;
  /** Minute for simple mode. */
  minute?: number;
  /** Selected days of week (0=Sun). */
  dayOfWeek?: number[];
  /** Day of month. */
  dayOfMonth?: number;
  /** Accessible label. */
  ariaLabel?: string;
  /** Timezone. */
  timezone?: string;
  /** Number of next runs to preview. */
  nextRunCount?: number;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Editor mode. */
  mode?: 'simple' | 'advanced';
  /** Next run dates (pre-computed). */
  nextRuns?: string[];
  /** Human-readable schedule description. */
  humanReadable?: string;
  /** Called on cron expression change. */
  onCronChange?: (expression: string) => void;
  /** Called on frequency change. */
  onFrequencyChange?: (frequency: string) => void;
  /** Called on mode change. */
  onModeChange?: (mode: 'simple' | 'advanced') => void;
  /** Frequency select slot. */
  frequencySelect?: ReactNode;
  /** Time input slot. */
  timeInput?: ReactNode;
  /** Day select slot. */
  daySelect?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CronEditor = forwardRef<HTMLDivElement, CronEditorProps>(function CronEditor(
  {
    cronExpression = '0 * * * *',
    frequency = 'hourly',
    hour = 0,
    minute = 0,
    dayOfWeek = [],
    dayOfMonth = 1,
    ariaLabel = 'Cron Editor',
    timezone = 'UTC',
    nextRunCount = 5,
    readOnly = false,
    mode: controlledMode = 'simple',
    nextRuns = [],
    humanReadable,
    onCronChange,
    onFrequencyChange,
    onModeChange,
    frequencySelect,
    timeInput,
    daySelect,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(cronReducer, {
    mode: controlledMode,
    validation: 'valid',
  });

  const isSimple = controlledMode === 'simple';
  const isValid = state.validation === 'valid';

  const handleModeChange = useCallback(
    (newMode: 'simple' | 'advanced') => {
      send({ type: newMode === 'advanced' ? 'SWITCH_ADVANCED' : 'SWITCH_SIMPLE' });
      onModeChange?.(newMode);
    },
    [onModeChange],
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-roledescription="cron editor"
      data-surface-widget=""
      data-widget-name="cron-editor"
      data-state={state.mode}
      data-mode={controlledMode}
      data-valid={isValid ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      {...rest}
    >
      <div data-part="tabs" data-active={controlledMode} role="tablist" aria-label="Editor mode">
        <button
          type="button"
          role="tab"
          aria-selected={isSimple}
          onClick={() => handleModeChange('simple')}
        >
          Simple
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSimple}
          onClick={() => handleModeChange('advanced')}
        >
          Advanced
        </button>
      </div>

      {isSimple && (
        <div
          data-part="simple-editor"
          role="form"
          aria-label="Simple schedule editor"
          data-visible="true"
        >
          <div data-part="frequency-select" aria-label="Frequency" data-value={frequency}>
            {frequencySelect ?? (
              <select
                value={frequency}
                aria-label="Frequency"
                disabled={readOnly}
                onChange={(e) => onFrequencyChange?.(e.target.value)}
              >
                <option value="minutely">Every minute</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          {frequency !== 'minutely' && (
            <div data-part="time-input" aria-label="Time of day" data-hour={hour} data-minute={minute} data-visible="true">
              {timeInput ?? (
                <input type="time" value={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`} aria-label="Time of day" disabled={readOnly} readOnly />
              )}
            </div>
          )}

          {(frequency === 'weekly' || frequency === 'monthly') && (
            <div
              data-part="day-select"
              aria-label={frequency === 'weekly' ? 'Day of week' : 'Day of month'}
              data-visible="true"
              data-frequency={frequency}
            >
              {daySelect}
            </div>
          )}
        </div>
      )}

      {!isSimple && (
        <div
          data-part="advanced-editor"
          role="form"
          aria-label="Advanced cron expression editor"
          data-visible="true"
        >
          <input
            type="text"
            data-part="cron-input"
            role="textbox"
            aria-label="Cron expression"
            aria-invalid={!isValid || undefined}
            aria-describedby="cron-hint"
            value={cronExpression}
            placeholder="* * * * *"
            data-valid={isValid ? 'true' : 'false'}
            disabled={readOnly}
            onChange={(e) => onCronChange?.(e.target.value)}
          />
        </div>
      )}

      {isValid && (
        <>
          <div data-part="preview" role="region" aria-label="Schedule preview" aria-live="polite" data-visible="true" data-timezone={timezone}>
            {humanReadable ?? cronExpression}
          </div>
          {nextRuns.length > 0 && (
            <div data-part="next-runs" role="list" aria-label="Next scheduled runs" data-count={nextRunCount} data-timezone={timezone} data-visible="true">
              {nextRuns.map((run, i) => (
                <div key={i} role="listitem">{run}</div>
              ))}
            </div>
          )}
        </>
      )}

      {children}
    </div>
  );
});

CronEditor.displayName = 'CronEditor';
export { CronEditor };
export default CronEditor;
