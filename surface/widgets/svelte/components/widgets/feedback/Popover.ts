import { uid } from '../shared/uid.js';

export interface PopoverProps {
  open?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  title?: string;
  closable?: boolean;
  children?: HTMLElement;
  trigger?: HTMLElement;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface PopoverInstance {
  element: HTMLElement;
  update(props: Partial<PopoverProps>): void;
  destroy(): void;
}

export function createPopover(options: {
  target: HTMLElement;
  props: PopoverProps;
}): PopoverInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'popover');
  root.setAttribute('data-part', 'root');

  const triggerEl = document.createElement('div');
  triggerEl.setAttribute('data-part', 'trigger');
  root.appendChild(triggerEl);

  const contentEl = document.createElement('div');
  contentEl.setAttribute('data-part', 'content');
  contentEl.setAttribute('role', 'dialog');
  contentEl.id = id;
  root.appendChild(contentEl);

  const arrowEl = document.createElement('div');
  arrowEl.setAttribute('data-part', 'arrow');
  contentEl.appendChild(arrowEl);

  const titleEl = document.createElement('div');
  titleEl.setAttribute('data-part', 'title');
  contentEl.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-part', 'close-trigger');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  contentEl.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  contentEl.appendChild(bodyEl);

  function toggle() { currentProps.open = !currentProps.open; currentProps.onOpenChange?.(currentProps.open); sync(); }
  triggerEl.addEventListener('click', toggle);
  closeBtn.addEventListener('click', () => { currentProps.open = false; currentProps.onOpenChange?.(false); sync(); });
  document.addEventListener('click', (e) => { if (currentProps.open && !root.contains(e.target as Node)) { currentProps.open = false; currentProps.onOpenChange?.(false); sync(); } });
  document.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Escape' && currentProps.open) { currentProps.open = false; currentProps.onOpenChange?.(false); sync(); } }) as EventListener);

  function sync() {
    root.setAttribute('data-state', currentProps.open ? 'open' : 'closed');
    contentEl.setAttribute('data-placement', currentProps.placement ?? 'bottom');
    contentEl.style.display = currentProps.open ? '' : 'none';
    titleEl.textContent = currentProps.title ?? '';
    titleEl.style.display = currentProps.title ? '' : 'none';
    closeBtn.style.display = currentProps.closable !== false ? '' : 'none';
    if (currentProps.children && !bodyEl.contains(currentProps.children)) {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(currentProps.children);
    }
    if (currentProps.trigger && !triggerEl.contains(currentProps.trigger)) {
      triggerEl.innerHTML = '';
      triggerEl.appendChild(currentProps.trigger);
    }
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPopover;
