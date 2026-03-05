/* ---------------------------------------------------------------------------
 * VerificationStatusBadge state machine
 * States: idle (initial), hovered, animating
 * ------------------------------------------------------------------------- */

export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(
  state: VerificationStatusBadgeState,
  event: VerificationStatusBadgeEvent,
): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  type HTMLAttributes,
} from 'react';

/* ---------------------------------------------------------------------------
 * Status icon SVG paths
 * ------------------------------------------------------------------------- */

type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

function StatusIcon({ status }: { status: VerificationStatus }) {
  const size = 16;
  const shared = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (status) {
    case 'proved':
      // Checkmark
      return (
        <svg {...shared} data-icon="checkmark">
          <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      );
    case 'refuted':
      // Cross
      return (
        <svg {...shared} data-icon="cross">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      );
    case 'unknown':
      // Question mark
      return (
        <svg {...shared} data-icon="question">
          <path d="M6 5.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 2-2.5 3.5" />
          <circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'timeout':
      // Clock
      return (
        <svg {...shared} data-icon="clock">
          <circle cx="8" cy="8" r="5.5" />
          <polyline points="8 5 8 8 10.5 9.5" />
        </svg>
      );
    case 'running':
      // Spinner (animated via CSS)
      return (
        <svg {...shared} data-icon="spinner" data-animating="true">
          <circle cx="8" cy="8" r="5.5" strokeDasharray="20 12" />
        </svg>
      );
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VerificationStatusBadgeProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Verification outcome status. */
  status?: VerificationStatus;
  /** Human-readable status label. */
  label?: string;
  /** Verification duration in milliseconds. */
  duration?: number | undefined;
  /** Solver or prover name used for verification. */
  solver?: string | undefined;
  /** Visual size variant. */
  size?: 'sm' | 'md' | 'lg';
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const VerificationStatusBadge = forwardRef<HTMLDivElement, VerificationStatusBadgeProps>(
  function VerificationStatusBadge(
    {
      status = 'unknown',
      label = 'Unknown',
      duration,
      solver,
      size = 'md',
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(verificationStatusBadgeReducer, 'idle');
    const prevStatusRef = useRef(status);
    const animationTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const reducedMotionRef = useRef(false);
    const tooltipId = useRef(
      `vsb-tooltip-${Math.random().toString(36).slice(2, 9)}`,
    ).current;

    /* -- Detect prefers-reduced-motion ----------------------------------- */
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionRef.current = mql.matches;
      const handler = (e: MediaQueryListEvent) => {
        reducedMotionRef.current = e.matches;
      };
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }, []);

    /* -- Trigger STATUS_CHANGE when status prop changes ------------------ */
    useEffect(() => {
      if (prevStatusRef.current !== status) {
        prevStatusRef.current = status;
        if (reducedMotionRef.current) {
          // Skip animation for reduced-motion preference
          return;
        }
        send({ type: 'STATUS_CHANGE' });
      }
    }, [status]);

    /* -- Auto-end animation after a short delay -------------------------- */
    useEffect(() => {
      if (state === 'animating') {
        const ms = reducedMotionRef.current ? 0 : 200;
        animationTimerRef.current = setTimeout(
          () => send({ type: 'ANIMATION_END' }),
          ms,
        );
        return () => clearTimeout(animationTimerRef.current);
      }
    }, [state]);

    /* -- Event handlers -------------------------------------------------- */
    const handlePointerEnter = useCallback(() => {
      send({ type: 'HOVER' });
    }, []);

    const handlePointerLeave = useCallback(() => {
      send({ type: 'LEAVE' });
    }, []);

    const handleFocus = useCallback(() => {
      send({ type: 'HOVER' });
    }, []);

    const handleBlur = useCallback(() => {
      send({ type: 'LEAVE' });
    }, []);

    /* -- Tooltip content ------------------------------------------------- */
    const tooltipVisible = state === 'hovered';
    const hasTooltipContent = solver != null || duration != null;

    const tooltipText = [
      solver ?? null,
      duration != null ? `${duration}ms` : null,
    ]
      .filter(Boolean)
      .join(' \u2014 ');

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label={`Verification status: ${label}`}
        aria-describedby={hasTooltipContent ? tooltipId : undefined}
        data-surface-widget=""
        data-widget-name="verification-status-badge"
        data-part="root"
        data-state={state}
        data-status={status}
        data-size={size}
        tabIndex={0}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      >
        <span data-part="icon" data-status={status} aria-hidden="true">
          <StatusIcon status={status} />
        </span>

        <span data-part="label">{label}</span>

        {hasTooltipContent && (
          <div
            id={tooltipId}
            role="tooltip"
            data-part="tooltip"
            data-visible={tooltipVisible ? 'true' : 'false'}
            aria-hidden={tooltipVisible ? 'false' : 'true'}
            style={{
              visibility: tooltipVisible ? 'visible' : 'hidden',
              position: 'absolute',
              pointerEvents: 'none',
            }}
          >
            {tooltipText}
          </div>
        )}
      </div>
    );
  },
);

VerificationStatusBadge.displayName = 'VerificationStatusBadge';
export { VerificationStatusBadge };
export default VerificationStatusBadge;
