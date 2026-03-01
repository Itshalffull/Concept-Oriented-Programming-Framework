'use client';
import { forwardRef, useReducer, useId, type ReactNode } from 'react';
import { emptyStateReducer, emptyStateInitialState } from './EmptyState.reducer.js';

// Props from empty-state.widget spec
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    {
      title,
      description,
      icon,
      action,
      size = 'md',
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(emptyStateReducer, emptyStateInitialState);
    const titleId = useId();
    const descriptionId = useId();

    return (
      <div
        ref={ref}
        className={className}
        role="region"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-surface-widget=""
        data-widget-name="empty-state"
        data-part="empty-state"
        data-state={state.current}
        data-size={size}
      >
        {icon && (
          <div
            data-part="icon"
            data-visible="true"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h3
          id={titleId}
          data-part="title"
        >
          {title}
        </h3>
        {description && (
          <p
            id={descriptionId}
            data-part="description"
            data-visible="true"
          >
            {description}
          </p>
        )}
        {action && (
          <div data-part="action">
            {action}
          </div>
        )}
        {children}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
export default EmptyState;
