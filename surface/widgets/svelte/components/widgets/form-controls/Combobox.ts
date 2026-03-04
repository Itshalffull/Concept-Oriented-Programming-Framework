import { uid } from '../shared/uid.js';

export interface ComboboxProps {
  value?: string;
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  allowCustom?: boolean;
  onChange?: (value: string) => void;
  onInputChange?: (query: string) => void;
  className?: string;
}

export interface ComboboxInstance {
  element: HTMLElement;
  update(props: Partial<ComboboxProps>): void;
  destroy(): void;
}

export function createCombobox(options: {
  target: HTMLElement;
  props: ComboboxProps;
}): ComboboxInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let query = '';
  let highlightIdx = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'combobox');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const controlEl = document.createElement('div');
  controlEl.setAttribute('data-part', 'control');
  root.appendChild(controlEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.type = 'text';
  inputEl.id = id;
  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-expanded', 'false');
  controlEl.appendChild(inputEl);

  const triggerEl = document.createElement('button');
  triggerEl.setAttribute('data-part', 'trigger');
  triggerEl.setAttribute('type', 'button');
  triggerEl.setAttribute('aria-label', 'Toggle');
  triggerEl.setAttribute('tabindex', '-1');
  triggerEl.textContent = '\u25be';
  controlEl.appendChild(triggerEl);

  const listboxEl = document.createElement('ul');
  listboxEl.setAttribute('data-part', 'listbox');
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.id = id + '-listbox';
  root.appendChild(listboxEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  root.appendChild(errorEl);

  function getFiltered() {
    const opts = currentProps.options ?? [];
    if (!query) return opts;
    const q = query.toLowerCase();
    return opts.filter(o => o.label.toLowerCase().includes(q));
  }

  function selectOption(val: string) {
    currentProps.value = val;
    const opt = (currentProps.options ?? []).find(o => o.value === val);
    inputEl.value = opt ? opt.label : val;
    query = '';
    open = false;
    highlightIdx = -1;
    currentProps.onChange?.(val);
    sync();
  }

  function handleInput() {
    query = inputEl.value;
    open = true;
    highlightIdx = -1;
    currentProps.onInputChange?.(query);
    sync();
  }
  inputEl.addEventListener('input', handleInput);
  cleanups.push(() => inputEl.removeEventListener('input', handleInput));

  function handleFocus() { open = true; sync(); }
  inputEl.addEventListener('focus', handleFocus);
  cleanups.push(() => inputEl.removeEventListener('focus', handleFocus));

  function handleKeydown(e: KeyboardEvent) {
    const filtered = getFiltered();
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, filtered.length - 1); open = true; sync(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) { e.preventDefault(); selectOption(filtered[highlightIdx].value); }
    else if (e.key === 'Escape') { open = false; highlightIdx = -1; sync(); }
  }
  inputEl.addEventListener('keydown', handleKeydown as EventListener);
  cleanups.push(() => inputEl.removeEventListener('keydown', handleKeydown as EventListener));

  function handleTriggerClick() { if (!currentProps.disabled) { open = !open; if (open) inputEl.focus(); sync(); } }
  triggerEl.addEventListener('click', handleTriggerClick);
  cleanups.push(() => triggerEl.removeEventListener('click', handleTriggerClick));

  function handleOutsideClick(e: MouseEvent) { if (!root.contains(e.target as Node)) { open = false; highlightIdx = -1; sync(); } }
  document.addEventListener('click', handleOutsideClick);
  cleanups.push(() => document.removeEventListener('click', handleOutsideClick));

  function sync() {
    const filtered = getFiltered();
    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    inputEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    inputEl.setAttribute('aria-controls', id + '-listbox');
    inputEl.disabled = currentProps.disabled ?? false;
    inputEl.placeholder = currentProps.placeholder ?? '';

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    listboxEl.innerHTML = '';
    listboxEl.style.display = open ? '' : 'none';
    filtered.forEach((opt, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-part', 'option');
      li.setAttribute('aria-selected', currentProps.value === opt.value ? 'true' : 'false');
      li.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      li.setAttribute('data-disabled', opt.disabled ? 'true' : 'false');
      li.textContent = opt.label;
      if (!opt.disabled) {
        li.addEventListener('mousedown', (e) => { e.preventDefault(); selectOption(opt.value); });
      }
      li.addEventListener('mouseenter', () => { highlightIdx = i; sync(); });
      listboxEl.appendChild(li);
    });

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';
  }

  if (currentProps.value) {
    const opt = (currentProps.options ?? []).find(o => o.value === currentProps.value);
    if (opt) inputEl.value = opt.label;
  }
  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createCombobox;
