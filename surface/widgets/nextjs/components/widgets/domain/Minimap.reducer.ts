/* ---------------------------------------------------------------------------
 * Minimap state machine
 * States: idle (initial), panning
 * ------------------------------------------------------------------------- */

export type MinimapState = 'idle' | 'panning';
export type MinimapEvent =
  | { type: 'PAN_START' }
  | { type: 'PAN_END' }
  | { type: 'ESCAPE' }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'ZOOM_FIT' };

export function minimapReducer(state: MinimapState, event: MinimapEvent): MinimapState {
  switch (state) {
    case 'idle':
      if (event.type === 'PAN_START') return 'panning';
      return state;
    case 'panning':
      if (event.type === 'PAN_END') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    default:
      return state;
  }
}
