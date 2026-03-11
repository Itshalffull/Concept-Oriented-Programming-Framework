/* ---------------------------------------------------------------------------
 * ConnectorPortIndicator state machine
 * States: idle (initial), hovered, connecting, full
 * ------------------------------------------------------------------------- */

export type PortState = 'idle' | 'hovered' | 'connecting' | 'full';
export type PortEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_END' }
  | { type: 'CANCEL' }
  | { type: 'DISCONNECT' };

export function portReducer(state: PortState, event: PortEvent): PortState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'CONNECT_START') return 'connecting';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'CONNECT_START') return 'connecting';
      return state;
    case 'connecting':
      if (event.type === 'CONNECT_END') return 'idle';
      if (event.type === 'CANCEL') return 'idle';
      return state;
    case 'full':
      if (event.type === 'DISCONNECT') return 'idle';
      return state;
    default:
      return state;
  }
}
