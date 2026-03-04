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


export interface StepperProps {
  [key: string]: unknown;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
  children?: HTMLElement[];
}

export interface StepperResult { element: HTMLElement; dispose: () => void; }

export function Stepper(props: StepperProps): StepperResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disabled = props.disabled === true;
  const size = (props.size as string) || 'md';
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'stepper');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  root.setAttribute('data-disabled', String(disabled));
  root.setAttribute('data-size', size);
  root.setAttribute('role', 'group');
  if (props.label) root.setAttribute('aria-label', String(props.label));
  if (props.class) root.className = props.class;

  if (props.children) {
    props.children.forEach(c => root.appendChild(c));
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
export default Stepper;
