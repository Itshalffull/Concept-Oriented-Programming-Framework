import { uid } from '../shared/uid.js';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  closable?: boolean;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
  className?: string;
}

export interface ToastInstance {
  element: HTMLElement;
  update(props: Partial<ToastProps>): void;
  destroy(): void;
}

export function createToast(options: {
  target: HTMLElement;
  props: ToastProps;
}): ToastInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let timer: any = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'toast');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'alert');
  root.setAttribute('aria-live', 'assertive');

  const titleEl = document.createElement('div');
  titleEl.setAttribute('data-part', 'title');
  root.appendChild(titleEl);

  const descEl = document.createElement('div');
  descEl.setAttribute('data-part', 'description');
  root.appendChild(descEl);

  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  root.appendChild(actionsEl);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-part', 'close-trigger');
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';
  root.appendChild(closeBtn);

  closeBtn.addEventListener('click', () => currentProps.onClose?.());

  function startTimer() {
    if (timer) clearTimeout(timer);
    const dur = currentProps.duration ?? 5000;
    if (dur > 0) timer = setTimeout(() => currentProps.onClose?.(), dur);
  }

  root.addEventListener('mouseenter', () => { if (timer) clearTimeout(timer); });
  root.addEventListener('mouseleave', startTimer);
  cleanups.push(() => { if (timer) clearTimeout(timer); });

  function sync() {
    root.setAttribute('data-variant', currentProps.variant ?? 'info');
    titleEl.textContent = currentProps.title ?? '';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
    closeBtn.style.display = currentProps.closable !== false ? '' : 'none';

    actionsEl.innerHTML = '';
    if (currentProps.action) {
      const btn = document.createElement('button');
      btn.setAttribute('data-part', 'action');
      btn.setAttribute('type', 'button');
      btn.textContent = currentProps.action.label;
      btn.addEventListener('click', currentProps.action.onClick);
      actionsEl.appendChild(btn);
    }
    actionsEl.style.display = currentProps.action ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  startTimer();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createToast;
