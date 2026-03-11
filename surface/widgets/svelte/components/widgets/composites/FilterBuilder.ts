import { uid } from '../shared/uid.js';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
}

export interface OperatorDef {
  key: string;
  label: string;
  fieldTypes?: string[];
}

export interface FilterRow {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  logic: 'and' | 'or';
  filters: (FilterRow | FilterGroup)[];
  depth: number;
}

export interface FilterBuilderProps {
  filters?: FilterRow[];
  logic?: 'and' | 'or';
  fields: FieldDef[];
  operators: OperatorDef[];
  maxDepth?: number;
  maxFilters?: number;
  disabled?: boolean;
  allowGroups?: boolean;
  onChange?: (filters: FilterRow[], logic: 'and' | 'or') => void;
  children?: string | HTMLElement;
}

export interface FilterBuilderInstance {
  element: HTMLElement;
  update(props: Partial<FilterBuilderProps>): void;
  destroy(): void;
}

export function createFilterBuilder(options: {
  target: HTMLElement;
  props: FilterBuilderProps;
}): FilterBuilderInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'filter-builder');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Filter builder');
  root.id = id;

  const logicToggleEl = document.createElement('button');
  logicToggleEl.setAttribute('data-part', 'logic-toggle');
  logicToggleEl.setAttribute('type', 'button');
  logicToggleEl.setAttribute('aria-label', 'Toggle logic operator');
  root.appendChild(logicToggleEl);

  const rowsEl = document.createElement('div');
  rowsEl.setAttribute('data-part', 'filter-rows');
  root.appendChild(rowsEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-button');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('aria-label', 'Add filter');
  addBtn.textContent = '+ Add filter';
  root.appendChild(addBtn);

  logicToggleEl.addEventListener('click', () => {
    const next = currentProps.logic === 'and' ? 'or' : 'and';
    currentProps.logic = next;
    currentProps.onChange?.(currentProps.filters ?? [], next);
    sync();
  });
  cleanups.push(() => {});

  addBtn.addEventListener('click', () => {
    const filters = [...(currentProps.filters ?? [])];
    const max = currentProps.maxFilters ?? Infinity;
    if (filters.length >= max) return;
    filters.push({ id: uid(), field: currentProps.fields[0]?.key ?? '', operator: currentProps.operators[0]?.key ?? '', value: '' });
    currentProps.onChange?.(filters, currentProps.logic ?? 'and');
  });

  function renderRows() {
    rowsEl.innerHTML = '';
    (currentProps.filters ?? []).forEach((f, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'filter-row');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Filter row ' + (i + 1));

      const fieldSel = document.createElement('select');
      fieldSel.setAttribute('data-part', 'field-selector');
      fieldSel.setAttribute('aria-label', 'Filter field');
      currentProps.fields.forEach(fd => {
        const opt = document.createElement('option');
        opt.value = fd.key; opt.textContent = fd.label;
        if (fd.key === f.field) opt.selected = true;
        fieldSel.appendChild(opt);
      });
      row.appendChild(fieldSel);

      const opSel = document.createElement('select');
      opSel.setAttribute('data-part', 'operator-selector');
      opSel.setAttribute('aria-label', 'Filter operator');
      currentProps.operators.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.key; opt.textContent = op.label;
        if (op.key === f.operator) opt.selected = true;
        opSel.appendChild(opt);
      });
      row.appendChild(opSel);

      const valInput = document.createElement('input');
      valInput.setAttribute('data-part', 'value-input');
      valInput.setAttribute('aria-label', 'Filter value');
      valInput.value = f.value;
      row.appendChild(valInput);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('data-part', 'remove-button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove filter');
      removeBtn.textContent = '\u00d7';
      row.appendChild(removeBtn);

      fieldSel.addEventListener('change', () => {
        const filters = [...(currentProps.filters ?? [])];
        filters[i] = { ...filters[i], field: fieldSel.value };
        currentProps.onChange?.(filters, currentProps.logic ?? 'and');
      });
      opSel.addEventListener('change', () => {
        const filters = [...(currentProps.filters ?? [])];
        filters[i] = { ...filters[i], operator: opSel.value };
        currentProps.onChange?.(filters, currentProps.logic ?? 'and');
      });
      valInput.addEventListener('input', () => {
        const filters = [...(currentProps.filters ?? [])];
        filters[i] = { ...filters[i], value: valInput.value };
        currentProps.onChange?.(filters, currentProps.logic ?? 'and');
      });
      removeBtn.addEventListener('click', () => {
        const filters = (currentProps.filters ?? []).filter((_, j) => j !== i);
        currentProps.onChange?.(filters, currentProps.logic ?? 'and');
      });

      rowsEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    logicToggleEl.textContent = (currentProps.logic ?? 'and').toUpperCase();
    logicToggleEl.disabled = currentProps.disabled ?? false;
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

export default createFilterBuilder;
