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


export interface BadgeProps {
  label?: string;
  variant?: 'filled' | 'outline' | 'dot';
  color?: string;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export interface BadgeResult { element: HTMLElement; dispose: () => void; }

export function Badge(props: BadgeProps): BadgeResult {
  const { label, variant = 'filled', color, max, size = 'md' } = props;
  const isDot = variant === 'dot';

  let resolvedLabel = '';
  if (!isDot) {
    if (max !== undefined && label !== undefined) {
      const num = Number(label);
      if (!Number.isNaN(num) && num > max) resolvedLabel = max + '+';
      else resolvedLabel = label;
    } else resolvedLabel = label ?? '';
  }

  const ariaLabelText = label ? label : isDot ? 'Status indicator' : 'Badge';

  const root = document.createElement('span');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', ariaLabelText);
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'badge');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', isDot ? 'dot' : 'static');
  root.setAttribute('data-variant', variant);
  root.setAttribute('data-size', size);
  if (color) root.setAttribute('data-color', color);
  if (props.class) root.className = props.class;

  if (!isDot) {
    const lbl = document.createElement('span');
    lbl.setAttribute('data-part', 'label');
    lbl.setAttribute('aria-hidden', String(isDot));
    lbl.textContent = resolvedLabel;
    root.appendChild(lbl);
  }

  return { element: root, dispose: () => {} };
}
export default Badge;
