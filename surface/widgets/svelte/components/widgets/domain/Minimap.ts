import { uid } from '../shared/uid.js';

export interface MinimapProps {
  viewportX?: number;
  viewportY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  contentWidth?: number;
  contentHeight?: number;
  zoom?: number;
  nodes?: Array<{ id: string; x: number; y: number; color?: string }>;
  onViewportChange?: (x: number, y: number) => void;
  children?: string | HTMLElement;
}

export interface MinimapInstance {
  element: HTMLElement;
  update(props: Partial<MinimapProps>): void;
  destroy(): void;
}

export function createMinimap(options: {
  target: HTMLElement;
  props: MinimapProps;
}): MinimapInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'minimap');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Minimap');
  root.id = id;

  const canvasEl = document.createElement('div');
  canvasEl.setAttribute('data-part', 'canvas');
  root.appendChild(canvasEl);

  const viewportRect = document.createElement('div');
  viewportRect.setAttribute('data-part', 'viewport-rect');
  canvasEl.appendChild(viewportRect);

  let isDragging = false;
  root.addEventListener('mousedown', (e) => {
    isDragging = true;
    handleDrag(e as MouseEvent);
  });
  const handleMouseMove = (e: Event) => { if (isDragging) handleDrag(e as MouseEvent); };
  const handleMouseUp = () => { isDragging = false; };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  cleanups.push(() => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); });

  function handleDrag(e: MouseEvent) {
    const rect = root.getBoundingClientRect();
    const scale = (currentProps.contentWidth ?? 1000) / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    currentProps.onViewportChange?.(x, y);
  }

  function renderNodes() {
    const existing = canvasEl.querySelectorAll('[data-part="node-dot"]');
    existing.forEach(n => n.remove());
    const cw = currentProps.contentWidth ?? 1000;
    const ch = currentProps.contentHeight ?? 1000;
    (currentProps.nodes ?? []).forEach(n => {
      const dot = document.createElement('div');
      dot.setAttribute('data-part', 'node-dot');
      dot.style.position = 'absolute';
      dot.style.left = (n.x / cw * 100) + '%';
      dot.style.top = (n.y / ch * 100) + '%';
      dot.style.backgroundColor = n.color ?? '#666';
      canvasEl.appendChild(dot);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    const cw = currentProps.contentWidth ?? 1000;
    const ch = currentProps.contentHeight ?? 1000;
    const vx = currentProps.viewportX ?? 0;
    const vy = currentProps.viewportY ?? 0;
    const vw = currentProps.viewportWidth ?? 200;
    const vh = currentProps.viewportHeight ?? 200;
    viewportRect.style.left = (vx / cw * 100) + '%';
    viewportRect.style.top = (vy / ch * 100) + '%';
    viewportRect.style.width = (vw / cw * 100) + '%';
    viewportRect.style.height = (vh / ch * 100) + '%';
    viewportRect.style.position = 'absolute';
    canvasEl.style.position = 'relative';
    renderNodes();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createMinimap;
