/* ---------------------------------------------------------------------------
 * NodePalettePanel state machine
 * States: idle (initial), filtering, dragging
 * ------------------------------------------------------------------------- */

export type PaletteState = 'idle' | 'filtering' | 'dragging';
export type PaletteEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'CLEAR' }
  | { type: 'DRAG_START'; typeKey: string }
  | { type: 'DROP' }
  | { type: 'CANCEL' };

export function paletteReducer(state: PaletteState, event: PaletteEvent): PaletteState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'DRAG_START') return 'dragging';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      if (event.type === 'DRAG_START') return 'dragging';
      return state;
    case 'dragging':
      if (event.type === 'DROP') return 'idle';
      if (event.type === 'CANCEL') return 'idle';
      return state;
    default:
      return state;
  }
}
