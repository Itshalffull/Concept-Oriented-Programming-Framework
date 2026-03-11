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


export interface IconProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
  class?: string;
}

export interface IconResult { element: HTMLElement; dispose: () => void; }

export function Icon(props: IconProps): IconResult {
  const { name = '', size = 'md', decorative = true, label } = props;
  const root = document.createElement('span');
  root.setAttribute('role', decorative ? 'presentation' : 'img');
  root.setAttribute('aria-hidden', String(decorative));
  if (!decorative && label) root.setAttribute('aria-label', label);
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'icon');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-icon', name);
  root.setAttribute('data-size', size);
  if (props.class) root.className = props.class;

  return { element: root, dispose: () => {} };
}
export default Icon;
