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


export interface ScrollLockProps {
  active?: boolean;
  preserveScrollbarGap?: boolean;
  children?: HTMLElement[];
  class?: string;
}

export interface ScrollLockResult { element: HTMLElement; dispose: () => void; }

export function ScrollLock(props: ScrollLockProps): ScrollLockResult {
  const { active = false, preserveScrollbarGap = true, children } = props;
  let scrollPos = 0;
  let origOverflow = '';
  let origPadding = '';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'scroll-lock');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', active ? 'locked' : 'unlocked');
  root.setAttribute('data-scroll-lock', String(active));
  root.setAttribute('data-preserve-gap', String(preserveScrollbarGap));
  if (props.class) root.className = props.class;

  if (children) children.forEach(c => root.appendChild(c));

  if (active) {
    scrollPos = window.scrollY;
    origOverflow = document.body.style.overflow;
    origPadding = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (preserveScrollbarGap) {
      const w = window.innerWidth - document.documentElement.clientWidth;
      if (w > 0) document.body.style.paddingRight = w + 'px';
    }
  }

  function dispose() {
    if (active) {
      document.body.style.overflow = origOverflow;
      document.body.style.paddingRight = origPadding;
      window.scrollTo(0, scrollPos);
    }
  }

  return { element: root, dispose };
}
export default ScrollLock;
