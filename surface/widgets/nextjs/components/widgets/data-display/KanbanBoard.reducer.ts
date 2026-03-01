export type KanbanBoardState = {
  current: 'idle' | 'dragging' | 'draggingBetween' | 'columnFocused' | 'cardFocused';
  draggedCardId: string | null;
  dragSourceColumn: string | null;
  dropTargetColumn: string | null;
};

export type KanbanBoardAction =
  | { type: 'DRAG_START'; cardId: string; columnId: string }
  | { type: 'DRAG_ENTER_COLUMN'; columnId: string }
  | { type: 'DROP' }
  | { type: 'DRAG_CANCEL' }
  | { type: 'FOCUS_COLUMN' }
  | { type: 'FOCUS_CARD' }
  | { type: 'BLUR' };

export function kanbanBoardReducer(state: KanbanBoardState, action: KanbanBoardAction): KanbanBoardState {
  switch (action.type) {
    case 'DRAG_START':
      return {
        ...state,
        current: 'dragging',
        draggedCardId: action.cardId,
        dragSourceColumn: action.columnId,
      };
    case 'DRAG_ENTER_COLUMN':
      return {
        ...state,
        current: 'draggingBetween',
        dropTargetColumn: action.columnId,
      };
    case 'DROP':
      return {
        ...state,
        current: 'idle',
        draggedCardId: null,
        dragSourceColumn: null,
        dropTargetColumn: null,
      };
    case 'DRAG_CANCEL':
      return {
        ...state,
        current: 'idle',
        draggedCardId: null,
        dragSourceColumn: null,
        dropTargetColumn: null,
      };
    case 'FOCUS_COLUMN':
      return { ...state, current: 'columnFocused' };
    case 'FOCUS_CARD':
      return { ...state, current: 'cardFocused' };
    case 'BLUR':
      return { ...state, current: 'idle' };
    default:
      return state;
  }
}

export const kanbanBoardInitialState: KanbanBoardState = {
  current: 'idle',
  draggedCardId: null,
  dragSourceColumn: null,
  dropTargetColumn: null,
};
