import { uid } from '../shared/uid.js';

export interface NumberInputProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  error?: string;
  onChange?: (value: number) => void;
  className?: string;
}

export interface NumberInputInstance {
  element: HTMLElement;
  update(props: Partial<NumberInputProps>): void;
  destroy(): void;
}

export function createNumberInput(options: {
  target: HTMLElement;
  props: NumberInputProps;
}): NumberInputInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'number-input');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const controlEl = document.createElement('div');
  controlEl.setAttribute('data-part', 'control');
  root.appendChild(controlEl);

  const decBtn = document.createElement('button');
  decBtn.setAttribute('data-part', 'decrement');
  decBtn.setAttribute('type', 'button');
  decBtn.setAttribute('aria-label', 'Decrease');
  decBtn.textContent = '-';
  controlEl.appendChild(decBtn);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.type = 'number';
  inputEl.id = id;
  inputEl.setAttribute('role', 'spinbutton');
  controlEl.appendChild(inputEl);

  const incBtn = document.createElement('button');
  incBtn.setAttribute('data-part', 'increment');
  incBtn.setAttribute('type', 'button');
  incBtn.setAttribute('aria-label', 'Increase');
  incBtn.textContent = '+';
  controlEl.appendChild(incBtn);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  root.appendChild(errorEl);

  function clamp(v: number): number {
    if (currentProps.min !== undefined) v = Math.max(v, currentProps.min);
    if (currentProps.max !== undefined) v = Math.min(v, currentProps.max);
    return v;
  }

  function setValue(v: number) {
    v = clamp(v);
    currentProps.value = v;
    currentProps.onChange?.(v);
    sync();
  }

  incBtn.addEventListener('click', () => { if (!currentProps.disabled) setValue((currentProps.value ?? 0) + (currentProps.step ?? 1)); });
  decBtn.addEventListener('click', () => { if (!currentProps.disabled) setValue((currentProps.value ?? 0) - (currentProps.step ?? 1)); });
  inputEl.addEventListener('change', () => { setValue(parseFloat(inputEl.value) || 0); });
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setValue((currentProps.value ?? 0) + (currentProps.step ?? 1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setValue((currentProps.value ?? 0) - (currentProps.step ?? 1)); }
  }) as EventListener);

  function sync() {
    const v = currentProps.value ?? 0;
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    inputEl.value = String(v);
    inputEl.disabled = currentProps.disabled ?? false;
    if (currentProps.min !== undefined) { inputEl.min = String(currentProps.min); inputEl.setAttribute('aria-valuemin', String(currentProps.min)); }
    if (currentProps.max !== undefined) { inputEl.max = String(currentProps.max); inputEl.setAttribute('aria-valuemax', String(currentProps.max)); }
    inputEl.setAttribute('aria-valuenow', String(v));
    if (currentProps.step) inputEl.step = String(currentProps.step);
    decBtn.disabled = currentProps.disabled || (currentProps.min !== undefined && v <= currentProps.min) || false;
    incBtn.disabled = currentProps.disabled || (currentProps.max !== undefined && v >= currentProps.max) || false;
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';
    if (currentProps.className) root.className = currentProps.className; else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createNumberInput;
