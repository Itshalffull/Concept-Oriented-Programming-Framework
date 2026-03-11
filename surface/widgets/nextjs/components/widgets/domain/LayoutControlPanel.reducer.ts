/* ---------------------------------------------------------------------------
 * LayoutControlPanel state machine
 * States: idle (initial), configured, applying
 * ------------------------------------------------------------------------- */

export type LayoutPanelState = 'idle' | 'configured' | 'applying';
export type LayoutPanelEvent =
  | { type: 'SELECT_ALGORITHM'; algorithm: string }
  | { type: 'SET_DIRECTION'; direction: string }
  | { type: 'SET_SPACING'; spacing: number }
  | { type: 'APPLY' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' };

export function layoutPanelReducer(state: LayoutPanelState, event: LayoutPanelEvent): LayoutPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ALGORITHM') return 'configured';
      return state;
    case 'configured':
      if (event.type === 'APPLY') return 'applying';
      if (event.type === 'SELECT_ALGORITHM') return 'configured';
      return state;
    case 'applying':
      if (event.type === 'COMPLETE') return 'idle';
      if (event.type === 'ERROR') return 'configured';
      return state;
    default:
      return state;
  }
}
