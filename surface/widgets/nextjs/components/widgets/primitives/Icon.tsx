'use client';
import { forwardRef, type ReactNode } from 'react';

// Props from icon.widget spec
export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
  children?: ReactNode;
  className?: string;
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(
  function Icon(
    {
      name = '',
      size = 'md',
      decorative = true,
      label,
      children,
      className,
    },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={className}
        role={decorative ? 'presentation' : 'img'}
        aria-hidden={decorative ? 'true' : 'false'}
        aria-label={decorative ? undefined : label}
        data-surface-widget=""
        data-widget-name="icon"
        data-part="root"
        data-icon={name}
        data-size={size}
      >
        {children}
      </span>
    );
  }
);

Icon.displayName = 'Icon';
export default Icon;
