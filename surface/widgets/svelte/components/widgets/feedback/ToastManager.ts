import { uid } from '../shared/uid.js';

export interface ToastManagerProps {
  placement?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  max?: number;
  className?: string;
}

export interface ToastManagerInstance {
  element: HTMLElement;
  update(props: Partial<ToastManagerProps>): void;
  destroy(): void;
  addToast(toast: { title: string; description?: string; variant?: string; duration?: number }): string;
  removeToast(id: string): void;
}

export function createToastManager(options: {
  target: HTMLElement;
  props: ToastManagerProps;
}): ToastManagerInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];
  const toasts: Array<{ id: string; title: string; description?: string; variant?: string; el?: HTMLElement }> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'toast-manager');
  root.setAttribute('data-part', 'root');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Notifications');

  function removeToast(toastId: string) {
    const idx = toasts.findIndex(t => t.id === toastId);
    if (idx >= 0) { toasts[idx].el?.remove(); toasts.splice(idx, 1); }
  }

  function addToast(toast: { title: string; description?: string; variant?: string; duration?: number }): string {
    const toastId = uid();
    if (currentProps.max && toasts.length >= currentProps.max) removeToast(toasts[0].id);

    const el = document.createElement('div');
    el.setAttribute('data-part', 'toast');
    el.setAttribute('role', 'alert');
    el.setAttribute('data-variant', toast.variant ?? 'info');

    const title = document.createElement('div');
    title.setAttribute('data-part', 'toast-title');
    title.textContent = toast.title;
    el.appendChild(title);

    if (toast.description) {
      const desc = document.createElement('div');
      desc.setAttribute('data-part', 'toast-description');
      desc.textContent = toast.description;
      el.appendChild(desc);
    }

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => removeToast(toastId));
    el.appendChild(closeBtn);

    toasts.push({ id: toastId, ...toast, el });
    root.appendChild(el);

    const dur = toast.duration ?? 5000;
    if (dur > 0) setTimeout(() => removeToast(toastId), dur);

    return toastId;
  }

  function sync() {
    root.setAttribute('data-placement', currentProps.placement ?? 'bottom-right');
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
    addToast,
    removeToast,
  };
}

export default createToastManager;
