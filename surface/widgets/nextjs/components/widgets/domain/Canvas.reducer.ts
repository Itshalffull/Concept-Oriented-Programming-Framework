/* ---------------------------------------------------------------------------
 * Canvas state machine
 * Tracks current tool + interaction
 * ------------------------------------------------------------------------- */

export type CanvasTool = 'select' | 'hand' | 'draw' | 'erase' | 'text' | 'shape' | 'connector' | 'frame';

export interface CanvasState {
  tool: CanvasTool;
  interaction: 'idle' | 'panning' | 'drawing' | 'erasing' | 'nodeSelected' | 'movingNode' | 'marquee';
}

export type CanvasEvent =
  | { type: 'SWITCH_TOOL'; tool: CanvasTool }
  | { type: 'CLICK_NODE' }
  | { type: 'CLICK_EMPTY' }
  | { type: 'DRAG_NODE' }
  | { type: 'DRAG_EMPTY' }
  | { type: 'PAN_START' }
  | { type: 'PAN_END' }
  | { type: 'DRAW_START' }
  | { type: 'DRAW_END' }
  | { type: 'DROP' }
  | { type: 'ESCAPE' }
  | { type: 'DELETE' };

export function canvasReducer(state: CanvasState, event: CanvasEvent): CanvasState {
  switch (event.type) {
    case 'SWITCH_TOOL':
      return { tool: event.tool, interaction: 'idle' };
    case 'CLICK_NODE':
      return { ...state, interaction: 'nodeSelected' };
    case 'CLICK_EMPTY':
      return { ...state, interaction: 'idle' };
    case 'DRAG_NODE':
      return { ...state, interaction: 'movingNode' };
    case 'DRAG_EMPTY':
      return { ...state, interaction: state.tool === 'select' ? 'marquee' : 'idle' };
    case 'PAN_START':
      return { ...state, interaction: 'panning' };
    case 'PAN_END':
    case 'DRAW_END':
    case 'DROP':
      return { ...state, interaction: 'idle' };
    case 'DRAW_START':
      return { ...state, interaction: 'drawing' };
    case 'ESCAPE':
    case 'DELETE':
      return { ...state, interaction: 'idle' };
    default:
      return state;
  }
}
