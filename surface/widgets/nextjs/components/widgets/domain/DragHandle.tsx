'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { dragHandleReducer } from './DragHandle.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface DragHandleProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Drag orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Whether the handle is disabled. */
  disabled?: boolean;
  /** Accessible label for the drag handle. */
  ariaLabel?: string;
  /** Index of the draggable item. */
  itemIndex?: number;
  /** Icon content for the grip. */
  icon?: ReactNode;
  /** Callback when a move event occurs. */
  onMove?: (direction: string) => void;
  /** Callback when drag starts. */
  onDragBegin?: () => void;
  /** Callback when drag ends. */
  onDragFinish?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(function DragHandle(
  {
    orientation = 'vertical',
    disabled = false,
    ariaLabel = 'Drag to reorder',
    itemIndex,
    icon,
    onMove,
    onDragBegin,
    onDragFinish,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(dragHandleReducer, 'idle');

  const isGrabbed = state === 'grabbed' || state === 'dragging';

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      send({ type: 'GRAB' });
      onDragBegin?.();
      rest.onPointerDown?.(e);
    },
    [disabled, onDragBegin, rest],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (state === 'dragging') {
        send({ type: 'DROP' });
        onDragFinish?.();
      } else {
        send({ type: 'RELEASE' });
      }
      rest.onPointerUp?.(e);
    },
    [state, onDragFinish, rest],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (state === 'grabbed') {
        send({ type: 'MOVE' });
      }
      rest.onPointerMove?.(e);
    },
    [state, rest],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (state === 'idle' || state === 'focused') {
          send({ type: 'GRAB' });
          onDragBegin?.();
        } else {
          send({ type: 'RELEASE' });
          onDragFinish?.();
        }
      }
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
        onDragFinish?.();
      }
      if (isGrabbed) {
        if (e.key === 'ArrowUp') { e.preventDefault(); onMove?.('up'); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onMove?.('down'); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onMove?.('left'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onMove?.('right'); }
      }
      rest.onKeyDown?.(e);
    },
    [disabled, state, isGrabbed, onDragBegin, onDragFinish, onMove, rest],
  );

  return (
    <button
      ref={ref}
      type="button"
      role="button"
      aria-label={ariaLabel}
      aria-roledescription="drag handle"
      aria-grabbed={isGrabbed}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      draggable={!disabled}
      data-surface-widget=""
      data-widget-name="drag-handle"
      data-part="drag-handle"
      data-state={state}
      data-orientation={orientation}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onFocus={() => send({ type: 'FOCUS' })}
      onBlur={() => send({ type: 'BLUR' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <span data-part="icon" data-orientation={orientation} aria-hidden="true">
        {icon ?? '⠿'}
      </span>
    </button>
  );
});

DragHandle.displayName = 'DragHandle';
export { DragHandle };
export default DragHandle;
