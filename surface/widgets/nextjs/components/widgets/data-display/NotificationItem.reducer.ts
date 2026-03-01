export type NotificationItemState = { current: 'unread' | 'read' | 'hoveredUnread' | 'hoveredRead' };

export type NotificationItemAction =
  | { type: 'MARK_READ' }
  | { type: 'MARK_UNREAD' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function notificationItemReducer(state: NotificationItemState, action: NotificationItemAction): NotificationItemState {
  switch (state.current) {
    case 'unread':
      if (action.type === 'MARK_READ') return { current: 'read' };
      if (action.type === 'HOVER') return { current: 'hoveredUnread' };
      return state;
    case 'read':
      if (action.type === 'MARK_UNREAD') return { current: 'unread' };
      if (action.type === 'HOVER') return { current: 'hoveredRead' };
      return state;
    case 'hoveredUnread':
      if (action.type === 'UNHOVER') return { current: 'unread' };
      if (action.type === 'MARK_READ') return { current: 'hoveredRead' };
      return state;
    case 'hoveredRead':
      if (action.type === 'UNHOVER') return { current: 'read' };
      if (action.type === 'MARK_UNREAD') return { current: 'hoveredUnread' };
      return state;
    default:
      return state;
  }
}
