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


export interface VisuallyHiddenProps {
  text?: string;
  class?: string;
}

export interface VisuallyHiddenResult { element: HTMLElement; dispose: () => void; }

export function VisuallyHidden(props: VisuallyHiddenProps): VisuallyHiddenResult {
  const { text = '' } = props;
  const root = document.createElement('span');
  Object.assign(root.style, {
    position: 'absolute', width: '1px', height: '1px', padding: '0',
    margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap', border: '0'
  });
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'visually-hidden');
  root.setAttribute('data-part', 'root');
  root.textContent = text;
  if (props.class) root.className = props.class;

  return { element: root, dispose: () => {} };
}
export default VisuallyHidden;
