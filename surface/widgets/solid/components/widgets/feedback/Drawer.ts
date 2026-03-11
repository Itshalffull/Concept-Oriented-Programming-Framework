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


export interface DrawerProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface DrawerResult { element: HTMLElement; dispose: () => void; }

export function Drawer(props: DrawerProps): DrawerResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'drawer');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  const placement = (props.placement as string) || 'right';
  const drawerSize = (props.size as string) || 'md';
  root.setAttribute('data-placement', placement);
  if (props.open) {
    const backdrop = document.createElement('div');
    backdrop.setAttribute('data-part', 'backdrop');
    backdrop.setAttribute('data-state', 'open');
    backdrop.setAttribute('data-placement', placement);
    const content = document.createElement('div');
    content.setAttribute('data-part', 'content');
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('data-state', 'open');
    content.setAttribute('data-placement', placement);
    content.setAttribute('data-size', drawerSize);
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-part', 'close-trigger');
    closeBtn.setAttribute('aria-label', 'Close drawer');
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => {
      if (typeof props.onOpenChange === 'function') (props.onOpenChange as (o: boolean) => void)(false);
    });
    header.appendChild(closeBtn);
    content.appendChild(header);
    const body = document.createElement('div');
    body.setAttribute('data-part', 'body');
    body.tabIndex = 0;
    body.setAttribute('role', 'document');
    content.appendChild(body);
    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    disposers.push(() => backdrop.remove());
    setState('open');
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
export default Drawer;
