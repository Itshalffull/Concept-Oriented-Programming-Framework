// ============================================================
// NotificationCenter -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface NotificationDef {
  id: string;
  type: string;
  title: string;
  body?: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationCenterProps {
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
}

export const NotificationCenter = defineComponent({
  name: 'NotificationCenter',

  props: {
    open: { type: Boolean, default: false },
    notifications: { type: Array as PropType<any[]>, default: () => ([]) },
    unreadCount: { type: Number, default: 0 },
    activeTab: { type: String, default: 'all' },
    tabs: { type: Array as PropType<any[]>, default: () => (['all', 'unread', 'mentions']) },
    loading: { type: Boolean, default: false },
    hasMore: { type: Boolean, default: false },
    placement: { type: String, default: 'bottom-end' },
    onOpen: { type: Function as PropType<(...args: any[]) => any> },
    onClose: { type: Function as PropType<(...args: any[]) => any> },
    onMarkRead: { type: Function as PropType<(...args: any[]) => any> },
    onMarkAllRead: { type: Function as PropType<(...args: any[]) => any> },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    onLoadMore: { type: Function as PropType<(...args: any[]) => any> },
    onTabChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['close', 'open', 'mark-all-read', 'tab-change', 'navigate', 'mark-read', 'load-more'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ panel: props.open ? 'open' : 'closed', loading: props.loading ? 'loading' : 'idle', unread: props.unreadCount > 0 ? 'hasUnread' : 'none', props.activeTab, });
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const panelRef = ref<any>(null);
    const handleToggle = () => {
      send({ type: 'TOGGLE' });
      if (isOpen) props.onClose?.();
      else props.onOpen?.();
    };
    const handleClose = () => {
      send({ type: 'CLOSE' });
      props.onClose?.();
      triggerRef.value?.focus();
    };
    const isOpen = props.open !== undefined ? open : state.value.panel === 'open';
    const badgeText = props.unreadCount > 99 ? '99+' : String(props.unreadCount);
    onMounted(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      };
      const handleOutsideClick = (e: MouseEvent) => {
      if (
      panelRef.value &&
      !panelRef.value.contains(e.target as Node) &&
      triggerRef.value &&
      !triggerRef.value.contains(e.target as Node)
      ) {
      handleClose();
      }
      };
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleOutsideClick);
    });
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    });

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'notification-center',
        'data-part': 'root',
        'data-state': isOpen ? 'open' : 'closed',
        'data-unread': props.unreadCount > 0 ? 'true' : 'false',
      }, [
        h('button', {
          'ref': triggerRef,
          'type': 'button',
          'data-part': 'trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': isOpen ? 'true' : 'false',
          'aria-label': props.unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications',
          'aria-controls': panelId,
          'onClick': handleToggle,
        }, [
          h('span', {
            'data-part': 'bell-icon',
            'data-unread': props.unreadCount > 0 ? 'true' : 'false',
            'aria-hidden': 'true',
          }, '&#x1F514;'),
          props.unreadCount > 0 ? h('span', { 'data-part': 'unread-badge', 'aria-hidden': 'true' }, [
              badgeText,
            ]) : null,
        ]),
        h('div', {
          'ref': panelRef,
          'id': panelId,
          'role': 'dialog',
          'aria-label': 'Notification center',
          'aria-modal': 'false',
          'data-part': 'panel',
          'data-state': isOpen ? 'open' : 'closed',
          'data-placement': props.placement,
          'hidden': !isOpen,
        }, [
          h('div', { 'data-part': 'panel-header' }, [
            h('span', { 'data-part': 'panel-title', 'id': titleId }, 'Notifications'),
            h('button', {
              'type': 'button',
              'data-part': 'mark-all-read-button',
              'aria-label': 'Mark all notifications as read',
              'disabled': props.unreadCount === 0,
              'onClick': () => {
                send({ type: 'MARK_ALL_READ' });
                props.onMarkAllRead?.();
              },
            }, 'Mark all read'),
          ]),
          h('div', { 'data-part': 'tabs', 'role': 'tablist' }, [
            ...props.tabs.map((tab) => h('button', {
                'type': 'button',
                'role': 'tab',
                'data-part': 'tab',
                'data-tab': tab,
                'aria-selected': state.activeTab === tab ? 'true' : 'false',
                'onClick': () => {
                  send({ type: 'CHANGE_TAB', tab });
                  props.onTabChange?.(tab);
                },
              }, [
                tab.charAt(0).toUpperCase() + tab.slice(1),
              ])),
          ]),
          h('div', {
            'role': 'list',
            'aria-label': 'Notifications',
            'aria-busy': props.loading ? 'true' : 'false',
            'data-part': 'notification-list',
            'data-tab': state.activeTab,
            'data-state': props.loading ? 'loading' : filteredNotifications.length === 0 ? 'empty' : 'idle',
          }, [
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                role="listitem"
                data-part="notification-item"
                data-read={notification.read ? 'true' : 'false'}
                data-type={notification.type}
                tabIndex={0}
                onClick={() => props.onNavigate?.(notification.id)}
                onFocus={() => props.onMarkRead?.(notification.id)}
              >
                <span data-part="notification-title">{notification.title}</span>
                {notification.body ? h('span', { 'data-part': 'notification-body' }, [
                notification.body,
              ]) : null,
          ]),
          !props.loading && filteredNotifications.length === 0 ? h('div', { 'data-part': 'empty-state' }, 'No notifications') : null,
          props.hasMore ? h('button', {
              'type': 'button',
              'data-part': 'load-more-button',
              'aria-label': 'Load more notifications',
              'disabled': props.loading,
              'onClick': () => {
                send({ type: 'LOAD' });
                props.onLoadMore?.();
              },
            }, 'Load more') : null,
          h('button', {
            'type': 'button',
            'data-part': 'settings-button',
            'aria-label': 'Notification settings',
          }, 'Settings'),
        ]),
        slots.default?.(),
      ]);
  },
});
});)

export default NotificationCenter;