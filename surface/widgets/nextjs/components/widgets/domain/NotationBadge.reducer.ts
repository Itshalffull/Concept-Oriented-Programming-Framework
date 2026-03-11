/* ---------------------------------------------------------------------------
 * NotationBadge state machine
 * States: active (initial), hovered, selecting, none
 * ------------------------------------------------------------------------- */

export type BadgeState = 'active' | 'hovered' | 'selecting' | 'none';
export type BadgeEvent =
  | { type: 'CLICK' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'SELECT' }
  | { type: 'CANCEL' };

export function badgeReducer(state: BadgeState, event: BadgeEvent): BadgeState {
  switch (state) {
    case 'active':
      if (event.type === 'CLICK') return 'selecting';
      if (event.type === 'HOVER') return 'hovered';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'active';
      if (event.type === 'CLICK') return 'selecting';
      return state;
    case 'selecting':
      if (event.type === 'SELECT') return 'active';
      if (event.type === 'CANCEL') return 'active';
      return state;
    case 'none':
      if (event.type === 'CLICK') return 'selecting';
      return state;
    default:
      return state;
  }
}
