import { uid } from '../shared/uid.js';

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
  canvas?: string | HTMLElement;
  nodePalette?: string | HTMLElement;
  configPanel?: string | HTMLElement;
  minimap?: string | HTMLElement;
  toolbar?: string | HTMLElement;
  children?: string | HTMLElement;
}

export interface WorkflowEditorInstance {
  element: HTMLElement;
  update(props: Partial<WorkflowEditorProps>): void;
  destroy(): void;
}

export function createWorkflowEditor(options: {
  target: HTMLElement;
  props: WorkflowEditorProps;
}): WorkflowEditorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'workflow-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-roledescription', 'workflow editor');
  root.id = id;

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'Workflow actions');
  root.appendChild(toolbarEl);

  const nameEl = document.createElement('span');
  nameEl.setAttribute('data-part', 'workflow-name');
  toolbarEl.appendChild(nameEl);

  const executeBtn = document.createElement('button');
  executeBtn.setAttribute('data-part', 'execute-button');
  executeBtn.setAttribute('type', 'button');
  toolbarEl.appendChild(executeBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('data-part', 'cancel-button');
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.textContent = 'Cancel';
  toolbarEl.appendChild(cancelBtn);

  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  canvasEl.setAttribute('aria-label', 'Workflow canvas');
  root.appendChild(canvasEl);

  const nodePaletteEl = document.createElement('div');
  nodePaletteEl.setAttribute('data-part', 'node-palette');
  nodePaletteEl.setAttribute('role', 'complementary');
  nodePaletteEl.setAttribute('aria-label', 'Node palette');
  root.appendChild(nodePaletteEl);

  const configPanelEl = document.createElement('div');
  configPanelEl.setAttribute('data-part', 'config-panel');
  configPanelEl.setAttribute('role', 'complementary');
  configPanelEl.setAttribute('aria-label', 'Node configuration');
  root.appendChild(configPanelEl);

  const minimapEl = document.createElement('div');
  minimapEl.setAttribute('data-part', 'minimap');
  minimapEl.setAttribute('role', 'img');
  minimapEl.setAttribute('aria-label', 'Workflow minimap');
  root.appendChild(minimapEl);

  executeBtn.addEventListener('click', () => currentProps.onExecute?.());
  cleanups.push(() => {});
  cancelBtn.addEventListener('click', () => currentProps.onCancel?.());

  function sync() {
    const exec = currentProps.executionState ?? 'idle';
    root.setAttribute('data-state', exec);
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    root.setAttribute('aria-busy', exec === 'running' ? 'true' : 'false');
    nameEl.textContent = currentProps.workflowName ?? 'Workflow';
    executeBtn.textContent = exec === 'running' ? 'Running...' : 'Execute';
    executeBtn.disabled = exec === 'running' || currentProps.readOnly || false;
    cancelBtn.style.display = exec === 'running' ? '' : 'none';
    nodePaletteEl.style.display = currentProps.paletteOpen ? '' : 'none';
    configPanelEl.style.display = currentProps.configOpen ? '' : 'none';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createWorkflowEditor;
