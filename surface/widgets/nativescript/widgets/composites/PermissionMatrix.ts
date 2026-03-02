// ============================================================
// Clef Surface NativeScript Widget — PermissionMatrix
//
// Role/permission grid widget. Displays roles as columns and
// permissions as rows with toggleable switches at each
// intersection. Includes row/column headers for clarity.
// See Architecture doc Section 16.
// ============================================================

import { StackLayout, GridLayout, Label, Switch, ScrollView } from '@nativescript/core';

// --------------- Types ---------------

export interface Role {
  id: string;
  name: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export interface PermissionGrant {
  roleId: string;
  permissionId: string;
  granted: boolean;
}

// --------------- Props ---------------

export interface PermissionMatrixProps {
  /** Roles displayed as columns. */
  roles?: Role[];
  /** Permissions displayed as rows. */
  permissions?: Permission[];
  /** Current grant state for each role-permission pair. */
  grants?: PermissionGrant[];
  /** Whether the matrix is editable. */
  editable?: boolean;
  /** Called when a permission grant is toggled. */
  onToggle?: (roleId: string, permissionId: string, granted: boolean) => void;
}

// --------------- Component ---------------

export function createPermissionMatrix(props: PermissionMatrixProps = {}): StackLayout {
  const {
    roles = [],
    permissions = [],
    grants = [],
    editable = true,
    onToggle,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-permission-matrix';
  container.padding = 12;

  // Title
  const titleLabel = new Label();
  titleLabel.text = 'Permission Matrix';
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 16;
  titleLabel.marginBottom = 12;
  container.addChild(titleLabel);

  if (roles.length === 0 || permissions.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No roles or permissions defined.';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    container.addChild(emptyLabel);
    return container;
  }

  // Build grant lookup
  const grantMap = new Map<string, boolean>();
  grants.forEach((g) => grantMap.set(`${g.roleId}:${g.permissionId}`, g.granted));

  const scrollView = new ScrollView();
  scrollView.orientation = 'horizontal' as any;

  // Column definition: first col for permission name, then one per role
  const colDef = ['160', ...roles.map(() => '80')].join(', ');
  const grid = new GridLayout();
  grid.columns = colDef;

  let rowIndex = 0;

  // Header row
  const cornerLabel = new Label();
  cornerLabel.text = '';
  GridLayout.setRow(cornerLabel, rowIndex);
  GridLayout.setColumn(cornerLabel, 0);
  grid.addChild(cornerLabel);

  roles.forEach((role, colIdx) => {
    const roleLabel = new Label();
    roleLabel.text = role.name;
    roleLabel.fontWeight = 'bold';
    roleLabel.fontSize = 11;
    roleLabel.horizontalAlignment = 'center';
    roleLabel.textWrap = true;
    GridLayout.setRow(roleLabel, rowIndex);
    GridLayout.setColumn(roleLabel, colIdx + 1);
    grid.addChild(roleLabel);
  });

  rowIndex++;

  // Permission rows
  permissions.forEach((perm) => {
    const permLabel = new Label();
    permLabel.text = perm.name;
    permLabel.fontSize = 12;
    permLabel.verticalAlignment = 'middle';
    GridLayout.setRow(permLabel, rowIndex);
    GridLayout.setColumn(permLabel, 0);
    grid.addChild(permLabel);

    roles.forEach((role, colIdx) => {
      const key = `${role.id}:${perm.id}`;
      const granted = grantMap.get(key) ?? false;

      if (editable) {
        const toggle = new Switch();
        toggle.checked = granted;
        toggle.horizontalAlignment = 'center';
        GridLayout.setRow(toggle, rowIndex);
        GridLayout.setColumn(toggle, colIdx + 1);
        if (onToggle) {
          toggle.on('checkedChange', () => {
            onToggle(role.id, perm.id, toggle.checked);
          });
        }
        grid.addChild(toggle);
      } else {
        const stateLabel = new Label();
        stateLabel.text = granted ? '\u2713' : '\u2014';
        stateLabel.horizontalAlignment = 'center';
        stateLabel.verticalAlignment = 'middle';
        stateLabel.fontSize = 14;
        stateLabel.color = granted ? ('#4CAF50' as any) : ('#CCCCCC' as any);
        GridLayout.setRow(stateLabel, rowIndex);
        GridLayout.setColumn(stateLabel, colIdx + 1);
        grid.addChild(stateLabel);
      }
    });

    rowIndex++;
  });

  scrollView.content = grid;
  container.addChild(scrollView);
  return container;
}

createPermissionMatrix.displayName = 'PermissionMatrix';
export default createPermissionMatrix;
