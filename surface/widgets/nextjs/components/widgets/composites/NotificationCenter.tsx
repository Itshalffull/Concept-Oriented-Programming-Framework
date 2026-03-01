'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { notificationCenterReducer } from './NotificationCenter.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from notification-center.widget spec props
 * ------------------------------------------------------------------------- */

export interface NotificationDef {
  id: string;
  type: string;
  title: string;
  body?: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationCenterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  open?: boolean;
  notifications?: NotificationDef[];
  unreadCount?: number;
  activeTab?: string;
  tabs?: string[];
  loading?: boolean;
  hasMore?: boolean;
  placement?: string;
  onOpen?: () => void;
  onClose?: () => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onNavigate?: (id: string) => void;
  onLoadMore?: () => void;
  onTabChange?: (tab: string) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const NotificationCenter = forwardRef<HTMLDivElement, NotificationCenterProps>(
  function NotificationCenter(
    {
      open = false,
      notifications = [],
      unreadCount = 0,
      activeTab = 'all',
      tabs = ['all', 'unread', 'mentions'],
      loading = false,
      hasMore = false,
      placement = 'bottom-end',
      onOpen,
      onClose,
      onMarkRead,
      onMarkAllRead,
      onNavigate,
      onLoadMore,
      onTabChange,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(notificationCenterReducer, {
      panel: open ? 'open' : 'closed',
      loading: loading ? 'loading' : 'idle',
      unread: unreadCount > 0 ? 'hasUnread' : 'none',
      activeTab,
    });

    const panelId = useId();
    const titleId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const isOpen = open !== undefined ? open : state.panel === 'open';

    const handleToggle = useCallback(() => {
      send({ type: 'TOGGLE' });
      if (isOpen) onClose?.();
      else onOpen?.();
    }, [isOpen, onOpen, onClose]);

    const handleClose = useCallback(() => {
      send({ type: 'CLOSE' });
      onClose?.();
      triggerRef.current?.focus();
    }, [onClose]);

    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      const handleOutsideClick = (e: MouseEvent) => {
        if (
          panelRef.current &&
          !panelRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          handleClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleOutsideClick);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }, [isOpen, handleClose]);

    const filteredNotifications = notifications.filter((n) => {
      if (state.activeTab === 'all') return true;
      if (state.activeTab === 'unread') return !n.read;
      if (state.activeTab === 'mentions') return n.type === 'mention';
      return true;
    });

    const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
      <div
        ref={ref}
        data-surface-widget=""
        data-widget-name="notification-center"
        data-part="root"
        data-state={isOpen ? 'open' : 'closed'}
        data-unread={unreadCount > 0 ? 'true' : 'false'}
        {...rest}
      >
        <button
          ref={triggerRef}
          type="button"
          data-part="trigger"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          aria-controls={panelId}
          onClick={handleToggle}
        >
          <span data-part="bell-icon" data-unread={unreadCount > 0 ? 'true' : 'false'} aria-hidden="true">
            &#x1F514;
          </span>
          {unreadCount > 0 && (
            <span data-part="unread-badge" aria-hidden="true">
              {badgeText}
            </span>
          )}
        </button>

        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Notification center"
          aria-modal="false"
          data-part="panel"
          data-state={isOpen ? 'open' : 'closed'}
          data-placement={placement}
          hidden={!isOpen}
        >
          <div data-part="panel-header">
            <span data-part="panel-title" id={titleId}>
              Notifications
            </span>
            <button
              type="button"
              data-part="mark-all-read-button"
              aria-label="Mark all notifications as read"
              disabled={unreadCount === 0}
              onClick={() => {
                send({ type: 'MARK_ALL_READ' });
                onMarkAllRead?.();
              }}
            >
              Mark all read
            </button>
          </div>

          <div data-part="tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                data-part="tab"
                data-tab={tab}
                aria-selected={state.activeTab === tab ? 'true' : 'false'}
                onClick={() => {
                  send({ type: 'CHANGE_TAB', tab });
                  onTabChange?.(tab);
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div
            role="list"
            aria-label="Notifications"
            aria-busy={loading ? 'true' : 'false'}
            data-part="notification-list"
            data-tab={state.activeTab}
            data-state={loading ? 'loading' : filteredNotifications.length === 0 ? 'empty' : 'idle'}
          >
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                role="listitem"
                data-part="notification-item"
                data-read={notification.read ? 'true' : 'false'}
                data-type={notification.type}
                tabIndex={0}
                onClick={() => onNavigate?.(notification.id)}
                onFocus={() => onMarkRead?.(notification.id)}
              >
                <span data-part="notification-title">{notification.title}</span>
                {notification.body && (
                  <span data-part="notification-body">{notification.body}</span>
                )}
                <span data-part="notification-timestamp">{notification.timestamp}</span>
              </div>
            ))}
          </div>

          {!loading && filteredNotifications.length === 0 && (
            <div data-part="empty-state">No notifications</div>
          )}

          {hasMore && (
            <button
              type="button"
              data-part="load-more-button"
              aria-label="Load more notifications"
              disabled={loading}
              onClick={() => {
                send({ type: 'LOAD' });
                onLoadMore?.();
              }}
            >
              Load more
            </button>
          )}

          <button
            type="button"
            data-part="settings-button"
            aria-label="Notification settings"
          >
            Settings
          </button>
        </div>

        {children}
      </div>
    );
  },
);

NotificationCenter.displayName = 'NotificationCenter';
export default NotificationCenter;
