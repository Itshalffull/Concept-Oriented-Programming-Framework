import { uid } from '../shared/uid.js';

export interface CanvasNodePort {
  id: string;
  label?: string;
  direction: 'input' | 'output';
}

export interface CanvasNodeProps {
  nodeId: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  selected?: boolean;
  nodeType?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  ports?: CanvasNodePort[];
  draggable?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string, x: number, y: number) => void;
  onDrag?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onPortConnect?: (nodeId: string, portId: string) => void;
  renderContent?: () => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface CanvasNodeInstance {
  element: HTMLElement;
  update(props: Partial<CanvasNodeProps>): void;
  destroy(): void;
}

export function createCanvasNode(options: {
  target: HTMLElement;
  props: CanvasNodeProps;
}): CanvasNodeInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'canvas-node');
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
  statusEl.setAttribute('data-part', 'status');
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

  root.addEventListener('mousedown', (e) => {
    if (currentProps.draggable === false) return;
    isDragging = true;
    dragOffsetX = (e as MouseEvent).clientX - currentProps.x;
    dragOffsetY = (e as MouseEvent).clientY - currentProps.y;
    currentProps.onDragStart?.(currentProps.nodeId, currentProps.x, currentProps.y);
  });
  const handleMove = (e: Event) => {
    if (!isDragging) return;
    const me = e as MouseEvent;
    const x = me.clientX - dragOffsetX;
    const y = me.clientY - dragOffsetY;
    currentProps.onDrag?.(currentProps.nodeId, x, y);
  };
  const handleUp = (e: Event) => {
    if (!isDragging) return;
    isDragging = false;
    const me = e as MouseEvent;
    currentProps.onDragEnd?.(currentProps.nodeId, me.clientX - dragOffsetX, me.clientY - dragOffsetY);
  };
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleUp);
  cleanups.push(() => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); });

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
    if (currentProps.nodeType) root.setAttribute('data-node-type', currentProps.nodeType);
    root.style.transform = 'translate(' + currentProps.x + 'px,' + currentProps.y + 'px)';
    root.style.position = 'absolute';
    if (currentProps.width) root.style.width = currentProps.width + 'px';
    if (currentProps.height) root.style.height = currentProps.height + 'px';
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

export default createCanvasNode;
