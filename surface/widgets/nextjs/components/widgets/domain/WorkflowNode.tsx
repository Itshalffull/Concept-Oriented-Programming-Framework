'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { wfNodeReducer } from './WorkflowNode.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PortDef {
  name: string;
  type: string;
  required?: boolean;
  connected?: boolean;
}

export interface WorkflowNodeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'title' | 'children'> {
  /** Node ID. */
  id: string;
  /** Node display title. */
  title: string;
  /** Node type identifier. */
  nodeType: string;
  /** Icon element. */
  icon?: ReactNode;
  /** Input port definitions. */
  inputPortDefs?: PortDef[];
  /** Output port definitions. */
  outputPortDefs?: PortDef[];
  /** Execution status. */
  executionStatus?: 'pending' | 'running' | 'success' | 'error';
  /** Position on canvas. */
  position?: { x: number; y: number };
  /** Config summary text. */
  configSummary?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Called on select. */
  onSelect?: (id: string) => void;
  /** Called on configure. */
  onConfigure?: (id: string) => void;
  /** Called on delete. */
  onDelete?: (id: string) => void;
  /** Called on port connection start. */
  onConnectStart?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
  /** Called on port connection end. */
  onConnectEnd?: (nodeId: string, portName: string, direction: 'input' | 'output') => void;
  /** Status badge slot. */
  statusBadge?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const WorkflowNode = forwardRef<HTMLDivElement, WorkflowNodeProps>(function WorkflowNode(
  {
    id,
    title,
    nodeType,
    icon,
    inputPortDefs = [],
    outputPortDefs = [],
    executionStatus = 'pending',
    position = { x: 0, y: 0 },
    configSummary,
    disabled = false,
    onSelect,
    onConfigure,
    onDelete,
    onConnectStart,
    onConnectEnd,
    statusBadge,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(wfNodeReducer, 'idle');

  const isSelected = state === 'selected' || state === 'configuring';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); send({ type: 'CONFIGURE' }); onConfigure?.(id); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); send({ type: 'DELETE' }); onDelete?.(id); }
      if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); }
    },
    [id, onConfigure, onDelete],
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`${title} node`}
      aria-roledescription="workflow node"
      aria-grabbed={state === 'dragging' || undefined}
      aria-selected={isSelected || undefined}
      aria-busy={executionStatus === 'running' || undefined}
      data-surface-widget=""
      data-widget-name="workflow-node"
      data-state={state}
      data-execution={executionStatus}
      data-node-type={nodeType}
      data-id={id}
      data-disabled={disabled ? 'true' : 'false'}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={() => { send({ type: 'SELECT' }); onSelect?.(id); }}
      onDoubleClick={() => { send({ type: 'CONFIGURE' }); onConfigure?.(id); }}
      onPointerDown={() => send({ type: 'DRAG_START' })}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <div data-part="header" data-execution={executionStatus}>
        {icon && (
          <span data-part="icon" data-type={nodeType} aria-hidden="true">
            {icon}
          </span>
        )}
        <span data-part="title">{title}</span>
        <span
          data-part="status-badge"
          data-status={executionStatus}
          role="status"
          aria-label={`Status: ${executionStatus}`}
          aria-live="polite"
        >
          {statusBadge ?? executionStatus}
        </span>
      </div>

      {inputPortDefs.length > 0 && (
        <div data-part="input-ports" role="group" aria-label="Input ports">
          {inputPortDefs.map((port) => (
            <div
              key={port.name}
              data-part="input-port"
              data-port-name={port.name}
              data-port-type={port.type}
              data-required={port.required ? 'true' : 'false'}
              data-connected={port.connected ? 'true' : 'false'}
              role="button"
              aria-label={`Input: ${port.name} (${port.type})`}
              aria-roledescription="connection port"
              tabIndex={-1}
              onPointerDown={() => onConnectStart?.(id, port.name, 'input')}
              onPointerUp={() => onConnectEnd?.(id, port.name, 'input')}
            />
          ))}
        </div>
      )}

      {outputPortDefs.length > 0 && (
        <div data-part="output-ports" role="group" aria-label="Output ports">
          {outputPortDefs.map((port) => (
            <div
              key={port.name}
              data-part="output-port"
              data-port-name={port.name}
              data-port-type={port.type}
              data-connected={port.connected ? 'true' : 'false'}
              role="button"
              aria-label={`Output: ${port.name} (${port.type})`}
              aria-roledescription="connection port"
              tabIndex={-1}
              onPointerDown={() => onConnectStart?.(id, port.name, 'output')}
              onPointerUp={() => onConnectEnd?.(id, port.name, 'output')}
            />
          ))}
        </div>
      )}

      {configSummary && (
        <div data-part="body" data-visible="true" role="region" aria-label="Configuration preview">
          {configSummary}
        </div>
      )}

      {children}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';
export { WorkflowNode };
export default WorkflowNode;
