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


export interface LabelProps {
  text?: string;
  htmlFor?: string;
  required?: boolean;
  class?: string;
}

export interface LabelResult { element: HTMLElement; dispose: () => void; }

export function Label(props: LabelProps): LabelResult {
  const { text = '', htmlFor, required = false } = props;
  const root = document.createElement('label');
  if (htmlFor) root.setAttribute('for', htmlFor);
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'label');
  root.setAttribute('data-part', 'root');
  if (props.class) root.className = props.class;
  root.textContent = text;

  const reqIndicator = document.createElement('span');
  reqIndicator.setAttribute('data-part', 'required-indicator');
  reqIndicator.setAttribute('data-visible', String(required));
  reqIndicator.setAttribute('aria-hidden', 'true');
  reqIndicator.textContent = required ? ' *' : '';
  root.appendChild(reqIndicator);

  return { element: root, dispose: () => {} };
}
export default Label;
