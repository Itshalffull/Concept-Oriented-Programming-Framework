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


export interface InlineEditProps {
  [key: string]: unknown;
  class?: string;
  children?: HTMLElement[];
}

export interface InlineEditResult { element: HTMLElement; dispose: () => void; }

export function InlineEdit(props: InlineEditProps): InlineEditResult {
  const [state, setState] = solidCreateSignal<string>('idle');
  const disposers: Array<() => void> = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'inline-edit');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', 'idle');
  if (props.class) root.className = props.class as string;

  if (props.children) {
    (props.children as HTMLElement[]).forEach(c => root.appendChild(c));
  }

  
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', (props.ariaLabel as string) || 'Editable field');
  root.setAttribute('aria-roledescription', 'inline editor');
  root.setAttribute('data-disabled', String(!!props.disabled));
  const display = document.createElement('div');
  display.setAttribute('role', 'button');
  display.setAttribute('data-part', 'display');
  display.setAttribute('data-visible', 'true');
  display.tabIndex = props.disabled ? -1 : 0;
  display.textContent = String(props.value || props.placeholder || 'Click to edit');
  root.appendChild(display);
  display.addEventListener('click', () => {
    if (props.disabled) return;
    setState('editing');
    display.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-part', 'input');
    input.value = String(props.value || '');
    input.setAttribute('aria-label', (props.ariaLabel as string) || 'Editable field');
    root.appendChild(input);
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (typeof props.onConfirm === 'function') (props.onConfirm as (v: string) => void)(input.value);
        setState('displaying');
        input.remove();
        display.textContent = input.value || String(props.placeholder || 'Click to edit');
        display.style.display = '';
      }
      if (e.key === 'Escape') {
        setState('displaying');
        input.remove();
        display.style.display = '';
      }
    });
  });
  setState('displaying');

  disposers.push(solidCreateEffect([state], () => {
    root.setAttribute('data-state', state());
  }));

  function dispose() {
    disposers.forEach(d => d());
    root.remove();
  }

  return { element: root, dispose };
}
export default InlineEdit;
