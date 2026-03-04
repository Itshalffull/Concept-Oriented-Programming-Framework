import { uid } from '../shared/uid.js';

export interface MultiSelectProps {
  value?: string[];
  options?: Array<{ label: string; value: string; disabled?: boolean; group?: string }>;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  max?: number;
  searchable?: boolean;
  onChange?: (value: string[]) => void;
  className?: string;
}

export interface MultiSelectInstance {
  element: HTMLElement;
  update(props: Partial<MultiSelectProps>): void;
  destroy(): void;
}

export function createMultiSelect(options: {
  target: HTMLElement;
  props: MultiSelectProps;
}): MultiSelectInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let open = false;
  let query = '';
  let highlightIdx = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'multi-select');
  root.setAttribute('data-part', 'root');

  const labelEl = document.createElement('label');
  labelEl.setAttribute('data-part', 'label');
  root.appendChild(labelEl);

  const triggerEl = document.createElement('button');
  triggerEl.setAttribute('data-part', 'trigger');
  triggerEl.setAttribute('type', 'button');
  triggerEl.setAttribute('role', 'combobox');
  triggerEl.setAttribute('aria-expanded', 'false');
  triggerEl.id = id;
  root.appendChild(triggerEl);

  const tagsEl = document.createElement('div');
  tagsEl.setAttribute('data-part', 'tags');
  triggerEl.appendChild(tagsEl);

  const searchEl = document.createElement('input');
  searchEl.setAttribute('data-part', 'search');
  searchEl.type = 'text';
  searchEl.style.display = 'none';
  root.appendChild(searchEl);

  const listboxEl = document.createElement('ul');
  listboxEl.setAttribute('data-part', 'listbox');
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.setAttribute('aria-multiselectable', 'true');
  root.appendChild(listboxEl);

  const errorEl = document.createElement('span');
  errorEl.setAttribute('data-part', 'error');
  errorEl.setAttribute('role', 'alert');
  root.appendChild(errorEl);

  function toggleVal(v: string) {
    const vals = [...(currentProps.value ?? [])];
    const i = vals.indexOf(v);
    if (i >= 0) vals.splice(i, 1);
    else { if (currentProps.max && vals.length >= currentProps.max) return; vals.push(v); }
    currentProps.value = vals;
    currentProps.onChange?.(vals);
    sync();
  }

  triggerEl.addEventListener('click', () => { if (!currentProps.disabled) { open = !open; sync(); if (open && currentProps.searchable) searchEl.focus(); } });
  searchEl.addEventListener('input', () => { query = searchEl.value; highlightIdx = -1; sync(); });
  document.addEventListener('click', (e) => { if (!root.contains(e.target as Node)) { open = false; sync(); } });

  function getFiltered() {
    const opts = currentProps.options ?? [];
    if (!query) return opts;
    const q = query.toLowerCase();
    return opts.filter(o => o.label.toLowerCase().includes(q));
  }

  function sync() {
    const vals = currentProps.value ?? [];
    const filtered = getFiltered();
    root.setAttribute('data-state', open ? 'open' : 'closed');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    triggerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    triggerEl.disabled = currentProps.disabled ?? false;

    labelEl.textContent = currentProps.label ?? '';
    labelEl.style.display = currentProps.label ? '' : 'none';
    errorEl.textContent = currentProps.error ?? '';
    errorEl.style.display = currentProps.error ? '' : 'none';

    tagsEl.innerHTML = '';
    if (vals.length === 0) {
      tagsEl.textContent = currentProps.placeholder ?? 'Select...';
    } else {
      vals.forEach(v => {
        const opt = (currentProps.options ?? []).find(o => o.value === v);
        const tag = document.createElement('span');
        tag.setAttribute('data-part', 'tag');
        tag.textContent = opt ? opt.label : v;
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '\u00d7';
        del.addEventListener('click', (e) => { e.stopPropagation(); toggleVal(v); });
        tag.appendChild(del);
        tagsEl.appendChild(tag);
      });
    }

    searchEl.style.display = open && currentProps.searchable ? '' : 'none';

    listboxEl.innerHTML = '';
    listboxEl.style.display = open ? '' : 'none';
    filtered.forEach((opt, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', vals.includes(opt.value) ? 'true' : 'false');
      li.setAttribute('data-highlighted', i === highlightIdx ? 'true' : 'false');
      li.textContent = opt.label;
      if (!opt.disabled) li.addEventListener('mousedown', (e) => { e.preventDefault(); toggleVal(opt.value); });
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

export default createMultiSelect;
