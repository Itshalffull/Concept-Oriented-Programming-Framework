import { uid } from '../shared/uid.js';

export interface ConditionField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
}

export interface ConditionRow {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface ConditionBuilderProps {
  conditions?: ConditionRow[];
  logic?: 'and' | 'or';
  fields: ConditionField[];
  operators?: { key: string; label: string }[];
  maxConditions?: number;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (conditions: ConditionRow[], logic: 'and' | 'or') => void;
  children?: string | HTMLElement;
}

export interface ConditionBuilderInstance {
  element: HTMLElement;
  update(props: Partial<ConditionBuilderProps>): void;
  destroy(): void;
}

export function createConditionBuilder(options: {
  target: HTMLElement;
  props: ConditionBuilderProps;
}): ConditionBuilderInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'condition-builder');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Condition builder');
  root.id = id;

  const logicToggle = document.createElement('button');
  logicToggle.setAttribute('data-part', 'logic-toggle');
  logicToggle.setAttribute('type', 'button');
  root.appendChild(logicToggle);

  const rowsEl = document.createElement('div');
  rowsEl.setAttribute('data-part', 'condition-rows');
  root.appendChild(rowsEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-condition');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('aria-label', 'Add condition');
  addBtn.textContent = '+ Add condition';
  root.appendChild(addBtn);

  logicToggle.addEventListener('click', () => {
    const next = currentProps.logic === 'and' ? 'or' : 'and';
    currentProps.onChange?.(currentProps.conditions ?? [], next);
  });
  cleanups.push(() => {});
  addBtn.addEventListener('click', () => {
    const conds = [...(currentProps.conditions ?? [])];
    if (conds.length >= (currentProps.maxConditions ?? Infinity)) return;
    conds.push({ id: uid(), field: currentProps.fields[0]?.key ?? '', operator: (currentProps.operators ?? [])[0]?.key ?? 'equals', value: '' });
    currentProps.onChange?.(conds, currentProps.logic ?? 'and');
  });

  function renderRows() {
    rowsEl.innerHTML = '';
    (currentProps.conditions ?? []).forEach((c, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'condition-row');
      row.setAttribute('role', 'group');

      const fieldSel = document.createElement('select');
      fieldSel.setAttribute('aria-label', 'Field');
      currentProps.fields.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.key; opt.textContent = f.label;
        if (f.key === c.field) opt.selected = true;
        fieldSel.appendChild(opt);
      });
      row.appendChild(fieldSel);

      const opSel = document.createElement('select');
      opSel.setAttribute('aria-label', 'Operator');
      (currentProps.operators ?? [{ key: 'equals', label: 'Equals' }]).forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.key; opt.textContent = op.label;
        if (op.key === c.operator) opt.selected = true;
        opSel.appendChild(opt);
      });
      row.appendChild(opSel);

      const valInput = document.createElement('input');
      valInput.setAttribute('aria-label', 'Value');
      valInput.value = c.value;
      row.appendChild(valInput);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove condition');
      removeBtn.textContent = '\u00d7';
      row.appendChild(removeBtn);

      fieldSel.addEventListener('change', () => { const conds = [...(currentProps.conditions ?? [])]; conds[i] = { ...conds[i], field: fieldSel.value }; currentProps.onChange?.(conds, currentProps.logic ?? 'and'); });
      opSel.addEventListener('change', () => { const conds = [...(currentProps.conditions ?? [])]; conds[i] = { ...conds[i], operator: opSel.value }; currentProps.onChange?.(conds, currentProps.logic ?? 'and'); });
      valInput.addEventListener('input', () => { const conds = [...(currentProps.conditions ?? [])]; conds[i] = { ...conds[i], value: valInput.value }; currentProps.onChange?.(conds, currentProps.logic ?? 'and'); });
      removeBtn.addEventListener('click', () => { const conds = (currentProps.conditions ?? []).filter((_, j) => j !== i); currentProps.onChange?.(conds, currentProps.logic ?? 'and'); });

      rowsEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    logicToggle.textContent = (currentProps.logic ?? 'and').toUpperCase();
    logicToggle.disabled = currentProps.disabled || currentProps.readOnly || false;
    addBtn.disabled = currentProps.disabled || currentProps.readOnly || false;
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

export default createConditionBuilder;
