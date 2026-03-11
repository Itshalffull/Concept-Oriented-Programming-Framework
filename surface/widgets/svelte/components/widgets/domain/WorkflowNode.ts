import { uid } from '../shared/uid.js';

export interface WorkflowNodePort {
  id: string;
  label?: string;
  direction: 'input' | 'output';
}

export interface WorkflowNodeProps {
  nodeId: string;
  title: string;
  nodeType: string;
  x: number;
  y: number;
  status?: 'idle' | 'running' | 'success' | 'error';
  selected?: boolean;
  ports?: WorkflowNodePort[];
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPortConnect?: (nodeId: string, portId: string) => void;
  renderContent?: () => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface WorkflowNodeInstance {
  element: HTMLElement;
  update(props: Partial<WorkflowNodeProps>): void;
  destroy(): void;
}

export function createWorkflowNode(options: {
  target: HTMLElement;
  props: WorkflowNodeProps;
}): WorkflowNodeInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'workflow-node');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'treeitem');
  root.setAttribute('tabindex', '0');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const titleEl = document.createElement('span');
  titleEl.setAttribute('data-part', 'title');
  headerEl.appendChild(titleEl);

  const statusEl = document.createElement('span');
  statusEl.setAttribute('data-part', 'status-indicator');
  statusEl.setAttribute('aria-live', 'polite');
  headerEl.appendChild(statusEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  const inputPortsEl = document.createElement('div');
  inputPortsEl.setAttribute('data-part', 'input-ports');
  root.appendChild(inputPortsEl);

  const outputPortsEl = document.createElement('div');
  outputPortsEl.setAttribute('data-part', 'output-ports');
  root.appendChild(outputPortsEl);

  root.addEventListener('click', () => currentProps.onSelect?.(currentProps.nodeId));
  cleanups.push(() => {});
  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') currentProps.onDelete?.(currentProps.nodeId);
    if (e.key === 'Enter') currentProps.onSelect?.(currentProps.nodeId);
  }) as EventListener);

  function renderPorts() {
    inputPortsEl.innerHTML = '';
    outputPortsEl.innerHTML = '';
    (currentProps.ports ?? []).forEach(p => {
      const portEl = document.createElement('div');
      portEl.setAttribute('data-part', 'port');
      portEl.setAttribute('data-port-direction', p.direction);
      portEl.setAttribute('tabindex', '0');
      portEl.setAttribute('aria-label', (p.label ?? p.id) + ' (' + p.direction + ')');
      portEl.addEventListener('click', (e) => { e.stopPropagation(); currentProps.onPortConnect?.(currentProps.nodeId, p.id); });
      if (p.direction === 'input') inputPortsEl.appendChild(portEl);
      else outputPortsEl.appendChild(portEl);
    });
  }

  function sync() {
    const status = currentProps.status ?? 'idle';
    root.setAttribute('data-state', status);
    root.setAttribute('data-selected', currentProps.selected ? 'true' : 'false');
    root.setAttribute('aria-selected', currentProps.selected ? 'true' : 'false');
    root.setAttribute('aria-label', currentProps.title);
    root.setAttribute('data-node-type', currentProps.nodeType);
    root.style.position = 'absolute';
    root.style.transform = 'translate(' + currentProps.x + 'px,' + currentProps.y + 'px)';
    titleEl.textContent = currentProps.title;
    statusEl.textContent = status !== 'idle' ? status : '';
    if (currentProps.renderContent) {
      bodyEl.innerHTML = '';
      const rendered = currentProps.renderContent();
      if (typeof rendered === 'string') bodyEl.innerHTML = rendered;
      else bodyEl.appendChild(rendered);
    }
    renderPorts();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createWorkflowNode;
