import { uid } from '../shared/uid.js';

export interface DrawerProps {
  open?: boolean;
  title?: string;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  children?: HTMLElement;
  onClose?: () => void;
  className?: string;
}

export interface DrawerInstance {
  element: HTMLElement;
  update(props: Partial<DrawerProps>): void;
  destroy(): void;
}

export function createDrawer(options: {
  target: HTMLElement;
  props: DrawerProps;
}): DrawerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const backdrop = document.createElement('div');
  backdrop.setAttribute('data-surface-widget', '');
  backdrop.setAttribute('data-widget-name', 'drawer');
  backdrop.setAttribute('data-part', 'backdrop');

  const root = document.createElement('div');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', id + '-title');
  backdrop.appendChild(root);

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const titleEl = document.createElement('h2');
  titleEl.setAttribute('data-part', 'title');
  titleEl.id = id + '-title';
  headerEl.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-part', 'close-trigger');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Close drawer');
  closeBtn.textContent = '\u00d7';
  headerEl.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  closeBtn.addEventListener('click', () => currentProps.onClose?.());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) currentProps.onClose?.(); });
  backdrop.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Escape') currentProps.onClose?.(); }) as EventListener);

  function sync() {
    backdrop.setAttribute('data-state', currentProps.open ? 'open' : 'closed');
    backdrop.style.display = currentProps.open ? '' : 'none';
    root.setAttribute('data-placement', currentProps.placement ?? 'right');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    titleEl.textContent = currentProps.title ?? '';
    closeBtn.style.display = currentProps.closable !== false ? '' : 'none';
    if (currentProps.children && !bodyEl.contains(currentProps.children)) {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(currentProps.children);
    }
    if (currentProps.className) backdrop.className = currentProps.className; else backdrop.className = '';
  }

  sync();
  target.appendChild(backdrop);

  return {
    element: backdrop,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); backdrop.remove(); },
  };
}

export default createDrawer;
