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


export interface FileBrowserProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface FileBrowserResult { element: HTMLElement; dispose: () => void; }

export function FileBrowser(props: FileBrowserProps): FileBrowserResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'file-browser');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'File browser');
  root.setAttribute('data-view', (props.viewMode as string) || 'grid');
  const toolbar = document.createElement('div');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'File actions');
  toolbar.setAttribute('data-part', 'toolbar');
  root.appendChild(toolbar);
  const content = document.createElement('div');
  content.setAttribute('role', 'grid');
  content.setAttribute('aria-label', 'Files and folders');
  content.setAttribute('data-part', 'content');
  root.appendChild(content);

  disposers.push(solidCreateEffect([state], () => {
    root.setAttribute('data-state', state());
  }));

  function dispose() {
    disposers.forEach(d => d());
    root.remove();
  }

  return { element: root, dispose };
}
export default FileBrowser;
