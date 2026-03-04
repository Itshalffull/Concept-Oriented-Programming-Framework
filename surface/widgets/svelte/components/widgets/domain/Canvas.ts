import { uid } from '../shared/uid.js';

export type CanvasTool = 'select' | 'pan' | 'draw' | 'shape' | 'text' | 'eraser';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProps {
  nodes?: Array<{ id: string; x: number; y: number; [k: string]: unknown }>;
  edges?: Array<{ id: string; source: string; target: string; [k: string]: unknown }>;
  tool?: CanvasTool;
  zoom?: number;
  panX?: number;
  panY?: number;
  gridSize?: number;
  gridVisible?: boolean;
  snapToGrid?: boolean;
  ariaLabel?: string;
  readOnly?: boolean;
  selectedIds?: string[];
  viewportPercent?: number;
  shapeType?: 'rectangle' | 'ellipse' | 'diamond' | 'triangle';
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (x: number, y: number) => void;
  onToolChange?: (tool: CanvasTool) => void;
  nodeLayer?: string | HTMLElement;
  edgeLayer?: string | HTMLElement;
  toolbar?: string | HTMLElement;
  minimap?: string | HTMLElement;
  propertyPanel?: string | HTMLElement;
  children?: string | HTMLElement;
}

export interface CanvasInstance {
  element: HTMLElement;
  update(props: Partial<CanvasProps>): void;
  destroy(): void;
}

export function createCanvas(options: {
  target: HTMLElement;
  props: CanvasProps;
}): CanvasInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'canvas');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-roledescription', 'canvas');
  root.setAttribute('tabindex', '0');
  root.id = id;

  const toolbarEl = document.createElement('div');
  toolbarEl.setAttribute('data-part', 'toolbar');
  toolbarEl.setAttribute('role', 'toolbar');
  toolbarEl.setAttribute('aria-label', 'Canvas tools');
  root.appendChild(toolbarEl);

  const viewportEl = document.createElement('div');
  viewportEl.setAttribute('data-part', 'viewport');
  root.appendChild(viewportEl);

  const gridEl = document.createElement('div');
  gridEl.setAttribute('data-part', 'grid');
  gridEl.setAttribute('aria-hidden', 'true');
  viewportEl.appendChild(gridEl);

  const edgeLayerEl = document.createElement('svg');
  edgeLayerEl.setAttribute('data-part', 'edge-layer');
  edgeLayerEl.setAttribute('aria-label', 'Connections between nodes');
  viewportEl.appendChild(edgeLayerEl);

  const nodeLayerEl = document.createElement('div');
  nodeLayerEl.setAttribute('data-part', 'node-layer');
  nodeLayerEl.setAttribute('aria-label', 'Canvas nodes');
  viewportEl.appendChild(nodeLayerEl);

  const selectionBoxEl = document.createElement('div');
  selectionBoxEl.setAttribute('data-part', 'selection-box');
  selectionBoxEl.style.display = 'none';
  viewportEl.appendChild(selectionBoxEl);

  const minimapEl = document.createElement('div');
  minimapEl.setAttribute('data-part', 'minimap');
  minimapEl.setAttribute('role', 'img');
  minimapEl.setAttribute('aria-label', 'Canvas minimap');
  root.appendChild(minimapEl);

  const propertyPanelEl = document.createElement('div');
  propertyPanelEl.setAttribute('data-part', 'property-panel');
  propertyPanelEl.setAttribute('role', 'complementary');
  propertyPanelEl.setAttribute('aria-label', 'Element properties');
  root.appendChild(propertyPanelEl);

  function handleWheel(e: Event) {
    const we = e as WheelEvent;
    we.preventDefault();
    const zoom = (currentProps.zoom ?? 1) + (we.deltaY > 0 ? -0.1 : 0.1);
    const clamped = Math.max(0.1, Math.min(5, zoom));
    currentProps.onZoomChange?.(clamped);
  }
  viewportEl.addEventListener('wheel', handleWheel, { passive: false });
  cleanups.push(() => viewportEl.removeEventListener('wheel', handleWheel));

  viewportEl.addEventListener('mousedown', (e) => {
    if (currentProps.tool === 'pan' || (e as MouseEvent).button === 1) {
      isPanning = true;
      panStartX = (e as MouseEvent).clientX;
      panStartY = (e as MouseEvent).clientY;
    }
  });
  const handleMouseMove = (e: Event) => {
    if (!isPanning) return;
    const me = e as MouseEvent;
    const dx = me.clientX - panStartX;
    const dy = me.clientY - panStartY;
    panStartX = me.clientX;
    panStartY = me.clientY;
    currentProps.onPanChange?.((currentProps.panX ?? 0) + dx, (currentProps.panY ?? 0) + dy);
  };
  const handleMouseUp = () => { isPanning = false; };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  cleanups.push(() => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); });

  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') currentProps.onZoomChange?.(Math.min(5, (currentProps.zoom ?? 1) + 0.1));
    if (e.key === '-') currentProps.onZoomChange?.(Math.max(0.1, (currentProps.zoom ?? 1) - 0.1));
  }) as EventListener);

  function renderToolbar() {
    toolbarEl.innerHTML = '';
    const tools: CanvasTool[] = ['select', 'pan', 'draw', 'shape', 'text', 'eraser'];
    tools.forEach(t => {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', t === (currentProps.tool ?? 'select') ? 'true' : 'false');
      btn.setAttribute('aria-label', t + ' tool');
      btn.textContent = t;
      btn.addEventListener('click', () => currentProps.onToolChange?.(t));
      toolbarEl.appendChild(btn);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    root.setAttribute('data-tool', currentProps.tool ?? 'select');
    root.setAttribute('data-zoom', String(currentProps.zoom ?? 1));
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    gridEl.style.display = currentProps.gridVisible ? '' : 'none';
    const zoom = currentProps.zoom ?? 1;
    const px = currentProps.panX ?? 0;
    const py = currentProps.panY ?? 0;
    viewportEl.style.transform = 'translate(' + px + 'px,' + py + 'px) scale(' + zoom + ')';
    renderToolbar();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createCanvas;
