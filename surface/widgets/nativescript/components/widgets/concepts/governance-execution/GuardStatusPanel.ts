export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD' }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface GuardStatusPanelProps { [key: string]: unknown; }

export function createGuardStatusPanel(props: GuardStatusPanelProps) {
  let state: GuardStatusPanelState = 'idle';

  function send(type: string) {
    state = guardStatusPanelReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createGuardStatusPanel;
