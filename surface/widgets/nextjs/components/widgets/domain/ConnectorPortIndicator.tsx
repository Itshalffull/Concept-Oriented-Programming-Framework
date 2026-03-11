'use client';

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

import { portReducer } from './ConnectorPortIndicator.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ConnectorPortIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  /** Port identifier. */
  portId: string;
  /** Port direction. */
  direction: 'in' | 'out' | 'bidirectional';
  /** Optional port type label. */
  portType?: string;
  /** Optional display label. */
  label?: string;
  /** Side of the node. */
  side: 'top' | 'right' | 'bottom' | 'left' | 'center';
  /** Offset along the side (0-1). */
  offset?: number;
  /** Current number of connections. */
  connectionCount?: number;
  /** Maximum allowed connections. */
  maxConnections?: number;
  /** Called when a connection starts from this port. */
  onConnectStart?: (portId: string) => void;
  /** Called when a connection ends at this port. */
  onConnectEnd?: (portId: string) => void;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const DIRECTION_COLORS: Record<string, string> = {
  in: '#2196F3',
  out: '#FF9800',
  bidirectional: '#4CAF50',
};

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ConnectorPortIndicator = forwardRef<HTMLDivElement, ConnectorPortIndicatorProps>(
  function ConnectorPortIndicator(
    {
      portId,
      direction,
      portType,
      label,
      side,
      offset = 0.5,
      connectionCount = 0,
      maxConnections,
      onConnectStart,
      onConnectEnd,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(portReducer, 'idle');

    const isFull = maxConnections != null && connectionCount >= maxConnections;

    const ariaLabel = useMemo(() => {
      const parts = [direction, 'port'];
      if (label) parts.push(`: ${label}`);
      const countStr = maxConnections != null
        ? `${connectionCount}/${maxConnections}`
        : `${connectionCount}`;
      parts.push(` (${countStr} connections)`);
      return parts.join('');
    }, [direction, label, connectionCount, maxConnections]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          send({ type: 'CONNECT_START' });
          onConnectStart?.(portId);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          send({ type: 'CANCEL' });
        }
      },
      [portId, onConnectStart],
    );

    return (
      <div
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        data-surface-widget=""
        data-widget-name="connector-port-indicator"
        data-part="port"
        data-port-id={portId}
        data-direction={direction}
        data-side={side}
        data-state={isFull ? 'full' : state}
        tabIndex={0}
        onPointerEnter={() => send({ type: 'HOVER' })}
        onPointerLeave={() => send({ type: 'UNHOVER' })}
        onPointerDown={() => {
          if (!isFull) {
            send({ type: 'CONNECT_START' });
            onConnectStart?.(portId);
          }
        }}
        onPointerUp={() => {
          send({ type: 'CONNECT_END' });
          onConnectEnd?.(portId);
        }}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div
          data-part="port-dot"
          aria-hidden="true"
          style={{ background: DIRECTION_COLORS[direction] }}
        />

        {(state === 'hovered' || label) && (
          <span data-part="port-label">{label ?? portType ?? direction}</span>
        )}

        {connectionCount > 0 && (
          <span
            data-part="connection-badge"
            data-visible="true"
          >
            {maxConnections != null ? `${connectionCount}/${maxConnections}` : connectionCount}
          </span>
        )}
      </div>
    );
  },
);

ConnectorPortIndicator.displayName = 'ConnectorPortIndicator';
export { ConnectorPortIndicator };
export default ConnectorPortIndicator;
