import { uid } from '../shared/uid.js';

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
  prefix?: string | HTMLElement;
  suffix?: string | HTMLElement;
  onChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export interface TextInputInstance {
  element: HTMLElement;
  update(props: Partial<TextInputProps>): void;
  destroy(): void;
}

export function createTextInput(options: {
  target: HTMLElement;
  props: TextInputProps;
}): TextInputInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let state = 'idle';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'text-input');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-part', 'input-wrapper');
  root.appendChild(wrapper);

  const prefixEl = document.createElement('span');
  prefixEl.setAttribute('data-part', 'prefix');
  prefixEl.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(prefixEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.type = 'text';
  inputEl.id = id;
  wrapper.appendChild(inputEl);

  const suffixEl = document.createElement('span');
  suffixEl.setAttribute('data-part', 'suffix');
  suffixEl.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(suffixEl);

  const clearBtn = document.createElement('button');
  clearBtn.setAttribute('data-part', 'clear-button');
  clearBtn.setAttribute('type', 'button');
  clearBtn.setAttribute('aria-label', 'Clear input');
  clearBtn.textContent = '\u00d7';
  wrapper.appendChild(clearBtn);

  const descEl = document.createElement('span');
  descEl.setAttribute('data-part', 'description');
  root.appendChild(descEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  root.appendChild(errorEl);

  function handleInput() { currentProps.value = inputEl.value; currentProps.onChange?.(inputEl.value); sync(); }
  inputEl.addEventListener('input', handleInput);
  cleanups.push(() => inputEl.removeEventListener('input', handleInput));

  function handleClear() { currentProps.value = ''; inputEl.value = ''; currentProps.onClear?.(); currentProps.onChange?.(''); inputEl.focus(); sync(); }
  clearBtn.addEventListener('click', handleClear);
  cleanups.push(() => clearBtn.removeEventListener('click', handleClear));

  function handleFocus() { state = 'focused'; sync(); }
  function handleBlur() { state = 'idle'; sync(); }
  inputEl.addEventListener('focus', handleFocus);
  inputEl.addEventListener('blur', handleBlur);
  cleanups.push(() => { inputEl.removeEventListener('focus', handleFocus); inputEl.removeEventListener('blur', handleBlur); });

  function setSlot(el: HTMLElement, c?: string | HTMLElement) {
    el.innerHTML = '';
    if (typeof c === 'string') el.textContent = c;
    else if (c instanceof HTMLElement) el.appendChild(c);
  }

  function sync() {
    root.setAttribute('data-state', state);
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    inputEl.value = currentProps.value ?? '';
    inputEl.placeholder = currentProps.placeholder ?? '';
    inputEl.disabled = currentProps.disabled ?? false;
    inputEl.readOnly = currentProps.readOnly ?? false;
    if (currentProps.required) inputEl.required = true;
    if (currentProps.maxLength !== undefined) inputEl.maxLength = currentProps.maxLength;
    if (currentProps.pattern) inputEl.pattern = currentProps.pattern;
    if (currentProps.name) inputEl.name = currentProps.name;
    if (currentProps.autocomplete) inputEl.autocomplete = currentProps.autocomplete;
    if (currentProps.error) { inputEl.setAttribute('aria-invalid', 'true'); inputEl.setAttribute('aria-describedby', id + '-error'); }
    else { inputEl.removeAttribute('aria-invalid'); inputEl.removeAttribute('aria-describedby'); }
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    setSlot(prefixEl, currentProps.prefix); prefixEl.style.display = currentProps.prefix ? '' : 'none';
    setSlot(suffixEl, currentProps.suffix); suffixEl.style.display = currentProps.suffix ? '' : 'none';
    clearBtn.style.display = currentProps.value ? '' : 'none';
    descEl.textContent = currentProps.description ?? ''; descEl.style.display = currentProps.description ? '' : 'none';
    errorEl.textContent = currentProps.error ?? ''; errorEl.id = id + '-error'; errorEl.style.display = currentProps.error ? '' : 'none';
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

export default createTextInput;
