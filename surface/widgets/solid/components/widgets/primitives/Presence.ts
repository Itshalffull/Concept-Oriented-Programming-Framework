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


export interface PresenceProps {
  present?: boolean;
  animateOnMount?: boolean;
  forceMount?: boolean;
  children?: HTMLElement[];
  class?: string;
}

export interface PresenceResult { element: HTMLElement; dispose: () => void; }

export function Presence(props: PresenceProps): PresenceResult {
  const { present = false, animateOnMount = false, forceMount = false, children } = props;
  const [state, setState] = solidCreateSignal<string>(
    present ? (animateOnMount ? 'mounting' : 'mounted') : 'unmounted'
  );

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'presence');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-present', String(present));
  root.setAttribute('data-animate-mount', String(animateOnMount));
  root.setAttribute('data-force-mount', String(forceMount));
  if (props.class) root.className = props.class;

  if (children) children.forEach(c => root.appendChild(c));

  root.addEventListener('animationend', () => setState(present ? 'mounted' : 'unmounted'));
  root.addEventListener('transitionend', () => setState(present ? 'mounted' : 'unmounted'));

  const dispose = solidCreateEffect([state], () => {
    const s = state();
    const dataState = s === 'mounting' ? 'mounting' : s === 'mounted' ? 'mounted' :
                      s === 'unmounting' ? 'unmounting' : 'unmounted';
    root.setAttribute('data-state', dataState);
    const shouldRender = forceMount || s !== 'unmounted';
    root.style.display = shouldRender ? '' : 'none';
  });

  return { element: root, dispose };
}
export default Presence;
