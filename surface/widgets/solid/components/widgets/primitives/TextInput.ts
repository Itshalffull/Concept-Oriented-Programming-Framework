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


export interface TextInputProps {
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  pattern?: string;
  name?: string;
  autocomplete?: string;
  label?: string;
  description?: string;
  error?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  class?: string;
}

export interface TextInputResult { element: HTMLElement; dispose: () => void; }

export function TextInput(props: TextInputProps): TextInputResult {
  const {
    value = '', placeholder = '', required = false, disabled = false,
    readOnly = false, maxLength, pattern, name, autocomplete,
    label, description, error, onChange, onClear
  } = props;
  const [isFocused, setIsFocused] = solidCreateSignal(false);
  const [currentValue, setCurrentValue] = solidCreateSignal(value);

  const id = name || uid();
  const descriptionId = id + '-description';
  const errorId = id + '-error';
  const labelId = id + '-label';
  const isInvalid = !!error;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'text-input');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-invalid', String(isInvalid));
  if (props.class) root.className = props.class;

  if (label) {
    const lbl = document.createElement('label');
    lbl.id = labelId;
    lbl.setAttribute('for', id);
    lbl.setAttribute('data-part', 'label');
    lbl.setAttribute('data-required', String(required));
    lbl.textContent = label;
    root.appendChild(lbl);
  }

  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.setAttribute('role', 'textbox');
  input.value = value;
  input.placeholder = placeholder;
  input.disabled = disabled;
  input.readOnly = readOnly;
  input.required = required;
  if (maxLength !== undefined) input.maxLength = maxLength;
  if (pattern) input.pattern = pattern;
  if (name) input.name = name;
  if (autocomplete) input.autocomplete = autocomplete;
  input.setAttribute('aria-invalid', String(isInvalid));
  input.setAttribute('aria-required', String(required));
  input.setAttribute('aria-disabled', String(disabled));
  input.setAttribute('aria-readonly', String(readOnly));
  if (label) input.setAttribute('aria-labelledby', labelId);
  if (isInvalid) input.setAttribute('aria-describedby', errorId);
  else if (description) input.setAttribute('aria-describedby', descriptionId);
  input.setAttribute('data-part', 'input');
  root.appendChild(input);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.setAttribute('data-part', 'clear-button');
  clearBtn.setAttribute('role', 'button');
  clearBtn.setAttribute('aria-label', 'Clear input');
  clearBtn.tabIndex = -1;
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', () => {
    input.value = '';
    setCurrentValue('');
    onChange?.('');
    onClear?.();
  });
  root.appendChild(clearBtn);

  if (description) {
    const desc = document.createElement('span');
    desc.id = descriptionId;
    desc.setAttribute('data-part', 'description');
    desc.textContent = description;
    root.appendChild(desc);
  }

  if (error) {
    const err = document.createElement('span');
    err.id = errorId;
    err.setAttribute('data-part', 'error');
    err.setAttribute('role', 'alert');
    err.setAttribute('aria-live', 'polite');
    err.setAttribute('data-visible', String(isInvalid));
    err.textContent = error;
    root.appendChild(err);
  }

  input.addEventListener('input', () => {
    setCurrentValue(input.value);
    onChange?.(input.value);
  });
  input.addEventListener('focus', () => setIsFocused(true));
  input.addEventListener('blur', () => setIsFocused(false));
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; setCurrentValue(''); onChange?.(''); onClear?.(); } });

  const dispose = solidCreateEffect([isFocused, currentValue], () => {
    const rootState = disabled ? 'disabled' : readOnly ? 'readonly' : 'default';
    root.setAttribute('data-state', rootState);
    root.setAttribute('data-focus', String(isFocused()));
    const filled = currentValue().length > 0;
    clearBtn.style.display = filled && !disabled && !readOnly ? '' : 'none';
    clearBtn.setAttribute('data-visible', String(filled));
  });

  return { element: root, dispose };
}
export default TextInput;
