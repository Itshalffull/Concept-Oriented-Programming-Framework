/* ---------------------------------------------------------------------------
 * GraphView state machine
 * Main: globalView (initial), localView, nodeSelected, searching, panning
 * Simulation: running (initial), stabilized, paused
 * ------------------------------------------------------------------------- */

export interface GVState {
  view: 'globalView' | 'localView' | 'nodeSelected' | 'searching' | 'panning';
  simulation: 'running' | 'stabilized' | 'paused';
}

export type GVEvent =
  | { type: 'SWITCH_GLOBAL' }
  | { type: 'SWITCH_LOCAL' }
  | { type: 'SELECT_NODE' }
  | { type: 'DESELECT' }
  | { type: 'SEARCH' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'PAN_START' }
  | { type: 'PAN_END' }
  | { type: 'STABILIZE' }
  | { type: 'REHEAT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export function gvReducer(state: GVState, event: GVEvent): GVState {
  switch (event.type) {
    case 'SWITCH_GLOBAL':
      return { ...state, view: 'globalView' };
    case 'SWITCH_LOCAL':
      return { ...state, view: 'localView' };
    case 'SELECT_NODE':
      return { ...state, view: 'nodeSelected' };
    case 'DESELECT':
      return { ...state, view: 'globalView' };
    case 'SEARCH':
      return { ...state, view: 'searching' };
    case 'CLEAR_SEARCH':
      return { ...state, view: 'globalView' };
    case 'PAN_START':
      return { ...state, view: 'panning' };
    case 'PAN_END':
      return { ...state, view: 'globalView' };
    case 'STABILIZE':
      return { ...state, simulation: 'stabilized' };
    case 'REHEAT':
    case 'RESUME':
      return { ...state, simulation: 'running' };
    case 'PAUSE':
      return { ...state, simulation: 'paused' };
    default:
      return state;
  }
}
