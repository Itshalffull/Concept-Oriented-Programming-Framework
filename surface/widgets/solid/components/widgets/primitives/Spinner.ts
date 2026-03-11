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


export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  trackVisible?: boolean;
  class?: string;
}

export interface SpinnerResult { element: HTMLElement; dispose: () => void; }

export function Spinner(props: SpinnerProps): SpinnerResult {
  const { size = 'md', label, trackVisible = true } = props;
  const accessibleLabel = label || 'Loading';

  const root = document.createElement('div');
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-label', accessibleLabel);
  root.setAttribute('aria-busy', 'true');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'spinner');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-size', size);
  if (props.class) root.className = props.class;

  const track = document.createElement('span');
  track.setAttribute('data-part', 'track');
  track.setAttribute('data-visible', String(trackVisible));
  track.setAttribute('aria-hidden', 'true');
  root.appendChild(track);

  const indicator = document.createElement('span');
  indicator.setAttribute('data-part', 'indicator');
  indicator.setAttribute('aria-hidden', 'true');
  root.appendChild(indicator);

  if (label) {
    const lbl = document.createElement('span');
    lbl.setAttribute('data-part', 'label');
    lbl.setAttribute('data-visible', 'true');
    lbl.textContent = label;
    root.appendChild(lbl);
  }

  return { element: root, dispose: () => {} };
}
export default Spinner;
