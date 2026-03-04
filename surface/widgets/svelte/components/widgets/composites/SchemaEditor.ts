import { uid } from '../shared/uid.js';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'url' | 'email' | 'relation';

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required?: boolean;
  config?: Record<string, unknown>;
}

export interface TypeDef {
  key: FieldType;
  label: string;
}

export interface SchemaEditorProps {
  fields?: FieldDefinition[];
  availableTypes?: FieldType[];
  maxFields?: number;
  disabled?: boolean;
  reorderable?: boolean;
  showValidation?: boolean;
  onChange?: (fields: FieldDefinition[]) => void;
  renderConfigPanel?: (field: FieldDefinition, onUpdate: (config: Record<string, unknown>) => void) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface SchemaEditorInstance {
  element: HTMLElement;
  update(props: Partial<SchemaEditorProps>): void;
  destroy(): void;
}

export function createSchemaEditor(options: {
  target: HTMLElement;
  props: SchemaEditorProps;
}): SchemaEditorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'schema-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Schema editor');
  root.id = id;

  const fieldListEl = document.createElement('div');
  fieldListEl.setAttribute('data-part', 'field-list');
  fieldListEl.setAttribute('role', 'list');
  root.appendChild(fieldListEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-field');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('aria-label', 'Add field');
  addBtn.textContent = '+ Add field';
  root.appendChild(addBtn);

  addBtn.addEventListener('click', () => {
    const fields = [...(currentProps.fields ?? [])];
    const max = currentProps.maxFields ?? Infinity;
    if (fields.length >= max) return;
    fields.push({ id: uid(), name: '', type: 'text', required: false });
    currentProps.onChange?.(fields);
  });
  cleanups.push(() => {});

  function renderFields() {
    fieldListEl.innerHTML = '';
    (currentProps.fields ?? []).forEach((field, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'field-row');
      row.setAttribute('role', 'listitem');

      const nameInput = document.createElement('input');
      nameInput.setAttribute('data-part', 'field-name');
      nameInput.setAttribute('aria-label', 'Field name');
      nameInput.value = field.name;
      nameInput.disabled = currentProps.disabled ?? false;
      row.appendChild(nameInput);

      const typeSel = document.createElement('select');
      typeSel.setAttribute('data-part', 'field-type');
      typeSel.setAttribute('aria-label', 'Field type');
      (currentProps.availableTypes ?? ['text', 'number', 'date', 'select', 'boolean']).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        if (t === field.type) opt.selected = true;
        typeSel.appendChild(opt);
      });
      typeSel.disabled = currentProps.disabled ?? false;
      row.appendChild(typeSel);

      const reqCb = document.createElement('input');
      reqCb.type = 'checkbox';
      reqCb.checked = field.required ?? false;
      reqCb.setAttribute('aria-label', 'Required');
      reqCb.disabled = currentProps.disabled ?? false;
      row.appendChild(reqCb);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('data-part', 'remove-field');
      removeBtn.setAttribute('aria-label', 'Remove field');
      removeBtn.textContent = '\u00d7';
      removeBtn.disabled = currentProps.disabled ?? false;
      row.appendChild(removeBtn);

      nameInput.addEventListener('input', () => {
        const fields = [...(currentProps.fields ?? [])];
        fields[i] = { ...fields[i], name: nameInput.value };
        currentProps.onChange?.(fields);
      });
      typeSel.addEventListener('change', () => {
        const fields = [...(currentProps.fields ?? [])];
        fields[i] = { ...fields[i], type: typeSel.value as FieldType };
        currentProps.onChange?.(fields);
      });
      reqCb.addEventListener('change', () => {
        const fields = [...(currentProps.fields ?? [])];
        fields[i] = { ...fields[i], required: reqCb.checked };
        currentProps.onChange?.(fields);
      });
      removeBtn.addEventListener('click', () => {
        const fields = (currentProps.fields ?? []).filter((_, j) => j !== i);
        currentProps.onChange?.(fields);
      });

      fieldListEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    addBtn.disabled = currentProps.disabled ?? false;
    renderFields();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createSchemaEditor;
