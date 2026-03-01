/* ---------------------------------------------------------------------------
 * State machine
 * Interaction states: idle (initial), hovering, focused
 * Events: HOVER, HOVER_OUT, FOCUS, BLUR, CLICK
 * ------------------------------------------------------------------------- */

export type InteractionState = 'idle' | 'hovering' | 'focused';

export type RatingEvent =
  | { type: 'HOVER'; previewValue: number }
  | { type: 'HOVER_OUT' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'CLICK' };

export interface RatingMachine {
  interaction: InteractionState;
  previewValue: number;
}

export function ratingReducer(state: RatingMachine, event: RatingEvent): RatingMachine {
  switch (state.interaction) {
    case 'idle':
      if (event.type === 'HOVER') return { interaction: 'hovering', previewValue: event.previewValue };
      if (event.type === 'FOCUS') return { ...state, interaction: 'focused' };
      return state;
    case 'hovering':
      if (event.type === 'HOVER') return { ...state, previewValue: event.previewValue };
      if (event.type === 'HOVER_OUT') return { interaction: 'idle', previewValue: 0 };
      if (event.type === 'CLICK') return { interaction: 'idle', previewValue: 0 };
      return state;
    case 'focused':
      if (event.type === 'BLUR') return { interaction: 'idle', previewValue: 0 };
      if (event.type === 'HOVER') return { interaction: 'hovering', previewValue: event.previewValue };
      return state;
    default:
      return state;
  }
}
