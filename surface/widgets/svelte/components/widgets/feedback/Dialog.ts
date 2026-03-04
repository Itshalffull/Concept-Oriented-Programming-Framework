import { uid } from '../shared/uid.js';

export interface DialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  children?: HTMLElement;
  onClose?: () => void;
  className?: string;
}

export interface DialogInstance {
  element: HTMLElement;
  update(props: Partial<DialogProps>): void;
  destroy(): void;
}

export function createDialog(options: {
  target: HTMLElement;
  props: DialogProps;
}): DialogInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const backdrop = document.createElement('div');
  backdrop.setAttribute('data-surface-widget', '');
  backdrop.setAttribute('data-widget-name', 'dialog');
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
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '\u00d7';
  headerEl.appendChild(closeBtn);

  const descEl = document.createElement('p');
  descEl.setAttribute('data-part', 'description');
  root.appendChild(descEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  closeBtn.addEventListener('click', () => currentProps.onClose?.());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop && currentProps.closable !== false) currentProps.onClose?.(); });
  backdrop.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Escape' && currentProps.closable !== false) currentProps.onClose?.(); }) as EventListener);

  function sync() {
    backdrop.setAttribute('data-state', currentProps.open ? 'open' : 'closed');
    backdrop.style.display = currentProps.open ? '' : 'none';
    root.setAttribute('data-size', currentProps.size ?? 'md');
    titleEl.textContent = currentProps.title ?? '';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
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

export default createDialog;
