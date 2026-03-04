// ============================================================
// Clef Surface NativeScript Widget — WorkflowEditor
//
// Visual workflow editor with node canvas and execution controls.
// ============================================================

import { StackLayout, Label, Button } from '@nativescript/core';
import type { View } from '@nativescript/core';

export interface WorkflowNodeDef { id: string; type: string; title: string; x: number; y: number; }
export interface WorkflowEdgeDef { id: string; source: string; target: string; }

export interface WorkflowEditorProps {
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  ariaLabel?: string;
  readOnly?: boolean;
  executionState?: 'idle' | 'running' | 'success' | 'error';
  selectedNodeId?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  paletteOpen?: boolean;
  configOpen?: boolean;
  workflowName?: string;
  onExecute?: () => void;
  onCancel?: () => void;
  canvas?: View;
  nodePalette?: View;
  configPanel?: View;
  minimap?: View;
  toolbar?: View;
  children?: View[];
}

export function createWorkflowEditor(props: WorkflowEditorProps): StackLayout {
  const {
    nodes, edges, ariaLabel = 'Workflow Editor', readOnly = false,
    executionState = 'idle', selectedNodeId, zoom = 1, panX = 0, panY = 0,
    paletteOpen = true, configOpen = false, workflowName = 'Untitled Workflow',
    onExecute, onCancel, canvas, nodePalette, configPanel, minimap, toolbar, children = [],
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-workflow-editor';
  container.accessibilityLabel = ariaLabel;

  if (toolbar) container.addChild(toolbar);

  const executeBtn = new Button();
  executeBtn.text = executionState === 'running' ? 'Cancel' : 'Execute';
  executeBtn.isEnabled = !readOnly;
  executeBtn.on('tap', () => executionState === 'running' ? onCancel?.() : onExecute?.());
  container.addChild(executeBtn);

  const canvasArea = new StackLayout();
  canvasArea.className = 'clef-workflow-canvas';
  canvasArea.accessibilityLabel = 'Workflow canvas';
  if (canvas) canvasArea.addChild(canvas);
  for (const child of children) canvasArea.addChild(child);
  container.addChild(canvasArea);

  if (paletteOpen && nodePalette) container.addChild(nodePalette);
  if (configOpen && configPanel) container.addChild(configPanel);
  if (minimap) container.addChild(minimap);

  return container;
}

export default createWorkflowEditor;
