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


export interface AlertProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface AlertResult { element: HTMLElement; dispose: () => void; }

export function Alert(props: AlertProps): AlertResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'alert');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  const variant = (props.variant as string) || 'info';
  root.setAttribute('data-variant', variant);
  const role = variant === 'info' ? 'status' : 'alert';
  root.setAttribute('role', role);
  root.setAttribute('aria-live', variant === 'info' ? 'polite' : 'assertive');
  root.setAttribute('aria-atomic', 'true');

  if (props.title) {
    const titleEl = document.createElement('div');
    titleEl.setAttribute('data-part', 'title');
    titleEl.textContent = String(props.title);
    root.appendChild(titleEl);
  }
  if (props.description) {
    const descEl = document.createElement('div');
    descEl.setAttribute('data-part', 'description');
    descEl.textContent = String(props.description);
    root.appendChild(descEl);
  }
  if (props.closable) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-part', 'close-trigger');
    closeBtn.setAttribute('aria-label', 'Dismiss alert');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      setState('dismissed');
      root.style.display = 'none';
      if (typeof props.onDismiss === 'function') (props.onDismiss as () => void)();
    });
    root.appendChild(closeBtn);
  }
  setState('visible');

  disposers.push(solidCreateEffect([state], () => {
    root.setAttribute('data-state', state());
  }));

  function dispose() {
    disposers.forEach(d => d());
    root.remove();
  }

  return { element: root, dispose };
}
export default Alert;
