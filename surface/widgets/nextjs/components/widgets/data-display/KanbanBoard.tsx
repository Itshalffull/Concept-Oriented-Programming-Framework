'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type KeyboardEvent,
  type DragEvent,
} from 'react';
import { kanbanBoardReducer, kanbanBoardInitialState } from './KanbanBoard.reducer.js';

// Props from kanban-board.widget spec
export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

export interface KanbanItem {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  draggable?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string, toIndex: number) => void;
  onCardActivate?: (cardId: string) => void;
  onAddCard?: (columnId: string) => void;
  renderCard?: (item: KanbanItem, columnId: string) => ReactNode;
  className?: string;
  children?: ReactNode;
}

export const KanbanBoard = forwardRef<HTMLDivElement, KanbanBoardProps>(
  function KanbanBoard(
    {
      columns,
      draggable = true,
      ariaLabel = 'Kanban board',
      size = 'md',
      onCardMove,
      onCardActivate,
      onAddCard,
      renderCard,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(kanbanBoardReducer, kanbanBoardInitialState);
    const baseId = useId();

    const boardState = (() => {
      switch (state.current) {
        case 'dragging':
          return 'dragging';
        case 'draggingBetween':
          return 'dragging-between';
        default:
          return 'idle';
      }
    })();

    const handleDragStart = useCallback(
      (e: DragEvent<HTMLDivElement>, cardId: string, columnId: string) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardId);
        dispatch({ type: 'DRAG_START', cardId, columnId });
      },
      [draggable]
    );

    const handleDragEnter = useCallback(
      (e: DragEvent<HTMLDivElement>, columnId: string) => {
        if (!draggable) return;
        e.preventDefault();
        dispatch({ type: 'DRAG_ENTER_COLUMN', columnId });
      },
      [draggable]
    );

    const handleDragOver = useCallback(
      (e: DragEvent<HTMLDivElement>) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      [draggable]
    );

    const handleDrop = useCallback(
      (e: DragEvent<HTMLDivElement>, targetColumnId: string) => {
        if (!draggable) return;
        e.preventDefault();
        const cardId = state.draggedCardId;
        const sourceColumn = state.dragSourceColumn;
        dispatch({ type: 'DROP' });
        if (cardId && sourceColumn) {
          onCardMove?.(cardId, sourceColumn, targetColumnId, 0);
        }
      },
      [draggable, state.draggedCardId, state.dragSourceColumn, onCardMove]
    );

    const handleCardKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, cardId: string, columnId: string) => {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            onCardActivate?.(cardId);
            break;
          case ' ':
            if (draggable) {
              e.preventDefault();
              if (state.current === 'dragging' || state.current === 'draggingBetween') {
                dispatch({ type: 'DROP' });
              } else {
                dispatch({ type: 'DRAG_START', cardId, columnId });
              }
            }
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'DRAG_CANCEL' });
            break;
        }
      },
      [draggable, state.current, onCardActivate]
    );

    return (
      <div
        ref={ref}
        className={className}
        role="grid"
        aria-label={ariaLabel}
        aria-roledescription="kanban board"
        data-surface-widget=""
        data-widget-name="kanban-board"
        data-part="root"
        data-state={boardState}
        data-draggable={draggable ? 'true' : 'false'}
        data-size={size}
      >
        {columns.map((column) => {
          const titleId = `${baseId}-col-${column.id}`;
          const isDropTarget = state.dropTargetColumn === column.id;

          return (
            <div
              key={column.id}
              role="row"
              aria-label={column.title}
              data-column-id={column.id}
              data-state={isDropTarget ? 'drop-target' : 'idle'}
              onDragEnter={(e) => handleDragEnter(e, column.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div data-part="column-header">
                <span id={titleId} data-part="column-title">
                  {column.title}
                </span>
                <span
                  data-part="column-count"
                  aria-label={`${column.items.length} items`}
                >
                  {column.items.length}
                </span>
              </div>
              <div
                role="gridcell"
                aria-label={`${column.title} cards`}
                data-part="card-list"
                data-droppable={draggable ? 'true' : 'false'}
              >
                {column.items.map((item) => {
                  const isDragged = state.draggedCardId === item.id;
                  return (
                    <div
                      key={item.id}
                      aria-roledescription="card"
                      aria-grabbed={isDragged ? 'true' : 'false'}
                      draggable={draggable ? 'true' : 'false'}
                      tabIndex={-1}
                      data-state={isDragged ? 'dragging' : 'idle'}
                      onDragStart={(e) => handleDragStart(e, item.id, column.id)}
                      onDragEnd={() => dispatch({ type: 'DROP' })}
                      onKeyDown={(e) => handleCardKeyDown(e, item.id, column.id)}
                      onFocus={() => dispatch({ type: 'FOCUS_CARD' })}
                      onBlur={() => dispatch({ type: 'BLUR' })}
                    >
                      {renderCard ? renderCard(item, column.id) : item.title}
                    </div>
                  );
                })}
                {isDropTarget && state.current === 'draggingBetween' && (
                  <div
                    data-part="drag-placeholder"
                    data-visible="true"
                    aria-hidden="true"
                  />
                )}
              </div>
              {onAddCard && (
                <button
                  type="button"
                  role="button"
                  aria-label={`Add card to ${column.title}`}
                  data-part="add-card"
                  tabIndex={0}
                  onClick={() => onAddCard(column.id)}
                >
                  + Add card
                </button>
              )}
            </div>
          );
        })}
        {children}
      </div>
    );
  }
);

KanbanBoard.displayName = 'KanbanBoard';
export default KanbanBoard;
