/* ---------------------------------------------------------------------------
 * ColorLabelPicker state machine
 * States: closed (initial), open, empty
 * ------------------------------------------------------------------------- */

export type PickerState = 'closed' | 'open' | 'empty';
export type PickerEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'ESCAPE' }
  | { type: 'BLUR' }
  | { type: 'SELECT'; name: string }
  | { type: 'DESELECT'; name: string }
  | { type: 'FILTER'; value: string }
  | { type: 'FILTER_EMPTY' }
  | { type: 'CREATE'; name: string };

export function pickerReducer(state: PickerState, event: PickerEvent): PickerState {
  switch (state) {
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    case 'open':
      if (event.type === 'CLOSE') return 'closed';
      if (event.type === 'ESCAPE') return 'closed';
      if (event.type === 'BLUR') return 'closed';
      if (event.type === 'SELECT') return 'open';
      if (event.type === 'DESELECT') return 'open';
      if (event.type === 'FILTER_EMPTY') return 'empty';
      return state;
    case 'empty':
      if (event.type === 'FILTER') return 'open';
      if (event.type === 'CREATE') return 'open';
      if (event.type === 'ESCAPE') return 'closed';
      if (event.type === 'BLUR') return 'closed';
      return state;
    default:
      return state;
  }
}
