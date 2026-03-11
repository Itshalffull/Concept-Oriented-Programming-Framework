import { uid } from '../shared/uid.js';

export interface SortFieldDef {
  key: string;
  label: string;
}

export interface SortCriterion {
  id: string;
  field: string;
  direction: 'asc' | 'desc';
}

export interface SortBuilderProps {
  sorts?: SortCriterion[];
  fields: SortFieldDef[];
  maxSorts?: number;
  disabled?: boolean;
  onChange?: (sorts: SortCriterion[]) => void;
  children?: string | HTMLElement;
}

export interface SortBuilderInstance {
  element: HTMLElement;
  update(props: Partial<SortBuilderProps>): void;
  destroy(): void;
}

export function createSortBuilder(options: {
  target: HTMLElement;
  props: SortBuilderProps;
}): SortBuilderInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'sort-builder');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Sort builder');
  root.id = id;

  const rowsEl = document.createElement('div');
  rowsEl.setAttribute('data-part', 'sort-rows');
  root.appendChild(rowsEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-sort');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('aria-label', 'Add sort criterion');
  addBtn.textContent = '+ Add sort';
  root.appendChild(addBtn);

  addBtn.addEventListener('click', () => {
    const sorts = [...(currentProps.sorts ?? [])];
    const max = currentProps.maxSorts ?? Infinity;
    if (sorts.length >= max) return;
    sorts.push({ id: uid(), field: currentProps.fields[0]?.key ?? '', direction: 'asc' });
    currentProps.onChange?.(sorts);
  });
  cleanups.push(() => {});

  function renderRows() {
    rowsEl.innerHTML = '';
    (currentProps.sorts ?? []).forEach((s, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'sort-row');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Sort criterion ' + (i + 1));

      const fieldSel = document.createElement('select');
      fieldSel.setAttribute('data-part', 'field-selector');
      fieldSel.setAttribute('aria-label', 'Sort field');
      currentProps.fields.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.key; opt.textContent = f.label;
        if (f.key === s.field) opt.selected = true;
        fieldSel.appendChild(opt);
      });
      row.appendChild(fieldSel);

      const dirBtn = document.createElement('button');
      dirBtn.setAttribute('data-part', 'direction-toggle');
      dirBtn.setAttribute('type', 'button');
      dirBtn.setAttribute('aria-label', 'Toggle sort direction');
      dirBtn.textContent = s.direction === 'asc' ? '\u2191 Asc' : '\u2193 Desc';
      row.appendChild(dirBtn);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('data-part', 'remove-sort');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove sort');
      removeBtn.textContent = '\u00d7';
      row.appendChild(removeBtn);

      fieldSel.addEventListener('change', () => {
        const sorts = [...(currentProps.sorts ?? [])];
        sorts[i] = { ...sorts[i], field: fieldSel.value };
        currentProps.onChange?.(sorts);
      });
      dirBtn.addEventListener('click', () => {
        const sorts = [...(currentProps.sorts ?? [])];
        sorts[i] = { ...sorts[i], direction: sorts[i].direction === 'asc' ? 'desc' : 'asc' };
        currentProps.onChange?.(sorts);
      });
      removeBtn.addEventListener('click', () => {
        const sorts = (currentProps.sorts ?? []).filter((_, j) => j !== i);
        currentProps.onChange?.(sorts);
      });

      rowsEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    addBtn.disabled = currentProps.disabled ?? false;
    renderRows();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createSortBuilder;
