'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import {
  permissionMatrixReducer,
  isGranted,
  allActionsGranted,
  someActionsGranted,
  allGranted,
  someGranted,
} from './PermissionMatrix.reducer.js';
import type { PermissionMap, ResourceDef as ReducerResourceDef } from './PermissionMatrix.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from permission-matrix.widget spec props
 * ------------------------------------------------------------------------- */

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

/** permissions: { [resourceKey]: { [actionKey]: [roleKey1, roleKey2, ...] } } */
export type { PermissionMap };

export interface PermissionMatrixProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const PermissionMatrix = forwardRef<HTMLDivElement, PermissionMatrixProps>(
  function PermissionMatrix(
    {
      roles,
      resources,
      permissions,
      disabled = false,
      readOnly = false,
      showBulkToggle = false,
      showDescriptions = false,
      collapsible = true,
      onChange,
      onSave,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(permissionMatrixReducer, {
      collapsedGroups: new Set(),
      saving: 'idle',
      focusRow: 0,
      focusCol: 0,
    });

    const handleToggle = useCallback(
      (resource: string, action: string, role: string) => {
        if (disabled || readOnly) return;
        const granted = isGranted(permissions, resource, action, role);
        send({ type: 'CHANGE' });
        onChange?.(resource, action, role, !granted);
      },
      [disabled, readOnly, permissions, onChange],
    );

    const handleKeyNavigation = useCallback(
      (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
        let newRow = rowIdx;
        let newCol = colIdx;
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            newCol = Math.min(colIdx + 1, roles.length - 1);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            newCol = Math.max(colIdx - 1, 0);
            break;
          case 'ArrowDown':
            e.preventDefault();
            newRow = rowIdx + 1;
            break;
          case 'ArrowUp':
            e.preventDefault();
            newRow = Math.max(rowIdx - 1, 0);
            break;
          case 'Home':
            e.preventDefault();
            newCol = 0;
            break;
          case 'End':
            e.preventDefault();
            newCol = roles.length - 1;
            break;
          default:
            return;
        }
        send({ type: 'NAVIGATE', row: newRow, col: newCol });
      },
      [roles.length],
    );

    let globalRowIdx = 0;

    return (
      <div
        ref={ref}
        role="grid"
        aria-label="Permission matrix"
        aria-colcount={roles.length + 1}
        data-surface-widget=""
        data-widget-name="permission-matrix"
        data-part="root"
        data-disabled={disabled ? 'true' : 'false'}
        data-readonly={readOnly ? 'true' : 'false'}
        data-state={state.saving === 'pending' ? 'unsaved' : state.saving === 'saving' ? 'saving' : 'idle'}
        {...rest}
      >
        {/* Role Header */}
        <div role="row" data-part="role-header">
          <span role="columnheader" aria-colindex={1}>Resource / Action</span>
          {roles.map((role, ci) => (
            <span
              key={role.key}
              role="columnheader"
              aria-colindex={ci + 2}
              data-part="role-cell"
              data-role={role.key}
            >
              {role.name}
              {showDescriptions && role.description && (
                <span data-part="role-description">{role.description}</span>
              )}
              {showBulkToggle && (
                <input
                  type="checkbox"
                  data-part="bulk-toggle"
                  aria-label={`Toggle all permissions for ${role.name}`}
                  checked={allGranted(permissions, resources, role.key)}
                  ref={(el) => {
                    if (el) el.indeterminate = someGranted(permissions, resources, role.key) && !allGranted(permissions, resources, role.key);
                  }}
                  disabled={disabled || readOnly}
                  data-role={role.key}
                  onChange={() => {
                    // Toggle all: delegate to parent
                    resources.forEach((r) =>
                      r.actions.forEach((a) => {
                        const granted = isGranted(permissions, r.key, a.key, role.key);
                        const allOn = allGranted(permissions, resources, role.key);
                        onChange?.(r.key, a.key, role.key, !allOn);
                      }),
                    );
                  }}
                />
              )}
            </span>
          ))}
        </div>

        {/* Resource Groups */}
        {resources.map((resource) => {
          const isCollapsed = state.collapsedGroups.has(resource.key);
          return (
            <div
              key={resource.key}
              role="rowgroup"
              aria-label={resource.name}
              aria-expanded={isCollapsed ? 'false' : 'true'}
              data-part="resource-group"
              data-resource={resource.key}
              data-state={isCollapsed ? 'collapsed' : 'expanded'}
            >
              {/* Resource row with summary checkboxes */}
              <div role="row" data-part="resource-summary-row">
                <span
                  role="rowheader"
                  aria-colindex={1}
                  data-part="resource-label"
                  id={`resource-${resource.key}`}
                  onClick={() =>
                    collapsible &&
                    send({
                      type: isCollapsed ? 'EXPAND' : 'COLLAPSE',
                      resource: resource.key,
                    })
                  }
                  style={collapsible ? { cursor: 'pointer' } : undefined}
                >
                  {collapsible && (isCollapsed ? '\u25B6 ' : '\u25BC ')}
                  {resource.name}
                </span>
                {roles.map((role) => {
                  const allOn = allActionsGranted(permissions, resource, role.key);
                  const someOn = someActionsGranted(permissions, resource, role.key);
                  return (
                    <span key={role.key} role="gridcell" data-part="resource-checkbox-cell">
                      <input
                        type="checkbox"
                        data-part="resource-checkbox"
                        aria-label={`All ${resource.name} permissions for ${role.name}`}
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = someOn && !allOn;
                        }}
                        disabled={disabled || readOnly}
                        data-resource={resource.key}
                        data-role={role.key}
                        onChange={() => {
                          resource.actions.forEach((a) => {
                            onChange?.(resource.key, a.key, role.key, !allOn);
                          });
                        }}
                      />
                    </span>
                  );
                })}
              </div>

              {/* Action rows */}
              {!isCollapsed &&
                resource.actions.map((action) => {
                  const rowIdx = globalRowIdx++;
                  return (
                    <div
                      key={action.key}
                      role="row"
                      aria-rowindex={rowIdx + 1}
                      data-part="resource-row"
                      data-action={action.key}
                      data-resource={resource.key}
                    >
                      <span
                        role="rowheader"
                        aria-colindex={1}
                        data-part="action-label"
                        id={`action-${resource.key}-${action.key}`}
                      >
                        {action.name}
                      </span>

                      {roles.map((role, ci) => {
                        const granted = isGranted(permissions, resource.key, action.key, role.key);
                        const isFocused = state.focusRow === rowIdx && state.focusCol === ci;
                        return (
                          <span
                            key={role.key}
                            role="gridcell"
                            aria-colindex={ci + 2}
                            data-part="action-cell"
                            data-role={role.key}
                            data-action={action.key}
                            data-resource={resource.key}
                          >
                            <input
                              type="checkbox"
                              data-part="action-checkbox"
                              aria-label={`${action.name} ${resource.name} for ${role.name}`}
                              aria-checked={granted ? 'true' : 'false'}
                              checked={granted}
                              disabled={disabled || readOnly}
                              data-granted={granted ? 'true' : 'false'}
                              tabIndex={isFocused ? 0 : -1}
                              onChange={() => handleToggle(resource.key, action.key, role.key)}
                              onKeyDown={(e) => handleKeyNavigation(e, rowIdx, ci)}
                            />
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {state.saving === 'pending' && onSave && (
          <div data-part="save-bar">
            <button type="button" onClick={() => { send({ type: 'SAVE' }); onSave(); }}>
              Save changes
            </button>
            <button type="button" onClick={() => send({ type: 'DISCARD' })}>
              Discard
            </button>
          </div>
        )}

        {children}
      </div>
    );
  },
);

PermissionMatrix.displayName = 'PermissionMatrix';
export default PermissionMatrix;
