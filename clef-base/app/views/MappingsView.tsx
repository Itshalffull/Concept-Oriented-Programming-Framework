'use client';

/**
 * MappingsView — Component mapping configuration
 * Widget <-> Schema <-> DisplayMode bindings
 */

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { Badge } from '../components/widgets/Badge';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'schema', label: 'Schema', required: true, placeholder: 'e.g. Article' },
  { name: 'displayMode', label: 'Display Mode', required: true, placeholder: 'e.g. entity-page' },
  { name: 'widget', label: 'Widget', required: true, placeholder: 'e.g. fieldset-widget' },
];

const columns: ColumnDef[] = [
  { key: 'schema', label: 'Schema', render: (val) => <code>{String(val)}</code> },
  { key: 'displayMode', label: 'Display Mode', render: (val) => <Badge variant="primary">{String(val)}</Badge> },
  { key: 'widget', label: 'Widget', render: (val) => <code>{String(val)}</code> },
  { key: 'slots', label: 'Slots' },
  {
    key: 'status',
    label: 'Status',
    render: (val) => <Badge variant={val === 'active' ? 'success' : 'warning'}>{String(val ?? 'unknown')}</Badge>,
  },
];

export const MappingsView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('ComponentMapping', 'list');
  const { navigateToHref } = useNavigator();

  // Handle response: data may be the array directly, or may have items/mappings field
  let rows: Record<string, unknown>[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) rows = obj.items as Record<string, unknown>[];
    else if (Array.isArray(obj.mappings)) rows = obj.mappings as Record<string, unknown>[];
  }

  return (
    <div>
      <div className="page-header">
        <h1>Component Mappings</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Mapping
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Mappings bind widgets to Schema + DisplayMode pairs, configuring which data sources
        feed each widget slot.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No mappings configured"
            description="Create a component mapping to bind widgets to content schemas"
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            sortable
            ariaLabel="Component mappings"
            onRowClick={(row) => navigateToHref(`/content/${row.id ?? row.schema}`)}
          />
        )}
      </Card>

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="ComponentMapping"
        action="create"
        title="Create Component Mapping"
        fields={createFields}
      />
    </div>
  );
};

export default MappingsView;
