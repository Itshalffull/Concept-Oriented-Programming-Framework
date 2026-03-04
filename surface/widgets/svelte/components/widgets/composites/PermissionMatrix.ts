import { uid } from '../shared/uid.js';

export interface RoleDef {
  key: string;
  name: string;
  description?: string;
}

export interface ActionDef {
  key: string;
  name: string;
}

export interface ResourceDef {
  key: string;
  name: string;
  actions: ActionDef[];
}

export type PermissionMap = Record<string, Record<string, Record<string, boolean>>>;

export interface PermissionMatrixProps {
  roles: RoleDef[];
  resources: ResourceDef[];
  permissions: PermissionMap;
  disabled?: boolean;
  readOnly?: boolean;
  showBulkToggle?: boolean;
  showDescriptions?: boolean;
  collapsible?: boolean;
  onChange?: (resource: string, action: string, role: string, granted: boolean) => void;
  onSave?: () => void;
  children?: string | HTMLElement;
}

export interface PermissionMatrixInstance {
  element: HTMLElement;
  update(props: Partial<PermissionMatrixProps>): void;
  destroy(): void;
}

export function createPermissionMatrix(options: {
  target: HTMLElement;
  props: PermissionMatrixProps;
}): PermissionMatrixInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  const collapsedResources = new Set<string>();

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'permission-matrix');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', 'Permission matrix');
  root.id = id;

  const headerRowEl = document.createElement('div');
  headerRowEl.setAttribute('data-part', 'role-header');
  headerRowEl.setAttribute('role', 'row');
  root.appendChild(headerRowEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  root.appendChild(bodyEl);

  function renderHeader() {
    headerRowEl.innerHTML = '';
    const corner = document.createElement('span');
    corner.setAttribute('role', 'columnheader');
    corner.textContent = 'Permission';
    headerRowEl.appendChild(corner);
    currentProps.roles.forEach(r => {
      const cell = document.createElement('span');
      cell.setAttribute('data-part', 'role-cell');
      cell.setAttribute('role', 'columnheader');
      cell.textContent = r.name;
      headerRowEl.appendChild(cell);
    });
  }

  function renderBody() {
    bodyEl.innerHTML = '';
    currentProps.resources.forEach(res => {
      const group = document.createElement('div');
      group.setAttribute('data-part', 'resource-group');
      group.setAttribute('role', 'rowgroup');

      const summaryRow = document.createElement('div');
      summaryRow.setAttribute('data-part', 'resource-summary-row');
      summaryRow.setAttribute('role', 'row');
      const resLabel = document.createElement('span');
      resLabel.setAttribute('data-part', 'resource-label');
      resLabel.setAttribute('role', 'rowheader');
      resLabel.textContent = res.name;
      if (currentProps.collapsible) {
        resLabel.style.cursor = 'pointer';
        resLabel.addEventListener('click', () => {
          if (collapsedResources.has(res.key)) collapsedResources.delete(res.key);
          else collapsedResources.add(res.key);
          sync();
        });
      }
      summaryRow.appendChild(resLabel);
      group.appendChild(summaryRow);

      if (!collapsedResources.has(res.key)) {
        res.actions.forEach(action => {
          const row = document.createElement('div');
          row.setAttribute('data-part', 'resource-row');
          row.setAttribute('role', 'row');
          const actionLabel = document.createElement('span');
          actionLabel.setAttribute('data-part', 'action-label');
          actionLabel.setAttribute('role', 'rowheader');
          actionLabel.textContent = action.name;
          row.appendChild(actionLabel);
          currentProps.roles.forEach(role => {
            const cell = document.createElement('span');
            cell.setAttribute('data-part', 'action-cell');
            cell.setAttribute('role', 'gridcell');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!(currentProps.permissions?.[res.key]?.[action.key]?.[role.key]);
            cb.disabled = currentProps.disabled || currentProps.readOnly || false;
            cb.setAttribute('aria-label', action.name + ' for ' + role.name);
            cb.addEventListener('change', () => {
              currentProps.onChange?.(res.key, action.key, role.key, cb.checked);
            });
            cell.appendChild(cb);
            row.appendChild(cell);
          });
          group.appendChild(row);
        });
      }
      bodyEl.appendChild(group);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    renderHeader();
    renderBody();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPermissionMatrix;
