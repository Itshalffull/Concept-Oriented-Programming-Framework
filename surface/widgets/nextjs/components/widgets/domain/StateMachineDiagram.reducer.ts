/* ---------------------------------------------------------------------------
 * StateMachineDiagram state machine
 * States: viewing (initial), addingState, editingState, addingTransition,
 *         editingTransition, confirmingDeleteState, confirmingDeleteTransition
 * ------------------------------------------------------------------------- */

export type SMDState =
  | 'viewing' | 'addingState' | 'editingState' | 'addingTransition'
  | 'editingTransition' | 'confirmingDeleteState' | 'confirmingDeleteTransition';

export type SMDEvent =
  | { type: 'ADD_STATE' }
  | { type: 'ADD_TRANSITION' }
  | { type: 'EDIT_STATE'; name: string }
  | { type: 'EDIT_TRANSITION'; id: string }
  | { type: 'DELETE_STATE'; name: string }
  | { type: 'DELETE_TRANSITION'; id: string }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' }
  | { type: 'ESCAPE' };

export function smdReducer(state: SMDState, event: SMDEvent): SMDState {
  switch (state) {
    case 'viewing':
      if (event.type === 'ADD_STATE') return 'addingState';
      if (event.type === 'ADD_TRANSITION') return 'addingTransition';
      if (event.type === 'EDIT_STATE') return 'editingState';
      if (event.type === 'EDIT_TRANSITION') return 'editingTransition';
      if (event.type === 'DELETE_STATE') return 'confirmingDeleteState';
      if (event.type === 'DELETE_TRANSITION') return 'confirmingDeleteTransition';
      return state;
    case 'addingState':
    case 'editingState':
    case 'addingTransition':
    case 'editingTransition':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      if (event.type === 'ESCAPE') return 'viewing';
      return state;
    case 'confirmingDeleteState':
    case 'confirmingDeleteTransition':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      if (event.type === 'ESCAPE') return 'viewing';
      return state;
    default:
      return state;
  }
}
