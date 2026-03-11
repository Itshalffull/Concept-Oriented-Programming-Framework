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


export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
  class?: string;
}

export interface AvatarResult { element: HTMLElement; dispose: () => void; }

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0] || '').join('').toUpperCase().slice(0, 2);
}

export function Avatar(props: AvatarProps): AvatarResult {
  const { src, name = '', size = 'md', delayMs = 0 } = props;
  const [state, setState] = solidCreateSignal<string>('loading');

  const root = document.createElement('div');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', name);
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'avatar');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-size', size);
  if (props.class) root.className = props.class;

  const img = document.createElement('img');
  img.setAttribute('data-part', 'image');
  img.alt = name;
  if (src) {
    img.src = src;
    img.style.display = 'none';
    img.setAttribute('data-visible', 'false');
    img.addEventListener('load', () => {
      if (delayMs > 0) setTimeout(() => setState('loaded'), delayMs);
      else setState('loaded');
    });
    img.addEventListener('error', () => setState('error'));
    root.appendChild(img);
  } else {
    setState('error');
  }

  const fallback = document.createElement('span');
  fallback.setAttribute('data-part', 'fallback');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.textContent = getInitials(name);
  root.appendChild(fallback);

  const dispose = solidCreateEffect([state], () => {
    const s = state();
    root.setAttribute('data-state', s);
    const loaded = s === 'loaded';
    img.style.display = loaded ? '' : 'none';
    img.setAttribute('data-visible', String(loaded));
    fallback.style.display = loaded ? 'none' : '';
    fallback.setAttribute('data-visible', String(!loaded));
  });

  return { element: root, dispose };
}
export default Avatar;
