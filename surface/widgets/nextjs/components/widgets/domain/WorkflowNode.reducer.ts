/* ---------------------------------------------------------------------------
 * WorkflowNode state machine
 * Interaction: idle (initial), hovered, selected, configuring, dragging
 * ------------------------------------------------------------------------- */

export type WFNodeInteraction = 'idle' | 'hovered' | 'selected' | 'configuring' | 'dragging';

export type WFNodeEvent =
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'CONFIGURE' }
  | { type: 'CLOSE_CONFIG' }
  | { type: 'SAVE_CONFIG' }
  | { type: 'DRAG_START' }
  | { type: 'DROP' }
  | { type: 'DELETE' }
  | { type: 'ESCAPE' };

export function wfNodeReducer(state: WFNodeInteraction, event: WFNodeEvent): WFNodeInteraction {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'HOVER') return 'hovered';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CONFIGURE') return 'configuring';
      if (event.type === 'DELETE') return 'idle';
      if (event.type === 'DRAG_START') return 'dragging';
      return state;
    case 'configuring':
      if (event.type === 'CLOSE_CONFIG') return 'selected';
      if (event.type === 'SAVE_CONFIG') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      return state;
    case 'dragging':
      if (event.type === 'DROP') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      return state;
    default:
      return state;
  }
}
