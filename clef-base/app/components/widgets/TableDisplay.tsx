'use client';

/**
 * TableDisplay — renders View data as a sortable DataTable.
 * Display type component: receives data + field config from ViewRenderer.
 *
 * Supports optional grouping: when groupConfig is provided, rows are
 * partitioned into collapsible sections with group headers showing
 * the field value and item count.
 */

import React, { useMemo, useState } from 'react';
import { DataTable, type ColumnDef } from './DataTable';
import { Badge } from './Badge';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';
import type { GroupConfig } from '../../../lib/view-types';

export interface FieldConfig {
  key: string;
  label?: string;
  formatter?: string;
  visible?: boolean;
  weight?: number;
}

interface TableDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  groupConfig?: GroupConfig;
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
        <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {schemas.map((s: unknown) => (
            <Badge key={String(s)} variant="info">{String(s)}</Badge>
          ))}
        </span>
      );
    }

    case 'code':
      return <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{String(value)}</code>;

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
    <table data-part="data-table" role="grid" aria-label="Grouped view data">
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
              onClick={() => toggle(group.key)}
              style={{
                cursor: 'pointer',
                background: 'var(--palette-surface-variant)',
              }}
            >
              <td
                colSpan={displayColumns.length}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  fontWeight: 600,
                  fontSize: 'var(--typography-label-md-size, 13px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 16,
                  textAlign: 'center',
                  fontSize: '10px',
                  transition: 'transform 0.15s',
                  transform: collapsed.has(group.key) ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}>
                  ▼
                </span>
                <span>{group.key}</span>
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

export const TableDisplay: React.FC<TableDisplayProps> = ({
  data, fields, onRowClick, rowActions, onRowAction, groupConfig,
}) => {
  const visibleFields = fields.filter(f => f.visible !== false);

  const columns: ColumnDef[] = visibleFields.map(field => ({
    key: field.key,
    label: field.label ?? field.key,
    render: (val) => formatValue(val, field.formatter),
  }));

  if (rowActions && rowActions.length > 0) {
    columns.push({
      key: '__actions',
      label: '',
      sortable: false,
      render: (_val, row) => (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          {rowActions.map(action => {
            const { visible, label } = resolveRowAction(action, row);
            if (!visible) return null;
            return (
              <button
                key={action.key}
                data-part="button"
                data-variant={action.variant ?? 'ghost'}
                onClick={(e) => { e.stopPropagation(); onRowAction?.(action, row); }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ),
    });
  }

  // Grouped rendering
  const groupField = groupConfig?.fields[0];
  const groups = useMemo(() => {
    if (!groupField) return null;
    return groupData(data, groupField.field, groupField.sort);
  }, [data, groupField]);

  if (groups && groupField) {
    return (
      <GroupedTable
        groups={groups}
        columns={columns}
        onRowClick={onRowClick}
        defaultCollapsed={groupField.defaultCollapsed}
        groupField={groupField.field}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      sortable
      ariaLabel="View data"
      onRowClick={onRowClick}
    />
  );
};

export default TableDisplay;
