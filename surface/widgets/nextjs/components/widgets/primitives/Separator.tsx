'use client';
import { forwardRef } from 'react';

// Props from separator.widget spec
export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  function Separator(
    {
      orientation = 'horizontal',
      className,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={className}
        data-surface-widget=""
        data-widget-name="separator"
        data-part="root"
        data-orientation={orientation}
      />
    );
  }
);

Separator.displayName = 'Separator';
export default Separator;
