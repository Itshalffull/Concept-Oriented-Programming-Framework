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


export interface FocusTrapProps {
  active?: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  loop?: boolean;
  children?: HTMLElement[];
  class?: string;
}

export interface FocusTrapResult { element: HTMLElement; dispose: () => void; }

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(el => !el.hasAttribute('data-focus-sentinel'));
}

export function FocusTrap(props: FocusTrapProps): FocusTrapResult {
  const { active = false, initialFocus, returnFocus = true, loop = true, children } = props;
  let previousFocus: Element | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'focus-trap');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', active ? 'active' : 'inactive');
  root.setAttribute('data-focus-trap', String(active));
  if (props.class) root.className = props.class;

  const sentinelStyle = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';

  const startSentinel = document.createElement('span');
  startSentinel.setAttribute('data-part', 'sentinel-start');
  startSentinel.setAttribute('data-focus-sentinel', '');
  startSentinel.tabIndex = active ? 0 : -1;
  startSentinel.setAttribute('aria-hidden', 'true');
  startSentinel.setAttribute('style', sentinelStyle);
  startSentinel.addEventListener('focus', () => {
    if (!active || !loop) return;
    const focusable = getFocusableElements(root);
    if (focusable.length > 0) focusable[focusable.length - 1].focus();
  });
  root.appendChild(startSentinel);

  if (children) children.forEach(c => root.appendChild(c));

  const endSentinel = document.createElement('span');
  endSentinel.setAttribute('data-part', 'sentinel-end');
  endSentinel.setAttribute('data-focus-sentinel', '');
  endSentinel.tabIndex = active ? 0 : -1;
  endSentinel.setAttribute('aria-hidden', 'true');
  endSentinel.setAttribute('style', sentinelStyle);
  endSentinel.addEventListener('focus', () => {
    if (!active || !loop) return;
    const focusable = getFocusableElements(root);
    if (focusable.length > 0) focusable[0].focus();
  });
  root.appendChild(endSentinel);

  if (active) {
    previousFocus = document.activeElement;
    requestAnimationFrame(() => {
      if (initialFocus) {
        const target = root.querySelector<HTMLElement>(initialFocus);
        if (target) { target.focus(); return; }
      }
      const focusable = getFocusableElements(root);
      if (focusable.length > 0) focusable[0].focus();
    });
  }

  function dispose() {
    if (returnFocus && previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  return { element: root, dispose };
}
export default FocusTrap;
