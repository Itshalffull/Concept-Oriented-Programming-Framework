export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';
export type GenerationIndicatorEvent =
  | { type: 'START' }
  | { type: 'TOKEN' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function generationIndicatorReducer(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'generating';
      return state;
    case 'generating':
      if (event.type === 'TOKEN') return 'generating';
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'error';
      return state;
    case 'complete':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'START') return 'generating';
      return state;
    case 'error':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'generating';
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

/** Format elapsed seconds as a human-readable string */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export interface GenerationIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current generation status driven by the parent */
  status: GenerationIndicatorState;
  /** Name of the active model */
  model?: string | undefined;
  /** Running count of tokens generated so far */
  tokenCount?: number | undefined;
  /** Whether to show the token counter (default: true) */
  showTokens?: boolean;
  /** Whether to show the model badge (default: true) */
  showModel?: boolean;
  /** Whether to show elapsed time (default: true) */
  showElapsed?: boolean;
  /** Animation variant for the spinner area */
  variant?: 'dots' | 'spinner' | 'bar';
  /** Whether the generation can be cancelled (enables Escape key) */
  cancelable?: boolean;
  /** Callback when cancel is triggered via Escape */
  onCancel?: () => void;
  /** Callback when retry is triggered from the error state */
  onRetry?: () => void;
  children?: ReactNode;
}

const GenerationIndicator = forwardRef<HTMLDivElement, GenerationIndicatorProps>(function GenerationIndicator(
  {
    status,
    model,
    tokenCount,
    showTokens = true,
    showModel = true,
    showElapsed = true,
    variant = 'dots',
    cancelable = false,
    onCancel,
    onRetry,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(generationIndicatorReducer, 'idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion = useRef(false);

  // Detect prefers-reduced-motion on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.current = mql.matches;
      const handler = (e: MediaQueryListEvent) => {
        prefersReducedMotion.current = e.matches;
      };
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, []);

  // Sync reducer state with the status prop
  useEffect(() => {
    switch (status) {
      case 'generating':
        if (state === 'idle' || state === 'complete' || state === 'error') {
          send({ type: state === 'error' ? 'RETRY' : 'START' });
        }
        break;
      case 'complete':
        if (state === 'generating') {
          send({ type: 'COMPLETE' });
        }
        break;
      case 'error':
        if (state === 'generating') {
          send({ type: 'ERROR' });
        }
        break;
      case 'idle':
        if (state === 'complete' || state === 'error') {
          send({ type: 'RESET' });
        }
        break;
    }
  }, [status, state]);

  // Clear interval helper
  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Elapsed time timer: runs only during 'generating' state
  useEffect(() => {
    if (state === 'generating') {
      setElapsedSeconds(0);
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => {
        stopInterval();
      };
    }

    if (state === 'complete' || state === 'error') {
      // Capture final elapsed when leaving generating
      setFinalElapsed(elapsedSeconds);
      stopInterval();
    }

    if (state === 'idle') {
      setElapsedSeconds(0);
      setFinalElapsed(0);
      stopInterval();
    }

    return () => {
      stopInterval();
    };
  }, [state, stopInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard handler: Escape to cancel
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && cancelable && state === 'generating') {
        e.preventDefault();
        onCancel?.();
      }
      // Forward any existing onKeyDown from restProps
      restProps.onKeyDown?.(e);
    },
    [cancelable, state, onCancel, restProps.onKeyDown], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleRetry = useCallback(() => {
    if (state === 'error') {
      onRetry?.();
    }
  }, [state, onRetry]);

  // Status text per state
  const statusText = useMemo(() => {
    switch (state) {
      case 'generating':
        return 'Generating...';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  }, [state]);

  // Token display text
  const tokenText = useMemo(() => {
    if (tokenCount == null) return null;
    return `${tokenCount} tokens`;
  }, [tokenCount]);

  // Elapsed display
  const elapsedText = useMemo(() => {
    if (state === 'generating') return formatElapsed(elapsedSeconds);
    if (state === 'complete' || state === 'error') return formatElapsed(finalElapsed);
    return '';
  }, [state, elapsedSeconds, finalElapsed]);

  // Spinner content based on variant
  const spinnerContent = useMemo(() => {
    if (state !== 'generating') return null;
    const reduced = prefersReducedMotion.current;
    switch (variant) {
      case 'dots':
        return (
          <span
            data-part="spinner-dots"
            aria-hidden="true"
            style={reduced ? undefined : { animation: 'generation-dots 1.4s infinite steps(3, end)' }}
          >
            ...
          </span>
        );
      case 'spinner':
        return (
          <span
            data-part="spinner-icon"
            aria-hidden="true"
            style={
              reduced
                ? undefined
                : {
                    display: 'inline-block',
                    animation: 'generation-spin 1s linear infinite',
                  }
            }
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
              style={
                reduced
                  ? { width: '50%', height: '100%', backgroundColor: 'currentColor', opacity: 1 }
                  : {
                      position: 'absolute',
                      width: '40%',
                      height: '100%',
                      backgroundColor: 'currentColor',
                      opacity: 1,
                      animation: 'generation-bar 1.5s ease-in-out infinite',
                    }
              }
            />
          </span>
        );
      default:
        return null;
    }
  }, [state, variant]);

  const isGenerating = state === 'generating';
  const showModelBadge = showModel && !!model;
  const showTokenCounter = showTokens && tokenCount != null;

  const ariaLabel = useMemo(() => `Generation ${state}`, [state]);

  return (
    <div
      ref={ref}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-busy={isGenerating}
      data-surface-widget=""
      data-widget-name="generation-indicator"
      data-part="root"
      data-state={state}
      data-variant={variant}
      tabIndex={0}
      {...restProps}
      onKeyDown={handleKeyDown}
    >
      {/* Animated spinner/dots/bar indicator */}
      <div
        data-part="spinner"
        data-state={state}
        data-visible={isGenerating ? 'true' : 'false'}
        data-variant={variant}
        aria-hidden="true"
      >
        {spinnerContent}
      </div>

      {/* Status text label */}
      <span data-part="status-text" data-state={state}>
        {statusText}
      </span>

      {/* Model badge */}
      {showModelBadge && (
        <div
          data-part="model-badge"
          data-state={state}
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
          data-state={state}
          data-visible="true"
          role="status"
          aria-label={`${tokenCount} tokens generated`}
        >
          {tokenText}
        </span>
      )}

      {/* Elapsed time display */}
      {showElapsed && (state === 'generating' || state === 'complete') && (
        <span
          data-part="elapsed"
          data-state={state}
          data-visible={isGenerating ? 'true' : 'false'}
        >
          {elapsedText}
        </span>
      )}

      {/* Error state: retry button */}
      {state === 'error' && (
        <button
          type="button"
          data-part="retry-button"
          data-state={state}
          aria-label="Retry generation"
          tabIndex={0}
          onClick={handleRetry}
        >
          Retry
        </button>
      )}

      {children}
    </div>
  );
});

GenerationIndicator.displayName = 'GenerationIndicator';
export { GenerationIndicator };
export default GenerationIndicator;
