import { uid } from '../shared/uid.js';

export interface DragHandleProps {
  itemId: string;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  ariaLabel?: string;
  onDragStart?: (id: string) => void;
  onDrag?: (id: string, dx: number, dy: number) => void;
  onDragEnd?: (id: string) => void;
  children?: string | HTMLElement;
}

export interface DragHandleInstance {
  element: HTMLElement;
  update(props: Partial<DragHandleProps>): void;
  destroy(): void;
}

export function createDragHandle(options: {
  target: HTMLElement;
  props: DragHandleProps;
}): DragHandleInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'drag-handle');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'button');
  root.setAttribute('aria-roledescription', 'drag handle');
  root.setAttribute('tabindex', '0');
  root.id = id;

  root.textContent = '\u2261';

  root.addEventListener('mousedown', (e) => {
    if (currentProps.disabled) return;
    isDragging = true;
    startX = (e as MouseEvent).clientX;
    startY = (e as MouseEvent).clientY;
    currentProps.onDragStart?.(currentProps.itemId);
    root.setAttribute('data-state', 'dragging');
  });

  const handleMove = (e: Event) => {
    if (!isDragging) return;
    const me = e as MouseEvent;
    currentProps.onDrag?.(currentProps.itemId, me.clientX - startX, me.clientY - startY);
  };
  const handleUp = () => {
    if (!isDragging) return;
    isDragging = false;
    currentProps.onDragEnd?.(currentProps.itemId);
    root.setAttribute('data-state', 'idle');
  };
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleUp);
  cleanups.push(() => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); });

  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (currentProps.disabled) return;
    const step = 10;
    if (e.key === 'ArrowUp') currentProps.onDrag?.(currentProps.itemId, 0, -step);
    if (e.key === 'ArrowDown') currentProps.onDrag?.(currentProps.itemId, 0, step);
    if (e.key === 'ArrowLeft') currentProps.onDrag?.(currentProps.itemId, -step, 0);
    if (e.key === 'ArrowRight') currentProps.onDrag?.(currentProps.itemId, step, 0);
  }) as EventListener);

  function sync() {
    if (!isDragging) root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('aria-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-orientation', currentProps.orientation ?? 'vertical');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    else root.setAttribute('aria-label', 'Drag to reorder');
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createDragHandle;
