'use client';
import { forwardRef, useCallback, type ReactNode } from 'react';

// Props from label.widget spec
export interface LabelProps {
  text?: string;
  htmlFor?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  function Label(
    {
      text = '',
      htmlFor,
      required = false,
      children,
      className,
    },
    ref
  ) {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={className}
        data-surface-widget=""
        data-widget-name="label"
        data-part="root"
      >
        {children || text}
        <span
          data-part="required-indicator"
          data-visible={required ? 'true' : 'false'}
          aria-hidden="true"
        >
          {required ? ' *' : ''}
        </span>
      </label>
    );
  }
);

Label.displayName = 'Label';
export default Label;
