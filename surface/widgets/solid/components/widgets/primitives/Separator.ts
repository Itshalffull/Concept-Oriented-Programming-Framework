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


export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  class?: string;
}

export interface SeparatorResult { element: HTMLElement; dispose: () => void; }

export function Separator(props: SeparatorProps): SeparatorResult {
  const { orientation = 'horizontal' } = props;
  const root = document.createElement('div');
  root.setAttribute('role', 'separator');
  root.setAttribute('aria-orientation', orientation);
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'separator');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-orientation', orientation);
  if (props.class) root.className = props.class;

  return { element: root, dispose: () => {} };
}
export default Separator;
