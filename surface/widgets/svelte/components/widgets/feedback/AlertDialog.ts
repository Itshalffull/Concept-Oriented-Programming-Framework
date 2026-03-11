import { uid } from '../shared/uid.js';

export interface AlertDialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'info' | 'warning' | 'danger';
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
}

export interface AlertDialogInstance {
  element: HTMLElement;
  update(props: Partial<AlertDialogProps>): void;
  destroy(): void;
}

export function createAlertDialog(options: {
  target: HTMLElement;
  props: AlertDialogProps;
}): AlertDialogInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const backdrop = document.createElement('div');
  backdrop.setAttribute('data-surface-widget', '');
  backdrop.setAttribute('data-widget-name', 'alert-dialog');
  backdrop.setAttribute('data-part', 'backdrop');

  const root = document.createElement('div');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', id + '-title');
  root.setAttribute('aria-describedby', id + '-desc');
  backdrop.appendChild(root);

  const titleEl = document.createElement('h2');
  titleEl.setAttribute('data-part', 'title');
  titleEl.id = id + '-title';
  root.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.setAttribute('data-part', 'description');
  descEl.id = id + '-desc';
  root.appendChild(descEl);

  const actionsEl = document.createElement('div');
  actionsEl.setAttribute('data-part', 'actions');
  root.appendChild(actionsEl);

  const cancelBtn = document.createElement('button');
  cancelBtn.setAttribute('data-part', 'cancel');
  cancelBtn.setAttribute('type', 'button');
  actionsEl.appendChild(cancelBtn);

  const confirmBtn = document.createElement('button');
  confirmBtn.setAttribute('data-part', 'confirm');
  confirmBtn.setAttribute('type', 'button');
  actionsEl.appendChild(confirmBtn);

  cancelBtn.addEventListener('click', () => currentProps.onCancel?.());
  confirmBtn.addEventListener('click', () => currentProps.onConfirm?.());
  backdrop.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Escape') currentProps.onCancel?.(); }) as EventListener);

  function sync() {
    backdrop.setAttribute('data-state', currentProps.open ? 'open' : 'closed');
    backdrop.style.display = currentProps.open ? '' : 'none';
    root.setAttribute('data-variant', currentProps.variant ?? 'info');
    titleEl.textContent = currentProps.title ?? '';
    descEl.textContent = currentProps.description ?? '';
    cancelBtn.textContent = currentProps.cancelLabel ?? 'Cancel';
    confirmBtn.textContent = currentProps.confirmLabel ?? 'Confirm';
    if (currentProps.className) backdrop.className = currentProps.className; else backdrop.className = '';
    if (currentProps.open) confirmBtn.focus();
  }

  sync();
  target.appendChild(backdrop);

  return {
    element: backdrop,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); backdrop.remove(); },
  };
}

export default createAlertDialog;
