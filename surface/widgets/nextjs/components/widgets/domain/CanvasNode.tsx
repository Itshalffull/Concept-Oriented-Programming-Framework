'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { canvasNodeReducer } from './CanvasNode.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CanvasNodeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'children'> {
  /** Node ID. */
  id: string;
  /** Node type. */
  type?: 'sticky' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'frame';
  /** Position on canvas. */
  position?: { x: number; y: number };
  /** Node dimensions. */
  size?: { width: number; height: number };
  /** Optional text label. */
  label?: string;
  /** Fill color. */
  color?: string;
  /** Border color. */
  borderColor?: string;
  /** Border width. */
  borderWidth?: number;
  /** Rotation in degrees. */
  rotation?: number;
  /** Lock interactions. */
  locked?: boolean;
  /** Visibility. */
  visible?: boolean;
  /** Opacity. */
  opacity?: number;
  /** Z-index. */
  zIndex?: number;
  /** Called on selection. */
  onSelect?: (id: string) => void;
  /** Called on edit. */
  onEdit?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on label change. */
  onLabelChange?: (id: string, value: string) => void;
  /** Called on drag. */
  onDragStart?: (id: string) => void;
  /** Resize handles slot. */
  handles?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const HANDLE_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

const CanvasNode = forwardRef<HTMLDivElement, CanvasNodeProps>(function CanvasNode(
  {
    id,
    type = 'rectangle',
    position = { x: 0, y: 0 },
    size = { width: 200, height: 200 },
    label,
    color = '#ffffff',
    borderColor = '#000000',
    borderWidth = 1,
    rotation = 0,
    locked = false,
    visible = true,
    opacity = 1,
    zIndex = 0,
    onSelect,
    onEdit,
    onDelete,
    onLabelChange,
    onDragStart,
    handles,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(canvasNodeReducer, 'idle');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); send({ type: 'EDIT' }); onEdit?.(id); }
      if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!locked) { e.preventDefault(); send({ type: 'DELETE' }); onDelete?.(id); }
      }
    },
    [id, locked, onEdit, onDelete],
  );

  const isSelected = state === 'selected' || state === 'editing';
  const showHandles = state === 'selected' || state === 'resizing';

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${type} node${label ? `: ${label}` : ''}`}
      aria-roledescription="canvas node"
      aria-grabbed={state === 'dragging' || undefined}
      aria-selected={isSelected || undefined}
      data-surface-widget=""
      data-widget-name="canvas-node"
      data-type={type}
      data-state={state}
      data-id={id}
      data-locked={locked ? 'true' : 'false'}
      data-visible="true"
      tabIndex={0}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        opacity,
        zIndex,
      }}
      onClick={() => { send({ type: 'SELECT' }); onSelect?.(id); }}
      onDoubleClick={() => { send({ type: 'EDIT' }); onEdit?.(id); }}
      onPointerDown={() => { if (!locked) { send({ type: 'DRAG_START' }); onDragStart?.(id); } }}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <div
        data-part="content"
        data-type={type}
        style={{
          backgroundColor: color,
          borderColor,
          borderWidth: `${borderWidth}px`,
          borderStyle: 'solid',
        }}
      >
        {children}
      </div>

      {showHandles && (
        <div
          data-part="handles"
          data-visible="true"
          aria-hidden={!showHandles || undefined}
        >
          {handles ?? HANDLE_POSITIONS.map((pos) => (
            <div
              key={pos}
              data-part="handle"
              data-position={pos}
              onPointerDown={(e) => { e.stopPropagation(); send({ type: 'RESIZE_START' }); }}
              onPointerUp={() => send({ type: 'RESIZE_END' })}
            />
          ))}
        </div>
      )}

      {label !== undefined && (
        <span
          data-part="label"
          data-visible="true"
          contentEditable={state === 'editing' && !locked}
          suppressContentEditableWarning
          onInput={(e) => onLabelChange?.(id, (e.target as HTMLElement).textContent ?? '')}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); send({ type: 'CONFIRM' }); }
            if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
});

CanvasNode.displayName = 'CanvasNode';
export { CanvasNode };
export default CanvasNode;
