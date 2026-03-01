'use client';
import { forwardRef } from 'react';

// Props from spinner.widget spec
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
  className?: string;
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  function Spinner(
    {
      size = 'md',
      label,
      trackVisible = true,
      className,
    },
    ref
  ) {
    const accessibleLabel = label || 'Loading';

    return (
      <div
        ref={ref}
        className={className}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleLabel}
        aria-busy="true"
        data-surface-widget=""
        data-widget-name="spinner"
        data-part="root"
        data-size={size}
      >
        <span
          data-part="track"
          data-visible={trackVisible ? 'true' : 'false'}
          aria-hidden="true"
        />
        <span
          data-part="indicator"
          aria-hidden="true"
        />
        {label && (
          <span
            data-part="label"
            data-visible="true"
          >
            {label}
          </span>
        )}
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';
export default Spinner;
