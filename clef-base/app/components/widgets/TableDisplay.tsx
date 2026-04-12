'use client';

/**
 * TableDisplay — renders View data as a sortable DataTable.
 * Display type component: receives data + field config from ViewRenderer.
 *
 * Supports optional grouping: when groupConfig is provided, rows are
 * partitioned into collapsible sections with group headers showing
 * the field value and item count.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { DataTable, type ColumnDef } from './DataTable';
import { Badge } from './Badge';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';
import type { GroupConfig } from '../../../lib/view-types';
import { ActionButtonCompact } from './ActionButton';

export interface FieldConfig {
  key: string;
  label?: string;
  formatter?: string;
  visible?: boolean;
  weight?: number;
}

export interface BulkActionConfig {
  key: string;
  label: string;
  variant?: string;
}

interface TableDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  groupConfig?: GroupConfig;
  /** When true, show checkbox column for multi-select */
  selectable?: boolean;
  /** Bulk action definitions shown in toolbar when rows are selected */
  bulkActions?: BulkActionConfig[];
  /** Callback when a bulk action button is clicked */
  onBulkAction?: (action: string, selectedRows: Record<string, unknown>[]) => void;
}

function formatValue(value: unknown, formatter?: string): React.ReactNode {
  if (value === null || value === undefined) return <span>-</span>;

  switch (formatter) {
    case 'badge':
      return value ? <Badge variant="secondary">{String(value)}</Badge> : <span>-</span>;

    case 'boolean-badge':
      return (
        <Badge variant={value ? 'success' : 'secondary'}>
          {value ? 'yes' : 'no'}
        </Badge>
      );

    case 'date': {
      if (!value) return <span>-</span>;
      const d = new Date(String(value));
      return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
    }

    case 'json-count': {
      try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) return <span>{parsed.length}</span>;
        if (typeof parsed === 'object' && parsed !== null)
          return <span>{Object.keys(parsed).length}</span>;
        return <span>{String(value)}</span>;
      } catch {
        // Might be comma-separated
        const parts = String(value).split(',').filter(Boolean);
        return <span>{parts.length > 0 ? parts.length : 0}</span>;
      }
    }

    case 'schema-badges': {
      const schemas = Array.isArray(value) ? value : [];
      if (schemas.length === 0) return <Badge variant="secondary">none</Badge>;
      return (
        <span data-part="schema-list">
          {schemas.map((s: unknown) => (
            <Badge key={String(s)} variant="info">{String(s)}</Badge>
          ))}
        </span>
      );
    }

    case 'code':
      return <code data-part="code">{String(value)}</code>;

    case 'truncate': {
      const s = String(value);
      return <span title={s}>{s.length > 60 ? s.slice(0, 60) + '...' : s}</span>;
    }

    default:
      return <span>{String(value)}</span>;
  }
}

// ─── Group utilities ──────────────────────────────────────────────────────

interface DataGroup {
  key: string;
  rows: Record<string, unknown>[];
}

function groupData(
  data: Record<string, unknown>[],
  groupField: string,
  sort?: 'asc' | 'desc',
): DataGroup[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of data) {
    const key = String(row[groupField] ?? '(none)') || '(none)';
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const entries = [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  if (sort) {
    entries.sort((a, b) => {
      const cmp = a.key.localeCompare(b.key);
      return sort === 'desc' ? -cmp : cmp;
    });
  }
  return entries;
}

// ─── Grouped Table ────────────────────────────────────────────────────────

const GroupedTable: React.FC<{
  groups: DataGroup[];
  columns: ColumnDef[];
  onRowClick?: (row: Record<string, unknown>) => void;
  defaultCollapsed?: boolean;
  groupField: string;
}> = ({ groups, columns, onRowClick, defaultCollapsed, groupField }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!defaultCollapsed) return new Set();
    return new Set(groups.map(g => g.key));
  });

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter out the group field from columns so it doesn't show redundantly
  const displayColumns = columns.filter(c => c.key !== groupField);

  return (
    <table data-part="data-table" data-surface="display-table" role="grid" aria-label="Grouped view data">
      <thead>
        <tr>
          {displayColumns.map(col => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map(group => (
          <React.Fragment key={group.key}>
            {/* Group header row */}
            <tr
              data-part="group-row"
              data-collapsed={collapsed.has(group.key) ? 'true' : 'false'}
              onClick={() => toggle(group.key)}
            >
              <td
                colSpan={displayColumns.length}
                data-part="group-cell"
              >
                <span data-part="group-toggle" data-state={collapsed.has(group.key) ? 'collapsed' : 'expanded'}>
                  ▼
                </span>
                <span data-part="group-label">{group.key}</span>
                <Badge variant="secondary">{group.rows.length}</Badge>
              </td>
            </tr>
            {/* Group rows */}
            {!collapsed.has(group.key) && group.rows.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {displayColumns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

// ─── TableDisplay ─────────────────────────────────────────────────────────

// ─── Bulk Action Toolbar ──────────────────────────────────────────────────

const BulkActionToolbar: React.FC<{
  selectedCount: number;
  totalCount: number;
  bulkActions: BulkActionConfig[];
  onAction: (actionKey: string) => void;
  onClear: () => void;
}> = ({ selectedCount, totalCount, bulkActions, onAction, onClear }) => (
  <div data-surface="display-toolbar" data-part="bulk-toolbar">
    <span data-part="bulk-count">
      {selectedCount} of {totalCount} selected
    </span>
    {bulkActions.map(action => (
      <button
        key={action.key}
        data-part="button"
        data-variant={action.variant ?? 'ghost'}
        onClick={() => onAction(action.key)}
      >
        {action.label}
      </button>
    ))}
    <button
      data-part="button"
      data-variant="ghost"
      data-role="bulk-clear"
      onClick={onClear}
    >
      Clear
    </button>
  </div>
);

// ─── RowActionButtons ─────────────────────────────────────────────────────
// Per-row action buttons with pending/error state management.

interface RowActionState {
  pending: string | null;   // action key currently in-flight
  error: string | null;     // last error message
  errorAction: string | null; // which action produced the error
  success: string | null;   // action key that last succeeded (auto-clears)
}

const RowActionButtons: React.FC<{
  row: Record<string, unknown>;
  rowIndex: number;
  rowActions: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
}> = ({ row, rowIndex: _rowIndex, rowActions, onRowAction }) => {
  const [state, setState] = useState<RowActionState>({
    pending: null, error: null, errorAction: null, success: null,
  });
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback(async (e: React.MouseEvent, action: RowActionConfig) => {
    e.stopPropagation();
    if (state.pending) return;

    setState(s => ({ ...s, pending: action.key, error: null, errorAction: null, success: null }));

    try {
      // onRowAction may be async (caller wraps useKernelInvoke)
      const result = onRowAction?.(action, row) as unknown;
      if (result instanceof Promise) {
        const resolved = await result as { variant?: string; message?: string } | undefined;
        if (resolved && resolved.variant && resolved.variant !== 'ok') {
          const msg = resolved.message ?? `Action failed: ${resolved.variant}`;
          setState(s => ({ ...s, pending: null, error: msg, errorAction: action.key }));
          return;
        }
      }
      setState(s => ({ ...s, pending: null, success: action.key }));
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setState(s => ({ ...s, success: null }));
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setState(s => ({ ...s, pending: null, error: msg, errorAction: action.key }));
    }
  }, [state.pending, onRowAction, row]);

  return (
    <div data-surface="display-row-actions">
      <div data-part="row-action-list">
        {rowActions.map(action => {
          const { visible, label } = resolveRowAction(action, row);
          if (!visible) return null;
          // ActionBinding path — delegate to ActionButtonCompact
          if (action.actionBindingId) {
            return (
              <ActionButtonCompact
                key={action.key}
                binding={action.actionBindingId}
                context={row}
                label={label}
                buttonVariant={action.variant === 'filled' ? 'primary' : action.variant === 'outlined' ? 'default' : 'ghost'}
              />
            );
          }
          // Legacy path — raw button
          const isPending = state.pending === action.key;
          const isSuccess = state.success === action.key;
          return (
            <button
              key={action.key}
              data-part="button"
              data-variant={isSuccess ? 'ghost' : (action.variant ?? 'ghost')}
              disabled={!!state.pending}
              onClick={(e) => handleAction(e, action)}
              data-state={isSuccess ? 'success' : undefined}
            >
              {isPending ? '...' : isSuccess ? 'Done' : label}
            </button>
          );
        })}
      </div>
      {state.error && state.errorAction && (
        <div data-part="row-action-error">
          <span>{state.error}</span>
          <button
            data-part="button"
            data-variant="ghost"
            data-role="row-action-retry"
            onClick={(e) => {
              e.stopPropagation();
              const action = rowActions.find(a => a.key === state.errorAction);
              if (action) handleAction(e, action);
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

// ─── TableDisplay ─────────────────────────────────────────────────────────

export const TableDisplay: React.FC<TableDisplayProps> = ({
  data, fields, onRowClick, rowActions, onRowAction, groupConfig,
  selectable, bulkActions, onBulkAction,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Resolve a stable row identity — use index as fallback
  const getRowId = useCallback((row: Record<string, unknown>, index: number): number => {
    void row; // row identity is positional for now
    return index;
  }, []);

  const isAllSelected = !!selectable && data.length > 0 && selectedIds.size === data.length;
  const isSomeSelected = !!selectable && selectedIds.size > 0;

  const toggleRow = useCallback((index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === data.length) return new Set();
      return new Set(data.map((_, i) => i));
    });
  }, [data]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkAction = useCallback((actionKey: string) => {
    if (!onBulkAction) return;
    const rows = data.filter((_, i) => selectedIds.has(i));
    onBulkAction(actionKey, rows);
    clearSelection();
  }, [onBulkAction, data, selectedIds, clearSelection]);

  // Reset selection when data changes
  const dataLen = data.length;
  useMemo(() => { setSelectedIds(new Set()); }, [dataLen]);

  const visibleFields = fields.filter(f => f.visible !== false);

  const columns: ColumnDef[] = visibleFields.map(field => ({
    key: field.key,
    label: field.label ?? field.key,
    render: (val) => formatValue(val, field.formatter),
  }));

  // Prepend checkbox column when selectable
  if (selectable) {
    columns.unshift({
      key: '__select',
      label: '',
      sortable: false,
      headerRender: () => (
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => { if (el) el.indeterminate = !isAllSelected && isSomeSelected; }}
          onChange={toggleAll}
          aria-label="Select all rows"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      render: (_val, _row, index) => (
        <input
          type="checkbox"
          checked={selectedIds.has(index ?? 0)}
          onChange={() => toggleRow(index ?? 0)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    });
  }

  if (rowActions && rowActions.length > 0) {
    columns.push({
      key: '__actions',
      label: '',
      sortable: false,
      render: (_val, row, index) => (
        <RowActionButtons
          row={row}
          rowIndex={index ?? 0}
          rowActions={rowActions}
          onRowAction={onRowAction}
        />
      ),
    });
  }

  // Grouped rendering
  const groupField = groupConfig?.fields[0];
  const groups = useMemo(() => {
    if (!groupField) return null;
    return groupData(data, groupField.field, groupField.sort);
  }, [data, groupField]);

  const bulkToolbar = selectable && isSomeSelected && bulkActions && bulkActions.length > 0 ? (
    <BulkActionToolbar
      selectedCount={selectedIds.size}
      totalCount={data.length}
      bulkActions={bulkActions}
      onAction={handleBulkAction}
      onClear={clearSelection}
    />
  ) : null;

  if (groups && groupField) {
    return (
      <>
        {bulkToolbar}
        <GroupedTable
          groups={groups}
          columns={columns}
          onRowClick={onRowClick}
          defaultCollapsed={groupField.defaultCollapsed}
          groupField={groupField.field}
        />
      </>
    );
  }

  return (
    <>
      {bulkToolbar}
      <DataTable
        columns={columns}
        data={data}
        sortable
        ariaLabel="View data"
        onRowClick={onRowClick}
      />
    </>
  );
};

export default TableDisplay;
