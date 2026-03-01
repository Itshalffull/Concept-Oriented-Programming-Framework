/* ---------------------------------------------------------------------------
 * WorkflowEditor state machine
 * States: idle (initial), nodeSelected, configuring, placing, draggingNew,
 *         executing, executionResult
 * ------------------------------------------------------------------------- */

export type WorkflowEditorState =
  | 'idle' | 'nodeSelected' | 'configuring' | 'placing'
  | 'draggingNew' | 'executing' | 'executionResult';

export type WorkflowEditorEvent =
  | { type: 'SELECT_NODE' }
  | { type: 'DESELECT' }
  | { type: 'CONFIGURE' }
  | { type: 'CLOSE_CONFIG' }
  | { type: 'SAVE_CONFIG' }
  | { type: 'ADD_NODE' }
  | { type: 'PLACE' }
  | { type: 'DRAG_PALETTE_NODE' }
  | { type: 'DROP_ON_CANVAS' }
  | { type: 'EXECUTE' }
  | { type: 'CANCEL' }
  | { type: 'EXECUTION_COMPLETE' }
  | { type: 'EXECUTION_ERROR' }
  | { type: 'DISMISS' }
  | { type: 'DELETE' }
  | { type: 'ESCAPE' };

export function workflowEditorReducer(state: WorkflowEditorState, event: WorkflowEditorEvent): WorkflowEditorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      if (event.type === 'ADD_NODE') return 'placing';
      if (event.type === 'EXECUTE') return 'executing';
      if (event.type === 'DRAG_PALETTE_NODE') return 'draggingNew';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CONFIGURE') return 'configuring';
      if (event.type === 'DELETE') return 'idle';
      if (event.type === 'EXECUTE') return 'executing';
      return state;
    case 'configuring':
      if (event.type === 'CLOSE_CONFIG') return 'nodeSelected';
      if (event.type === 'SAVE_CONFIG') return 'nodeSelected';
      if (event.type === 'ESCAPE') return 'nodeSelected';
      return state;
    case 'placing':
      if (event.type === 'PLACE') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'draggingNew':
      if (event.type === 'DROP_ON_CANVAS') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'executing':
      if (event.type === 'EXECUTION_COMPLETE') return 'executionResult';
      if (event.type === 'EXECUTION_ERROR') return 'executionResult';
      if (event.type === 'CANCEL') return 'idle';
      return state;
    case 'executionResult':
      if (event.type === 'DISMISS') return 'idle';
      if (event.type === 'SELECT_NODE') return 'nodeSelected';
      return state;
    default:
      return state;
  }
}
