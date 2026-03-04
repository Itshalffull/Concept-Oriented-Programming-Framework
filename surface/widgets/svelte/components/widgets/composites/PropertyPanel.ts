import { uid } from '../shared/uid.js';

export type PropertyType = 'text' | 'select' | 'date' | 'person' | 'tags' | 'checkbox' | 'number' | 'url';

export interface PropertyDef {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
  displayValue?: string;
  options?: string[];
}

export interface PropertyPanelProps {
  properties: PropertyDef[];
  title?: string;
  collapsed?: boolean;
  editable?: boolean;
  reorderable?: boolean;
  showAddButton?: boolean;
  disabled?: boolean;
  onChange?: (key: string, value: unknown) => void;
  onAdd?: () => void;
  onReorder?: (properties: PropertyDef[]) => void;
  renderEditor?: (property: PropertyDef, onCommit: (value: unknown) => void) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface PropertyPanelInstance {
  element: HTMLElement;
  update(props: Partial<PropertyPanelProps>): void;
  destroy(): void;
}

export function createPropertyPanel(options: {
  target: HTMLElement;
  props: PropertyPanelProps;
}): PropertyPanelInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let isCollapsed = currentProps.collapsed ?? false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'property-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Properties');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const titleEl = document.createElement('span');
  titleEl.setAttribute('data-part', 'title');
  headerEl.appendChild(titleEl);

  const collapseBtn = document.createElement('button');
  collapseBtn.setAttribute('data-part', 'collapse-toggle');
  collapseBtn.setAttribute('type', 'button');
  collapseBtn.setAttribute('aria-label', 'Toggle properties');
  headerEl.appendChild(collapseBtn);

  const listEl = document.createElement('div');
  listEl.setAttribute('data-part', 'property-list');
  listEl.setAttribute('role', 'list');
  root.appendChild(listEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-button');
  addBtn.setAttribute('type', 'button');
  addBtn.setAttribute('aria-label', 'Add property');
  addBtn.textContent = '+ Add property';
  root.appendChild(addBtn);

  collapseBtn.addEventListener('click', () => { isCollapsed = !isCollapsed; sync(); });
  cleanups.push(() => {});
  addBtn.addEventListener('click', () => currentProps.onAdd?.());

  function renderProperties() {
    listEl.innerHTML = '';
    currentProps.properties.forEach(prop => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'property-row');
      row.setAttribute('role', 'listitem');
      const label = document.createElement('span');
      label.setAttribute('data-part', 'property-label');
      label.textContent = prop.label;
      row.appendChild(label);
      const valueEl = document.createElement('span');
      valueEl.setAttribute('data-part', 'property-value');
      if (currentProps.editable && currentProps.renderEditor) {
        const commit = (val: unknown) => currentProps.onChange?.(prop.key, val);
        const editor = currentProps.renderEditor(prop, commit);
        if (typeof editor === 'string') valueEl.innerHTML = editor;
        else valueEl.appendChild(editor);
      } else {
        valueEl.textContent = prop.displayValue ?? String(prop.value ?? '');
      }
      row.appendChild(valueEl);
      listEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', isCollapsed ? 'collapsed' : 'expanded');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    titleEl.textContent = currentProps.title ?? 'Properties';
    collapseBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    collapseBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
    listEl.style.display = isCollapsed ? 'none' : '';
    addBtn.style.display = (!isCollapsed && currentProps.showAddButton) ? '' : 'none';
    renderProperties();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPropertyPanel;
