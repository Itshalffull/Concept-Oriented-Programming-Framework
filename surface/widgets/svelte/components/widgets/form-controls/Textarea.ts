import { uid } from '../shared/uid.js';

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  autoResize?: boolean;
  label?: string;
  description?: string;
  error?: string;
  showCount?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

export interface TextareaInstance {
  element: HTMLElement;
  update(props: Partial<TextareaProps>): void;
  destroy(): void;
}

export function createTextarea(options: {
  target: HTMLElement;
  props: TextareaProps;
}): TextareaInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let state = 'idle';

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'textarea');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const textareaEl = document.createElement('textarea');
  textareaEl.setAttribute('data-part', 'input');
  textareaEl.id = id;
  root.appendChild(textareaEl);

  const footerEl = document.createElement('div');
  footerEl.setAttribute('data-part', 'footer');
  root.appendChild(footerEl);

  const descEl = document.createElement('span');
  descEl.setAttribute('data-part', 'description');
  footerEl.appendChild(descEl);

  const countEl = document.createElement('span');
  countEl.setAttribute('data-part', 'count');
  footerEl.appendChild(countEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  root.appendChild(errorEl);

  function handleInput() {
    currentProps.value = textareaEl.value;
    currentProps.onChange?.(textareaEl.value);
    if (currentProps.autoResize) {
      textareaEl.style.height = 'auto';
      textareaEl.style.height = textareaEl.scrollHeight + 'px';
    }
    sync();
  }
  textareaEl.addEventListener('input', handleInput);
  cleanups.push(() => textareaEl.removeEventListener('input', handleInput));

  textareaEl.addEventListener('focus', () => { state = 'focused'; sync(); });
  textareaEl.addEventListener('blur', () => { state = 'idle'; sync(); });

  function sync() {
    root.setAttribute('data-state', state);
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');

    textareaEl.value = currentProps.value ?? '';
    textareaEl.placeholder = currentProps.placeholder ?? '';
    textareaEl.disabled = currentProps.disabled ?? false;
    textareaEl.readOnly = currentProps.readOnly ?? false;
    if (currentProps.required) textareaEl.required = true;
    if (currentProps.rows) textareaEl.rows = currentProps.rows;
    if (currentProps.maxLength !== undefined) textareaEl.maxLength = currentProps.maxLength;
    if (currentProps.error) { textareaEl.setAttribute('aria-invalid', 'true'); textareaEl.setAttribute('aria-describedby', id + '-error'); }
    else { textareaEl.removeAttribute('aria-invalid'); }

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    descEl.textContent = currentProps.description ?? '';
    descEl.style.display = currentProps.description ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.id = id + '-error';
    errorEl.style.display = currentProps.error ? '' : 'none';

    if (currentProps.showCount) {
      const len = (currentProps.value ?? '').length;
      countEl.textContent = currentProps.maxLength ? len + '/' + currentProps.maxLength : String(len);
      countEl.style.display = '';
    } else {
      countEl.style.display = 'none';
    }

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createTextarea;
