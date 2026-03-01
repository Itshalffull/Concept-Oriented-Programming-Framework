/* ---------------------------------------------------------------------------
 * BlockEditor state machine
 * States: editing (initial), idle, slashMenuOpen, selectionActive, dragging
 * ------------------------------------------------------------------------- */

export type BlockEditorState = 'editing' | 'idle' | 'slashMenuOpen' | 'selectionActive' | 'dragging';
export type BlockEditorEvent =
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SLASH' }
  | { type: 'SELECT_TEXT' }
  | { type: 'DESELECT' }
  | { type: 'SELECT_BLOCK_TYPE' }
  | { type: 'FORMAT' }
  | { type: 'DRAG_START' }
  | { type: 'DROP' }
  | { type: 'ESCAPE' };

export function blockEditorReducer(state: BlockEditorState, event: BlockEditorEvent): BlockEditorState {
  switch (state) {
    case 'editing':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'SLASH') return 'slashMenuOpen';
      if (event.type === 'SELECT_TEXT') return 'selectionActive';
      if (event.type === 'DRAG_START') return 'dragging';
      return state;
    case 'idle':
      if (event.type === 'FOCUS') return 'editing';
      return state;
    case 'slashMenuOpen':
      if (event.type === 'SELECT_BLOCK_TYPE') return 'editing';
      if (event.type === 'ESCAPE') return 'editing';
      if (event.type === 'BLUR') return 'idle';
      return state;
    case 'selectionActive':
      if (event.type === 'DESELECT') return 'editing';
      if (event.type === 'FORMAT') return 'selectionActive';
      if (event.type === 'ESCAPE') return 'editing';
      return state;
    case 'dragging':
      if (event.type === 'DROP') return 'editing';
      if (event.type === 'ESCAPE') return 'editing';
      return state;
    default:
      return state;
  }
}
