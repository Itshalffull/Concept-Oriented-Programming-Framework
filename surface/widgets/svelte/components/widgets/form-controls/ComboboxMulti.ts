import { uid } from '../shared/uid.js';

export interface ComboboxMultiProps {
  value?: string[];
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  max?: number;
  onChange?: (value: string[]) => void;
  onInputChange?: (query: string) => void;
  className?: string;
}

export interface ComboboxMultiInstance {
  element: HTMLElement;
  update(props: Partial<ComboboxMultiProps>): void;
  destroy(): void;
}

export function createComboboxMulti(options: {
  target: HTMLElement;
  props: ComboboxMultiProps;
}): ComboboxMultiInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let query = '';
  let highlightIdx = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'combobox-multi');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  labelEl.setAttribute('for', id);
  root.appendChild(labelEl);

  const controlEl = document.createElement('div');
  controlEl.setAttribute('data-part', 'control');
  root.appendChild(controlEl);

  const tagsEl = document.createElement('div');
  tagsEl.setAttribute('data-part', 'tags');
  controlEl.appendChild(tagsEl);

  const inputEl = document.createElement('input');
  inputEl.setAttribute('data-part', 'input');
  inputEl.type = 'text';
  inputEl.id = id;
  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-autocomplete', 'list');
  controlEl.appendChild(inputEl);

  const listboxEl = document.createElement('ul');
  listboxEl.setAttribute('data-part', 'listbox');
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.setAttribute('aria-multiselectable', 'true');
  listboxEl.id = id + '-listbox';
  root.appendChild(listboxEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  root.appendChild(errorEl);

  function getFiltered() {
    const opts = currentProps.options ?? [];
    if (!query) return opts;
    const q = query.toLowerCase();
    return opts.filter(o => o.label.toLowerCase().includes(q));
  }

  function toggleOption(val: string) {
    const vals = [...(currentProps.value ?? [])];
    const idx = vals.indexOf(val);
    if (idx >= 0) vals.splice(idx, 1);
    else { if (currentProps.max && vals.length >= currentProps.max) return; vals.push(val); }
    currentProps.value = vals;
    currentProps.onChange?.(vals);
    query = '';
    inputEl.value = '';
    sync();
  }

  function removeTag(val: string) {
    const vals = (currentProps.value ?? []).filter(v => v !== val);
    currentProps.value = vals;
    currentProps.onChange?.(vals);
    sync();
  }

  inputEl.addEventListener('input', () => { query = inputEl.value; open = true; highlightIdx = -1; currentProps.onInputChange?.(query); sync(); });
  inputEl.addEventListener('focus', () => { open = true; sync(); });
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    const f = getFiltered();
    if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, f.length - 1); open = true; sync(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); sync(); }
    else if (e.key === 'Enter' && highlightIdx >= 0 && f[highlightIdx]) { e.preventDefault(); toggleOption(f[highlightIdx].value); }
    else if (e.key === 'Escape') { open = false; sync(); }
    else if (e.key === 'Backspace' && !inputEl.value && (currentProps.value?.length ?? 0) > 0) { removeTag(currentProps.value![currentProps.value!.length - 1]); }
  }) as EventListener);

  document.addEventListener('click', (e) => { if (!root.contains(e.target as Node)) { open = false; sync(); } });

  function sync() {
    const vals = currentProps.value ?? [];
    const filtered = getFiltered();
    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    inputEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    inputEl.disabled = currentProps.disabled ?? false;
    inputEl.placeholder = vals.length ? '' : (currentProps.placeholder ?? '');

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    tagsEl.innerHTML = '';
    vals.forEach(v => {
      const opt = (currentProps.options ?? []).find(o => o.value === v);
      const tag = document.createElement('span');
      tag.setAttribute('data-part', 'tag');
      tag.textContent = opt ? opt.label : v;
      const del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove');
      del.textContent = '\u00d7';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeTag(v); });
      tag.appendChild(del);
      tagsEl.appendChild(tag);
    });

    listboxEl.innerHTML = '';
    listboxEl.style.display = open ? '' : 'none';
    filtered.forEach((opt, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-part', 'option');
      li.setAttribute('aria-selected', vals.includes(opt.value) ? 'true' : 'false');
      li.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      li.textContent = opt.label;
      if (!opt.disabled) li.addEventListener('mousedown', (e) => { e.preventDefault(); toggleOption(opt.value); });
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

export default createComboboxMulti;
