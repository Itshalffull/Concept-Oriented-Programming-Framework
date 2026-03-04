// Clef Surface Widget — SolidJS Provider
// Imperative DOM, factory function returning { element, dispose }

import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());
  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);
  return () => { clearInterval(interval); if (typeof cleanup === 'function') cleanup(); };
}

let _idCounter = 0;
function uid(): string { return 'solid-' + (++_idCounter); }


export interface AlertDialogProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface AlertDialogResult { element: HTMLElement; dispose: () => void; }

export function AlertDialog(props: AlertDialogProps): AlertDialogResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'alert-dialog');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  if (props.open) {
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-part', 'backdrop');
    backdrop.setAttribute('data-state', 'open');
    backdrop.setAttribute('data-role', 'alertdialog');
    const positioner = document.createElement('div');
    positioner.setAttribute('data-part', 'positioner');
    const content = document.createElement('div');
    content.setAttribute('data-part', 'content');
    content.setAttribute('role', 'alertdialog');
    content.setAttribute('aria-modal', 'true');
    if (props.title) {
      const t = document.createElement('div');
      t.setAttribute('data-part', 'title');
      t.textContent = String(props.title);
      content.appendChild(t);
    }
    const actions = document.createElement('div');
    actions.setAttribute('data-part', 'actions');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('data-part', 'cancel');
    cancelBtn.setAttribute('aria-label', 'Cancel');
    cancelBtn.textContent = String(props.cancelLabel || 'Cancel');
    cancelBtn.addEventListener('click', () => {
      if (typeof props.onCancel === 'function') (props.onCancel as () => void)();
      if (typeof props.onOpenChange === 'function') (props.onOpenChange as (o: boolean) => void)(false);
    });
    actions.appendChild(cancelBtn);
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.setAttribute('data-part', 'confirm');
    confirmBtn.setAttribute('aria-label', 'Confirm');
    confirmBtn.textContent = String(props.confirmLabel || 'Confirm');
    confirmBtn.addEventListener('click', () => {
      if (typeof props.onConfirm === 'function') (props.onConfirm as () => void)();
      if (typeof props.onOpenChange === 'function') (props.onOpenChange as (o: boolean) => void)(false);
    });
    actions.appendChild(confirmBtn);
    content.appendChild(actions);
    positioner.appendChild(content);
    backdrop.appendChild(positioner);
    document.body.appendChild(backdrop);
    disposers.push(() => backdrop.remove());
    setState('open');
  }

  disposers.push(solidCreateEffect([state], () => {
    root.setAttribute('data-state', state());
  }));

  function dispose() {
    disposers.forEach(d => d());
    root.remove();
  }

  return { element: root, dispose };
}
export default AlertDialog;
