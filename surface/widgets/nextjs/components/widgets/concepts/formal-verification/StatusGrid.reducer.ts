export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL' }
  | { type: 'CLICK_CELL' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' };

export function statusGridReducer(state: StatusGridState, event: StatusGridEvent): StatusGridState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_CELL') return 'cellHovered';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'cellHovered':
      if (event.type === 'LEAVE_CELL') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}
