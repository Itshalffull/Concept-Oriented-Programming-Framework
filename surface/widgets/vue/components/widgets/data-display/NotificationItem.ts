// ============================================================
// NotificationItem -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface NotificationItemProps {
  title: string;
  description?: string;
  timestamp: string;
  read?: boolean;
  actions?: NotificationAction[];
  icon?: VNode | string;
  avatar?: VNode | string;
  size?: 'sm' | 'md' | 'lg';
  onActivate?: () => void;
  onDismiss?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onAction?: (action: string) => void;
}

export const NotificationItem = defineComponent({
  name: 'NotificationItem',

  props: {
    title: { type: String, required: true as const },
    description: { type: String },
    timestamp: { type: String, required: true as const },
    read: { type: Boolean, default: false },
    actions: { type: Array as PropType<any[]>, default: () => ([]) },
    icon: { type: null as unknown as PropType<any> },
    avatar: { type: null as unknown as PropType<any> },
    size: { type: String, default: 'md' },
    onActivate: { type: Function as PropType<(...args: any[]) => any> },
    onDismiss: { type: Function as PropType<(...args: any[]) => any> },
    onAction: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['activate', 'dismiss', 'action'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ current: props.read ? 'read' : 'unread', });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onActivate?.();
        }
        if (e.key === 'Delete') {
          e.preventDefault();
          props.onDismiss?.();
        }
      };
    const isRead = state.value === 'read' || state.value === 'hoveredRead';
    const isHovered = state.value === 'hoveredUnread' || state.value === 'hoveredRead';

    return (): VNode =>
      h('div', {
        'role': 'article',
        'aria-labelledby': titleId,
        'aria-describedby': props.description ? descriptionId : undefined,
        'aria-label': !isRead ? 'Unread notification' : undefined,
        'tabindex': 0,
        'data-surface-widget': '',
        'data-widget-name': 'notification-item',
        'data-part': 'notification-item',
        'data-read': isRead ? 'true' : 'false',
        'data-state': isHovered ? 'hovered' : 'idle',
        'data-size': props.size,
        'onMouseEnter': () => dispatch({ type: 'HOVER' }),
        'onMouseLeave': () => dispatch({ type: 'UNHOVER' }),
        'onFocus': () => dispatch({ type: 'FOCUS' }),
        'onBlur': () => dispatch({ type: 'BLUR' }),
        'onClick': props.onActivate,
        'onKeyDown': handleKeyDown,
      }, [
        h('span', {
          'data-part': 'unread-dot',
          'data-visible': isRead ? 'false' : 'true',
          'aria-hidden': 'true',
        }),
        props.icon ? h('div', { 'data-part': 'icon', 'aria-hidden': 'true' }, [
            props.icon,
          ]) : null,
        props.avatar ? h('div', { 'data-part': 'avatar' }, [
            props.avatar,
          ]) : null,
        h('div', { 'data-part': 'content' }, [
          h('span', { 'id': titleId, 'data-part': 'title' }, [
            props.title,
          ]),
          props.description ? h('span', {
              'id': descriptionId,
              'data-part': 'description',
              'data-visible': 'true',
            }, [
              props.description,
            ]) : null,
          h('time', {
            'data-part': 'timestamp',
            'dateTime': props.timestamp,
            'aria-label': props.timestamp,
          }, [
            props.timestamp,
          ]),
        ]),
        props.actions.length > 0 ? h('div', {
            'data-part': 'actions',
            'role': 'group',
            'aria-label': 'Notification actions',
            'data-visible': 'true',
          }, [
            ...props.actions.map((act) => h('button', { 'type': 'button', 'onClick': (e) => {
                  e.stopPropagation();
                  props.onAction?.(act.action);
                } }, [
                act.label,
              ])),
          ]) : null,
        slots.default?.(),
      ]);
  },
});

export default NotificationItem;