import type { HTMLAttributes } from 'react';

/* ---------------------------------------------------------------------------
 * Types & Icons
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
      return (
        <svg {...shared} data-icon="checkmark">
          <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      );
    case 'refuted':
      return (
        <svg {...shared} data-icon="cross">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      );
    case 'unknown':
      return (
        <svg {...shared} data-icon="question">
          <path d="M6 5.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 2-2.5 3.5" />
          <circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'timeout':
      return (
        <svg {...shared} data-icon="clock">
          <circle cx="8" cy="8" r="5.5" />
          <polyline points="8 5 8 8 10.5 9.5" />
        </svg>
      );
    case 'running':
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
  status?: VerificationStatus;
  label?: string;
  duration?: number | undefined;
  solver?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function VerificationStatusBadge({
  status = 'unknown',
  label = 'Unknown',
  duration,
  solver,
  size = 'md',
  ...rest
}: VerificationStatusBadgeProps) {
  const hasTooltipContent = solver != null || duration != null;
  const tooltipText = [solver ?? null, duration != null ? `${duration}ms` : null]
    .filter(Boolean)
    .join(' \u2014 ');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Verification status: ${label}`}
      data-surface-widget=""
      data-widget-name="verification-status-badge"
      data-part="root"
      data-state="idle"
      data-status={status}
      data-size={size}
      tabIndex={0}
      {...rest}
    >
      <span data-part="icon" data-status={status} aria-hidden="true">
        <StatusIcon status={status} />
      </span>

      <span data-part="label">{label}</span>

      {hasTooltipContent && (
        <div
          role="tooltip"
          data-part="tooltip"
          data-visible="false"
          aria-hidden="true"
          style={{
            visibility: 'hidden',
            position: 'absolute',
            pointerEvents: 'none',
          }}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
}

export { VerificationStatusBadge };
