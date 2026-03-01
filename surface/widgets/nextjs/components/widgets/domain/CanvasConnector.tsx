'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type KeyboardEvent,
  type SVGAttributes,
} from 'react';

import { connectorReducer } from './CanvasConnector.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CanvasConnectorProps extends Omit<SVGAttributes<SVGGElement>, 'id'> {
  /** Connector ID. */
  id: string;
  /** Source node ID. */
  startNodeId: string;
  /** Target node ID. */
  endNodeId: string;
  /** Source node label. */
  startNodeLabel?: string;
  /** Target node label. */
  endNodeLabel?: string;
  /** Source port. */
  startPort?: string;
  /** Target port. */
  endPort?: string;
  /** Connector label. */
  label?: string;
  /** Line style. */
  lineStyle?: 'straight' | 'curved' | 'step';
  /** Arrow at start. */
  arrowStart?: boolean;
  /** Arrow at end. */
  arrowEnd?: boolean;
  /** Stroke color. */
  color?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Dashed line. */
  dashed?: boolean;
  /** Start coordinates. */
  startPos?: { x: number; y: number };
  /** End coordinates. */
  endPos?: { x: number; y: number };
  /** Called on select. */
  onSelect?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on label change. */
  onLabelChange?: (id: string, value: string) => void;
}

/* ---------------------------------------------------------------------------
 * Path helpers
 * ------------------------------------------------------------------------- */

function computePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  style: 'straight' | 'curved' | 'step',
): string {
  if (style === 'straight') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  if (style === 'step') {
    const midX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
  // curved
  const dx = end.x - start.x;
  return `M ${start.x} ${start.y} C ${start.x + dx * 0.5} ${start.y}, ${end.x - dx * 0.5} ${end.y}, ${end.x} ${end.y}`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const CanvasConnector = forwardRef<SVGGElement, CanvasConnectorProps>(function CanvasConnector(
  {
    id,
    startNodeId,
    endNodeId,
    startNodeLabel = '',
    endNodeLabel = '',
    startPort,
    endPort,
    label,
    lineStyle = 'curved',
    arrowStart = false,
    arrowEnd = true,
    color = '#000000',
    strokeWidth = 2,
    dashed = false,
    startPos = { x: 0, y: 0 },
    endPos = { x: 100, y: 100 },
    onSelect,
    onDelete,
    onLabelChange,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(connectorReducer, 'idle');

  const ariaLabel = `Connection from ${startNodeLabel} to ${endNodeLabel}${label ? `: ${label}` : ''}`;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); send({ type: 'EDIT_LABEL' }); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); send({ type: 'DELETE' }); onDelete?.(id); }
      if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
    },
    [id, onDelete],
  );

  const d = computePath(startPos, endPos, lineStyle);
  const midX = (startPos.x + endPos.x) / 2;
  const midY = (startPos.y + endPos.y) / 2;
  const showHandles = state === 'selected' || state === 'hovered';

  return (
    <g
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      aria-roledescription="connector"
      aria-selected={state === 'selected' || undefined}
      data-surface-widget=""
      data-widget-name="canvas-connector"
      data-part="connector"
      data-id={id}
      data-state={state}
      data-start-node={startNodeId}
      data-end-node={endNodeId}
      data-line-style={lineStyle}
      tabIndex={0}
      onClick={() => { send({ type: 'SELECT' }); onSelect?.(id); }}
      onDoubleClick={() => send({ type: 'EDIT_LABEL' })}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <path
        data-part="path"
        data-line-style={lineStyle}
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? '8 4' : undefined}
        fill="none"
        markerStart={arrowStart ? 'url(#arrowhead-start)' : undefined}
        markerEnd={arrowEnd ? 'url(#arrowhead-end)' : undefined}
        aria-hidden="true"
      />

      {showHandles && (
        <>
          <circle
            data-part="start-handle"
            data-visible="true"
            cx={startPos.x}
            cy={startPos.y}
            r={5}
            aria-label={`Start handle, connected to ${startNodeLabel}`}
            aria-grabbed={state === 'draggingStart' || undefined}
            onPointerDown={() => send({ type: 'DRAG_START_HANDLE' })}
            onPointerUp={() => send({ type: 'DROP' })}
          />
          <circle
            data-part="end-handle"
            data-visible="true"
            cx={endPos.x}
            cy={endPos.y}
            r={5}
            aria-label={`End handle, connected to ${endNodeLabel}`}
            aria-grabbed={state === 'draggingEnd' || undefined}
            onPointerDown={() => send({ type: 'DRAG_END_HANDLE' })}
            onPointerUp={() => send({ type: 'DROP' })}
          />
        </>
      )}

      {label && (
        <foreignObject
          x={midX - 40}
          y={midY - 10}
          width={80}
          height={20}
          data-part="label"
          data-visible="true"
          style={{ transform: `translate(${midX}px, ${midY}px)` }}
        >
          <span
            contentEditable={state === 'editingLabel'}
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
        </foreignObject>
      )}
    </g>
  );
});

CanvasConnector.displayName = 'CanvasConnector';
export { CanvasConnector };
export default CanvasConnector;
