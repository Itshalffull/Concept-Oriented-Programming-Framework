'use client';
import { forwardRef, type ReactNode } from 'react';

// Props from visually-hidden.widget spec
export interface VisuallyHiddenProps {
  text?: string;
  children?: ReactNode;
  className?: string;
}

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  function VisuallyHidden(
    {
      text = '',
      children,
      className,
    },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={className}
        style={visuallyHiddenStyle}
        data-surface-widget=""
        data-widget-name="visually-hidden"
        data-part="root"
      >
        {children || text}
      </span>
    );
  }
);

VisuallyHidden.displayName = 'VisuallyHidden';
export default VisuallyHidden;
