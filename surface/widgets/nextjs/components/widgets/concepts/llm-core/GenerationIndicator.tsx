/* ---------------------------------------------------------------------------
 * GenerationIndicator — Server Component
 *
 * Status indicator for LLM generation in progress. Displays an animated
 * spinner variant (dots/spinner/bar), elapsed time, token counter, model
 * badge, and retry button for error state.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';

export interface GenerationIndicatorProps {
  /** Current generation status driven by the parent. */
  status: GenerationIndicatorState;
  /** Name of the active model. */
  model?: string | undefined;
  /** Running count of tokens generated so far. */
  tokenCount?: number | undefined;
  /** Whether to show the token counter (default: true). */
  showTokens?: boolean;
  /** Whether to show the model badge (default: true). */
  showModel?: boolean;
  /** Whether to show elapsed time (default: true). */
  showElapsed?: boolean;
  /** Animation variant for the spinner area. */
  variant?: 'dots' | 'spinner' | 'bar';
  /** Elapsed seconds to display (server-computed). */
  elapsedSeconds?: number;
  children?: React.ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function statusText(status: GenerationIndicatorState): string {
  switch (status) {
    case 'generating': return 'Generating...';
    case 'complete': return 'Complete';
    case 'error': return 'Error';
    default: return '';
  }
}

/* ---------------------------------------------------------------------------
 * Spinner content
 * ------------------------------------------------------------------------- */

function SpinnerContent({ variant }: { variant: 'dots' | 'spinner' | 'bar' }) {
  switch (variant) {
    case 'dots':
      return (
        <span data-part="spinner-dots" aria-hidden="true">
          ...
        </span>
      );
    case 'spinner':
      return (
        <span
          data-part="spinner-icon"
          aria-hidden="true"
          style={{ display: 'inline-block' }}
        >
          &#x21BB;
        </span>
      );
    case 'bar':
      return (
        <span
          data-part="spinner-bar"
          aria-hidden="true"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            display: 'inline-block',
            width: '4em',
            height: '0.5em',
            backgroundColor: 'currentColor',
            opacity: 0.2,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '0.25em',
          }}
        >
          <span
            data-part="spinner-bar-fill"
            style={{
              width: '50%',
              height: '100%',
              backgroundColor: 'currentColor',
              opacity: 1,
            }}
          />
        </span>
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function GenerationIndicator({
  status,
  model,
  tokenCount,
  showTokens = true,
  showModel = true,
  showElapsed = true,
  variant = 'dots',
  elapsedSeconds = 0,
  children,
}: GenerationIndicatorProps) {
  const isGenerating = status === 'generating';
  const showModelBadge = showModel && !!model;
  const showTokenCounter = showTokens && tokenCount != null;
  const elapsedText = formatElapsed(elapsedSeconds);

  return (
    <div
      role="status"
      aria-label={`Generation ${status}`}
      aria-live="polite"
      aria-busy={isGenerating}
      data-surface-widget=""
      data-widget-name="generation-indicator"
      data-part="root"
      data-state={status}
      data-variant={variant}
      tabIndex={0}
    >
      {/* Animated spinner/dots/bar indicator */}
      <div
        data-part="spinner"
        data-state={status}
        data-visible={isGenerating ? 'true' : 'false'}
        data-variant={variant}
        aria-hidden="true"
      >
        {isGenerating && <SpinnerContent variant={variant} />}
      </div>

      {/* Status text label */}
      <span data-part="status-text" data-state={status}>
        {statusText(status)}
      </span>

      {/* Model badge */}
      {showModelBadge && (
        <div
          data-part="model-badge"
          data-state={status}
          data-visible="true"
          role="presentation"
        >
          {model}
        </div>
      )}

      {/* Running token counter */}
      {showTokenCounter && (
        <span
          data-part="token-counter"
          data-state={status}
          data-visible="true"
          role="status"
          aria-label={`${tokenCount} tokens generated`}
        >
          {tokenCount} tokens
        </span>
      )}

      {/* Elapsed time display */}
      {showElapsed && (status === 'generating' || status === 'complete') && (
        <span
          data-part="elapsed"
          data-state={status}
          data-visible={isGenerating ? 'true' : 'false'}
        >
          {elapsedText}
        </span>
      )}

      {/* Error state: retry button */}
      {status === 'error' && (
        <button
          type="button"
          data-part="retry-button"
          data-state={status}
          aria-label="Retry generation"
          tabIndex={0}
        >
          Retry
        </button>
      )}

      {children}
    </div>
  );
}

export { GenerationIndicator };
