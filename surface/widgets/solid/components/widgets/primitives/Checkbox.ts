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


export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: string;
  onChange?: (checked: boolean) => void;
  class?: string;
}

export interface CheckboxResult { element: HTMLElement; dispose: () => void; }

export function Checkbox(props: CheckboxProps): CheckboxResult {
  const {
    checked = false, indeterminate = false, disabled = false,
    required = false, value = '', name, label, onChange
  } = props;
  const [isChecked, setIsChecked] = solidCreateSignal(checked);
  const [focused, setFocused] = solidCreateSignal(false);
  const id = name || uid();
  const labelId = id + '-label';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'checkbox');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-disabled', String(disabled));
  if (props.class) root.className = props.class;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.setAttribute('role', 'checkbox');
  input.checked = checked;
  input.disabled = disabled;
  input.required = required;
  input.value = value;
  if (name) input.name = name;
  input.setAttribute('aria-required', String(required));
  input.setAttribute('aria-disabled', String(disabled));
  if (label) input.setAttribute('aria-labelledby', labelId);
  input.tabIndex = disabled ? -1 : 0;
  input.setAttribute('data-part', 'input');
  Object.assign(input.style, { position: 'absolute', opacity: '0', width: '0', height: '0', margin: '0' });
  if (indeterminate) input.indeterminate = true;
  root.appendChild(input);

  const control = document.createElement('span');
  control.setAttribute('data-part', 'control');
  control.setAttribute('aria-hidden', 'true');
  const indicator = document.createElement('span');
  indicator.setAttribute('data-part', 'indicator');
  indicator.setAttribute('aria-hidden', 'true');
  control.appendChild(indicator);
  root.appendChild(control);

  if (label) {
    const lbl = document.createElement('label');
    lbl.id = labelId;
    lbl.setAttribute('for', id);
    lbl.setAttribute('data-part', 'label');
    lbl.setAttribute('data-disabled', String(disabled));
    lbl.textContent = label;
    root.appendChild(lbl);
  }

  function toggle() {
    if (disabled) return;
    const next = !isChecked();
    setIsChecked(next);
    input.checked = next;
    onChange?.(next);
  }

  root.addEventListener('click', toggle);
  input.addEventListener('focus', () => setFocused(true));
  input.addEventListener('blur', () => setFocused(false));

  const dispose = solidCreateEffect([isChecked, focused], () => {
    const c = isChecked();
    const dataState = indeterminate ? 'indeterminate' : c ? 'checked' : 'unchecked';
    const ariaChecked = indeterminate ? 'mixed' : c ? 'true' : 'false';
    root.setAttribute('data-state', dataState);
    input.setAttribute('aria-checked', ariaChecked);
    control.setAttribute('data-state', dataState);
    control.setAttribute('data-focused', String(focused()));
    control.setAttribute('data-disabled', String(disabled));
    indicator.setAttribute('data-state', dataState);
    indicator.setAttribute('data-visible', String(c || indeterminate));
  });

  return { element: root, dispose };
}
export default Checkbox;
