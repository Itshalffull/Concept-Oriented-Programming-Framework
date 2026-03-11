'use client';

/**
 * ViewsView — View query builder
 * Views are saved queries with display mode config
 */

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'view', label: 'View ID', required: true, placeholder: 'e.g. all-articles' },
  { name: 'dataSource', label: 'Data Source', required: true, placeholder: 'e.g. ContentNode' },
  { name: 'layout', label: 'Layout', type: 'select' as const, options: ['table', 'kanban', 'list', 'calendar', 'gallery'] },
];

function summarize(val: unknown): string {
  if (!val) return '--';
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return `${parsed.length} items`;
      return val.length > 40 ? val.slice(0, 40) + '...' : val;
    } catch {
      return val.length > 40 ? val.slice(0, 40) + '...' : val;
    }
  }
  if (Array.isArray(val)) return `${val.length} items`;
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 40) + '...';
  return String(val);
}

const columns: ColumnDef[] = [
  { key: 'view', label: 'View', render: (val, row) => <code>{String(val ?? row.name ?? row.id)}</code> },
  { key: 'dataSource', label: 'Data Source', render: (val) => <Badge variant="info">{String(val ?? '--')}</Badge> },
  { key: 'layout', label: 'Layout', render: (val) => <Badge variant="secondary">{String(val ?? 'table')}</Badge> },
  {
    key: 'filters',
    label: 'Filters',
    render: (val) => (
      <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
        {summarize(val)}
      </span>
    ),
  },
  {
    key: 'sorts',
    label: 'Sorts',
    render: (val) => (
      <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
        {summarize(val)}
      </span>
    ),
  },
];

export const ViewsView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('View', 'list');
  const { navigateToHref } = useNavigator();

  const rows = data ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Views</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create View
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Views are saved queries with display configuration. A View defines a data source,
        filters, sorts, and a display mode. Embed views in layouts to create dynamic pages.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No views configured"
            description="Create a View to define a saved query with display settings. Views can render as tables, kanban boards, lists, calendars, or any layout."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            sortable
            ariaLabel="Views"
            onRowClick={(row) => navigateToHref(`/content/${row.view ?? row.id}`)}
          />
        )}
      </Card>

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="View"
        action="create"
        title="Create View"
        fields={createFields}
      />
    </div>
  );
};

export default ViewsView;
