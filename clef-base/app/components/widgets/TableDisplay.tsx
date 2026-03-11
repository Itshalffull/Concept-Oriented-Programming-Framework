'use client';

/**
 * TableDisplay — renders View data as a sortable DataTable.
 * Display type component: receives data + field config from ViewRenderer.
 */

import React from 'react';
import { DataTable, type ColumnDef } from './DataTable';
import { Badge } from './Badge';

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

export const TableDisplay: React.FC<TableDisplayProps> = ({ data, fields, onRowClick }) => {
  const visibleFields = fields.filter(f => f.visible !== false);

  const columns: ColumnDef[] = visibleFields.map(field => ({
    key: field.key,
    label: field.label ?? field.key,
    render: (val) => formatValue(val, field.formatter),
  }));

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
