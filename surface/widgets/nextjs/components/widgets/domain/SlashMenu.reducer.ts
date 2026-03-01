/* ---------------------------------------------------------------------------
 * SlashMenu state machine
 * States: closed (initial), open, empty
 * ------------------------------------------------------------------------- */

export type SlashMenuState = 'closed' | 'open' | 'empty';
export type SlashMenuEvent =
  | { type: 'OPEN' }
  | { type: 'SELECT' }
  | { type: 'ESCAPE' }
  | { type: 'BLUR' }
  | { type: 'FILTER_EMPTY' }
  | { type: 'INPUT' };

export function slashMenuReducer(state: SlashMenuState, event: SlashMenuEvent): SlashMenuState {
  switch (state) {
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    case 'open':
      if (event.type === 'SELECT') return 'closed';
      if (event.type === 'ESCAPE') return 'closed';
      if (event.type === 'BLUR') return 'closed';
      if (event.type === 'FILTER_EMPTY') return 'empty';
      return state;
    case 'empty':
      if (event.type === 'INPUT') return 'open';
      if (event.type === 'ESCAPE') return 'closed';
      if (event.type === 'BLUR') return 'closed';
      return state;
    default:
      return state;
  }
}
