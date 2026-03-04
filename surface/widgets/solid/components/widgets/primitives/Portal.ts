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


export interface PortalProps {
  target?: string;
  disabled?: boolean;
  children?: HTMLElement[];
  class?: string;
}

export interface PortalResult { element: HTMLElement; dispose: () => void; }

export function Portal(props: PortalProps): PortalResult {
  const { target, disabled = false, children } = props;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'portal');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-portal', 'true');
  if (target) root.setAttribute('data-target', target);
  root.setAttribute('data-disabled', String(disabled));
  if (props.class) root.className = props.class;

  if (children) children.forEach(c => root.appendChild(c));

  if (!disabled) {
    const container = target ? (document.querySelector(target) || document.body) : document.body;
    container.appendChild(root);
    root.setAttribute('data-state', 'mounted');
  } else {
    root.setAttribute('data-state', 'unmounted');
  }

  function dispose() { root.remove(); }
  return { element: root, dispose };
}
export default Portal;
