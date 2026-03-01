'use client';
import { forwardRef, useReducer, useCallback, useId, type ReactNode, type KeyboardEvent } from 'react';
import { notificationItemReducer } from './NotificationItem.reducer.js';

// Props from notification-item.widget spec
export interface NotificationAction {
  label: string;
  action: string;
}

export interface NotificationItemProps {
  title: string;
  description?: string;
  timestamp: string;
  read?: boolean;
  actions?: NotificationAction[];
  icon?: ReactNode;
  avatar?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onActivate?: () => void;
  onDismiss?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onAction?: (action: string) => void;
  className?: string;
  children?: ReactNode;
}

export const NotificationItem = forwardRef<HTMLDivElement, NotificationItemProps>(
  function NotificationItem(
    {
      title,
      description,
      timestamp,
      read = false,
      actions = [],
      icon,
      avatar,
      size = 'md',
      onActivate,
      onDismiss,
      onAction,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(notificationItemReducer, {
      current: read ? 'read' : 'unread',
    });
    const titleId = useId();
    const descriptionId = useId();

    const isRead = state.current === 'read' || state.current === 'hoveredRead';
    const isHovered = state.current === 'hoveredUnread' || state.current === 'hoveredRead';

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
        if (e.key === 'Delete') {
          e.preventDefault();
          onDismiss?.();
        }
      },
      [onActivate, onDismiss]
    );

    return (
      <div
        ref={ref}
        className={className}
        role="article"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!isRead ? 'Unread notification' : undefined}
        tabIndex={0}
        data-surface-widget=""
        data-widget-name="notification-item"
        data-part="notification-item"
        data-read={isRead ? 'true' : 'false'}
        data-state={isHovered ? 'hovered' : 'idle'}
        data-size={size}
        onMouseEnter={() => dispatch({ type: 'HOVER' })}
        onMouseLeave={() => dispatch({ type: 'UNHOVER' })}
        onFocus={() => dispatch({ type: 'FOCUS' })}
        onBlur={() => dispatch({ type: 'BLUR' })}
        onClick={onActivate}
        onKeyDown={handleKeyDown}
      >
        <span
          data-part="unread-dot"
          data-visible={isRead ? 'false' : 'true'}
          aria-hidden="true"
        />
        {icon && (
          <div data-part="icon" aria-hidden="true">
            {icon}
          </div>
        )}
        {avatar && (
          <div data-part="avatar">
            {avatar}
          </div>
        )}
        <div data-part="content">
          <span id={titleId} data-part="title">
            {title}
          </span>
          {description && (
            <span
              id={descriptionId}
              data-part="description"
              data-visible="true"
            >
              {description}
            </span>
          )}
          <time
            data-part="timestamp"
            dateTime={timestamp}
            aria-label={timestamp}
          >
            {timestamp}
          </time>
        </div>
        {actions.length > 0 && (
          <div
            data-part="actions"
            role="group"
            aria-label="Notification actions"
            data-visible="true"
          >
            {actions.map((act) => (
              <button
                key={act.action}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.(act.action);
                }}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    );
  }
);

NotificationItem.displayName = 'NotificationItem';
export default NotificationItem;
