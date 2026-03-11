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


export interface DialogProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface DialogResult { element: HTMLElement; dispose: () => void; }

export function Dialog(props: DialogProps): DialogResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'dialog');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  root.setAttribute('data-widget-name', 'dialog');
  if (props.open) {
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-part', 'backdrop');
    backdrop.setAttribute('data-state', 'open');
    const positioner = document.createElement('div');
    positioner.setAttribute('data-part', 'positioner');
    positioner.setAttribute('data-state', 'open');
    const content = document.createElement('div');
    content.setAttribute('data-part', 'content');
    content.setAttribute('role', (props.dialogRole as string) || 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('data-state', 'open');
    if (props.title) {
      const titleEl = document.createElement('div');
      titleEl.setAttribute('data-part', 'title');
      titleEl.textContent = String(props.title);
      content.appendChild(titleEl);
    }
    if (props.description) {
      const descEl = document.createElement('div');
      descEl.setAttribute('data-part', 'description');
      descEl.textContent = String(props.description);
      content.appendChild(descEl);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-part', 'close-trigger');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      if (typeof props.onOpenChange === 'function') (props.onOpenChange as (o: boolean) => void)(false);
    });
    content.appendChild(closeBtn);
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
export default Dialog;
