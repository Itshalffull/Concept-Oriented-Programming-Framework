'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { workflowEditorReducer } from './WorkflowEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface WorkflowNodeDef {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  [k: string]: unknown;
}

export interface WorkflowEdgeDef {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface WorkflowEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Workflow nodes. */
  nodes: WorkflowNodeDef[];
  /** Workflow edges. */
  edges: WorkflowEdgeDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Execution state. */
  executionState?: 'idle' | 'running' | 'success' | 'error';
  /** Selected node ID. */
  selectedNodeId?: string;
  /** Zoom level. */
  zoom?: number;
  /** Pan X. */
  panX?: number;
  /** Pan Y. */
  panY?: number;
  /** Palette open state. */
  paletteOpen?: boolean;
  /** Config panel open state. */
  configOpen?: boolean;
  /** Workflow name. */
  workflowName?: string;
  /** Called on execute. */
  onExecute?: () => void;
  /** Called on cancel execution. */
  onCancel?: () => void;
  /** Canvas slot. */
  canvas?: ReactNode;
  /** Node palette slot. */
  nodePalette?: ReactNode;
  /** Config panel slot. */
  configPanel?: ReactNode;
  /** Minimap slot. */
  minimap?: ReactNode;
  /** Toolbar slot. */
  toolbar?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const WorkflowEditor = forwardRef<HTMLDivElement, WorkflowEditorProps>(function WorkflowEditor(
  {
    nodes,
    edges,
    ariaLabel = 'Workflow Editor',
    readOnly = false,
    executionState = 'idle',
    selectedNodeId,
    zoom = 1.0,
    panX = 0,
    panY = 0,
    paletteOpen = true,
    configOpen = false,
    workflowName = 'Untitled Workflow',
    onExecute,
    onCancel,
    canvas,
    nodePalette,
    configPanel,
    minimap,
    toolbar,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(workflowEditorReducer, 'idle');
  const isExecuting = state === 'executing';

  const handleExecute = useCallback(() => {
    if (isExecuting) {
      send({ type: 'CANCEL' });
      onCancel?.();
    } else {
      send({ type: 'EXECUTE' });
      onExecute?.();
    }
  }, [isExecuting, onExecute, onCancel]);

  return (
    <div
      ref={ref}
      role="application"
      aria-label={ariaLabel}
      aria-roledescription="workflow editor"
      aria-busy={isExecuting || undefined}
      data-surface-widget=""
      data-widget-name="workflow-editor"
      data-state={state}
      data-execution={executionState}
      data-readonly={readOnly ? 'true' : 'false'}
      {...rest}
    >
      {toolbar && (
        <div role="toolbar" aria-label="Workflow actions" data-part="toolbar" data-state={state}>
          {toolbar}
        </div>
      )}

      <button
        type="button"
        role="button"
        aria-label={isExecuting ? 'Cancel execution' : 'Execute workflow'}
        aria-disabled={readOnly || undefined}
        data-part="execute-button"
        data-state={isExecuting ? 'running' : 'idle'}
        onClick={handleExecute}
      >
        {isExecuting ? 'Cancel' : 'Execute'}
      </button>

      <div
        data-part="canvas"
        aria-label="Workflow canvas"
        data-zoom={zoom}
        data-pan-x={panX}
        data-pan-y={panY}
        data-node-count={nodes.length}
        data-edge-count={edges.length}
      >
        {canvas ?? children}
      </div>

      {paletteOpen && nodePalette && (
        <div
          data-part="node-palette"
          role="complementary"
          aria-label="Node palette"
          data-visible="true"
        >
          {nodePalette}
        </div>
      )}

      {configOpen && configPanel && (
        <div
          data-part="config-panel"
          role="complementary"
          aria-label="Node configuration"
          data-visible="true"
          data-node-id={selectedNodeId}
        >
          {configPanel}
        </div>
      )}

      {minimap && (
        <div data-part="minimap" role="img" aria-label="Workflow minimap" data-zoom={zoom} data-pan-x={panX} data-pan-y={panY}>
          {minimap}
        </div>
      )}
    </div>
  );
});

WorkflowEditor.displayName = 'WorkflowEditor';
export { WorkflowEditor };
export default WorkflowEditor;
