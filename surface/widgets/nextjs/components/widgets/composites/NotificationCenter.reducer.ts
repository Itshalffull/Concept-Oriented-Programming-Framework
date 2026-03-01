/* ---------------------------------------------------------------------------
 * NotificationCenter reducer — extracted state machine
 * States: panel (closed | open), loading (idle | loading | error), unread
 * ------------------------------------------------------------------------- */

export interface NotificationCenterState {
  panel: 'closed' | 'open';
  loading: 'idle' | 'loading' | 'error';
  unread: 'none' | 'hasUnread';
  activeTab: string;
}

export type NotificationCenterEvent =
  | { type: 'TOGGLE' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' }
  | { type: 'MARK_ALL_READ' }
  | { type: 'CHANGE_TAB'; tab: string };

export function notificationCenterReducer(
  state: NotificationCenterState,
  event: NotificationCenterEvent,
): NotificationCenterState {
  switch (event.type) {
    case 'TOGGLE':
      return { ...state, panel: state.panel === 'closed' ? 'open' : 'closed' };
    case 'OPEN':
      return { ...state, panel: 'open' };
    case 'CLOSE':
      return { ...state, panel: 'closed' };
    case 'LOAD':
      return { ...state, loading: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, loading: 'idle' };
    case 'LOAD_ERROR':
      return { ...state, loading: 'error' };
    case 'MARK_ALL_READ':
      return { ...state, unread: 'none' };
    case 'CHANGE_TAB':
      return { ...state, activeTab: event.tab };
    default:
      return state;
  }
}
