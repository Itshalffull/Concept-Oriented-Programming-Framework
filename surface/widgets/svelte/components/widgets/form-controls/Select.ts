import { uid } from '../shared/uid.js';

export interface SelectProps {
  value?: string;
  options?: Array<{ label: string; value: string; disabled?: boolean; group?: string }>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
  className?: string;
}

export interface SelectInstance {
  element: HTMLElement;
  update(props: Partial<SelectProps>): void;
  destroy(): void;
}

export function createSelect(options: {
  target: HTMLElement;
  props: SelectProps;
}): SelectInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let highlightIdx = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'select');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const triggerEl = document.createElement('button');
  triggerEl.setAttribute('data-part', 'trigger');
  triggerEl.setAttribute('type', 'button');
  triggerEl.setAttribute('role', 'combobox');
  triggerEl.setAttribute('aria-haspopup', 'listbox');
  triggerEl.id = id;
  root.appendChild(triggerEl);

  const valueEl = document.createElement('span');
  valueEl.setAttribute('data-part', 'value-text');
  triggerEl.appendChild(valueEl);

  const arrowEl = document.createElement('span');
  arrowEl.setAttribute('data-part', 'arrow');
  arrowEl.textContent = '\u25be';
  triggerEl.appendChild(arrowEl);

  const listboxEl = document.createElement('ul');
  listboxEl.setAttribute('data-part', 'listbox');
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.id = id + '-listbox';
  root.appendChild(listboxEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  root.appendChild(errorEl);

  function selectOpt(v: string) {
    currentProps.value = v;
    open = false;
    highlightIdx = -1;
    currentProps.onChange?.(v);
    triggerEl.focus();
    sync();
  }

  triggerEl.addEventListener('click', () => { if (!currentProps.disabled) { open = !open; sync(); } });
  triggerEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const opts = (currentProps.options ?? []).filter(o => !o.disabled);
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { open = true; } highlightIdx = Math.min(highlightIdx + 1, opts.length - 1); sync(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open && highlightIdx >= 0 && opts[highlightIdx]) selectOpt(opts[highlightIdx].value); else { open = true; sync(); } }
    else if (e.key === 'Escape') { open = false; sync(); }
  }) as EventListener);
  document.addEventListener('click', (e) => { if (!root.contains(e.target as Node)) { open = false; sync(); } });

  function sync() {
    const opts = currentProps.options ?? [];
    const selectedOpt = opts.find(o => o.value === currentProps.value);

    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-invalid', currentProps.error ? 'true' : 'false');
    triggerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    triggerEl.setAttribute('aria-controls', id + '-listbox');
    triggerEl.disabled = currentProps.disabled ?? false;

    valueEl.textContent = selectedOpt ? selectedOpt.label : (currentProps.placeholder ?? 'Select...');
    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    listboxEl.innerHTML = '';
    listboxEl.style.display = open ? '' : 'none';
    opts.forEach((opt, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-part', 'option');
      li.setAttribute('aria-selected', currentProps.value === opt.value ? 'true' : 'false');
      li.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      li.setAttribute('data-disabled', opt.disabled ? 'true' : 'false');
      li.textContent = opt.label;
      if (!opt.disabled) li.addEventListener('mousedown', (e) => { e.preventDefault(); selectOpt(opt.value); });
      li.addEventListener('mouseenter', () => { highlightIdx = i; sync(); });
      listboxEl.appendChild(li);
    });

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

export default createSelect;
