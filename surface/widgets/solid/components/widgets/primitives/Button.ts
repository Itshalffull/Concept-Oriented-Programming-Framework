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


export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconPosition?: 'start' | 'end';
  label?: string;
  onClick?: () => void;
  class?: string;
}

export interface ButtonResult { element: HTMLElement; dispose: () => void; }

export function Button(props: ButtonProps): ButtonResult {
  const {
    variant = 'filled', size = 'md', disabled = false, loading = false,
    type = 'button', iconPosition = 'start', label = '', onClick
  } = props;
  const [state, setState] = solidCreateSignal<string>('idle');

  const btn = document.createElement('button');
  btn.type = type;
  btn.disabled = disabled || loading;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-disabled', String(disabled || loading));
  btn.setAttribute('aria-busy', String(loading));
  btn.tabIndex = disabled ? -1 : 0;
  btn.setAttribute('data-surface-widget', '');
  btn.setAttribute('data-widget-name', 'button');
  btn.setAttribute('data-part', 'root');
  btn.setAttribute('data-variant', variant);
  btn.setAttribute('data-size', size);
  if (props.class) btn.className = props.class;

  const spinner = document.createElement('span');
  spinner.setAttribute('data-part', 'spinner');
  spinner.setAttribute('aria-hidden', String(!loading));
  spinner.setAttribute('data-visible', String(loading));
  if (!loading) spinner.style.display = 'none';
  btn.appendChild(spinner);

  const icon = document.createElement('span');
  icon.setAttribute('data-part', 'icon');
  icon.setAttribute('data-position', iconPosition);
  icon.setAttribute('aria-hidden', 'true');
  btn.appendChild(icon);

  const labelSpan = document.createElement('span');
  labelSpan.setAttribute('data-part', 'label');
  labelSpan.setAttribute('data-size', size);
  labelSpan.textContent = label;
  btn.appendChild(labelSpan);

  btn.addEventListener('click', () => { if (!disabled && !loading) onClick?.(); });
  btn.addEventListener('mouseenter', () => setState('hovered'));
  btn.addEventListener('mouseleave', () => setState('idle'));
  btn.addEventListener('focus', () => setState('focused'));
  btn.addEventListener('blur', () => setState('idle'));
  btn.addEventListener('pointerdown', () => setState('pressed'));
  btn.addEventListener('pointerup', () => setState('idle'));

  const dispose = solidCreateEffect([state], () => {
    const dataState = loading ? 'loading' : disabled ? 'disabled' : state();
    btn.setAttribute('data-state', dataState);
  });

  return { element: btn, dispose };
}
export default Button;
