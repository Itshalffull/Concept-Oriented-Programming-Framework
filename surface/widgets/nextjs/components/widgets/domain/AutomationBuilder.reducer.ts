/* ---------------------------------------------------------------------------
 * AutomationBuilder state machine
 * States: idle (initial), stepSelected, configuring, addingStep, reordering,
 *         testingStep, testing
 * ------------------------------------------------------------------------- */

export type ABState = 'idle' | 'stepSelected' | 'configuring' | 'addingStep' | 'reordering' | 'testingStep' | 'testing';
export type ABEvent =
  | { type: 'SELECT_STEP'; index: number }
  | { type: 'DESELECT' }
  | { type: 'CONFIGURE' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'ESCAPE' }
  | { type: 'ADD_STEP' }
  | { type: 'SELECT_TYPE' }
  | { type: 'DELETE' }
  | { type: 'REORDER' }
  | { type: 'DROP' }
  | { type: 'TEST_STEP' }
  | { type: 'TEST_ALL' }
  | { type: 'TEST_COMPLETE' }
  | { type: 'TEST_ERROR' };

export function abReducer(state: ABState, event: ABEvent): ABState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_STEP') return 'stepSelected';
      if (event.type === 'ADD_STEP') return 'addingStep';
      if (event.type === 'TEST_ALL') return 'testing';
      return state;
    case 'stepSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CONFIGURE') return 'configuring';
      if (event.type === 'DELETE') return 'idle';
      if (event.type === 'REORDER') return 'reordering';
      if (event.type === 'TEST_STEP') return 'testingStep';
      return state;
    case 'configuring':
      if (event.type === 'SAVE') return 'stepSelected';
      if (event.type === 'CANCEL') return 'stepSelected';
      if (event.type === 'ESCAPE') return 'stepSelected';
      return state;
    case 'addingStep':
      if (event.type === 'SELECT_TYPE') return 'configuring';
      if (event.type === 'CANCEL') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'reordering':
      if (event.type === 'DROP') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'testingStep':
      if (event.type === 'TEST_COMPLETE') return 'stepSelected';
      if (event.type === 'TEST_ERROR') return 'stepSelected';
      if (event.type === 'CANCEL') return 'stepSelected';
      return state;
    case 'testing':
      if (event.type === 'TEST_COMPLETE') return 'idle';
      if (event.type === 'TEST_ERROR') return 'idle';
      if (event.type === 'CANCEL') return 'idle';
      return state;
    default:
      return state;
  }
}
