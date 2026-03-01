// State machine from presence.widget spec: unmounted -> mounting -> mounted -> unmounting -> unmounted
export type PresenceState = 'unmounted' | 'mounting' | 'mounted' | 'unmounting';
export type PresenceEvent =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'ANIMATION_END' };

export function presenceReducer(state: PresenceState, event: PresenceEvent): PresenceState {
  switch (state) {
    case 'unmounted':
      if (event.type === 'SHOW') return 'mounting';
      return state;
    case 'mounting':
      if (event.type === 'ANIMATION_END') return 'mounted';
      return state;
    case 'mounted':
      if (event.type === 'HIDE') return 'unmounting';
      return state;
    case 'unmounting':
      if (event.type === 'ANIMATION_END') return 'unmounted';
      if (event.type === 'SHOW') return 'mounting';
      return state;
    default:
      return state;
  }
}

export function stateToDataState(state: PresenceState): string {
  switch (state) {
    case 'mounted':
      return 'open';
    case 'mounting':
      return 'entering';
    case 'unmounting':
      return 'exiting';
    case 'unmounted':
    default:
      return 'closed';
  }
}
