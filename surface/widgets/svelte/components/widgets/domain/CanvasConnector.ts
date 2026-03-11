import { uid } from '../shared/uid.js';

export interface CanvasConnectorProps {
  id: string;
  startNodeId: string;
  endNodeId: string;
  startNodeLabel?: string;
  endNodeLabel?: string;
  startPort?: string;
  endPort?: string;
  label?: string;
  lineStyle?: 'straight' | 'curved' | 'step';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  startPos?: { x: number; y: number };
  endPos?: { x: number; y: number };
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLabelChange?: (id: string, value: string) => void;
}

export interface CanvasConnectorInstance {
  element: HTMLElement;
  update(props: Partial<CanvasConnectorProps>): void;
  destroy(): void;
}

export function createCanvasConnector(options: {
  target: HTMLElement;
  props: CanvasConnectorProps;
}): CanvasConnectorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const elId = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('g');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'canvas-connector');
  root.setAttribute('data-part', 'connector');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-roledescription', 'connector');
  root.setAttribute('tabindex', '0');
  root.id = elId;

  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('data-part', 'path');
  pathEl.setAttribute('fill', 'none');
  root.appendChild(pathEl);

  const labelEl = document.createElement('div');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  root.addEventListener('click', () => currentProps.onSelect?.(currentProps.id));
  cleanups.push(() => {});
  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Enter') currentProps.onSelect?.(currentProps.id);
    if (e.key === 'Delete' || e.key === 'Backspace') currentProps.onDelete?.(currentProps.id);
  }) as EventListener);

  function computePath(): string {
    const s = currentProps.startPos ?? { x: 0, y: 0 };
    const e = currentProps.endPos ?? { x: 100, y: 100 };
    const style = currentProps.lineStyle ?? 'curved';
    if (style === 'straight') return 'M' + s.x + ',' + s.y + ' L' + e.x + ',' + e.y;
    if (style === 'step') {
      const midX = (s.x + e.x) / 2;
      return 'M' + s.x + ',' + s.y + ' L' + midX + ',' + s.y + ' L' + midX + ',' + e.y + ' L' + e.x + ',' + e.y;
    }
    const cx = (s.x + e.x) / 2;
    return 'M' + s.x + ',' + s.y + ' C' + cx + ',' + s.y + ' ' + cx + ',' + e.y + ' ' + e.x + ',' + e.y;
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    const desc = 'Connection from ' + (currentProps.startNodeLabel ?? currentProps.startNodeId) + ' to ' + (currentProps.endNodeLabel ?? currentProps.endNodeId);
    root.setAttribute('aria-label', currentProps.label ?? desc);
    pathEl.setAttribute('d', computePath());
    pathEl.setAttribute('stroke', currentProps.color ?? '#666');
    pathEl.setAttribute('stroke-width', String(currentProps.strokeWidth ?? 2));
    if (currentProps.dashed) pathEl.setAttribute('stroke-dasharray', '5,5');
    else pathEl.removeAttribute('stroke-dasharray');
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
  }

  sync();
  target.appendChild(root);

  return {
    element: root as unknown as HTMLElement,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createCanvasConnector;
