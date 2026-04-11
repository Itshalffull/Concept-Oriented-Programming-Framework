'use client';

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useNavigator } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

type CanvasRecord = Record<string, unknown>;

function countJsonArray(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export const CanvasBrowserView: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { navigateToHref } = useNavigator();
  const { data, loading, refetch } = useConceptQuery<CanvasRecord[]>('ContentNode', 'listBySchema', { schema: 'Canvas' });

  const canvases = data ?? [];

  const columns: ColumnDef[] = [
    {
      key: 'name',
      label: 'Canvas',
      render: (val, row) => <strong>{String(val ?? row.canvas ?? row.node ?? '')}</strong>,
    },
    {
      key: 'items',
      label: 'Items',
      render: (val) => <span>{countJsonArray(val)}</span>,
    },
    {
      key: 'connectors',
      label: 'Connectors',
      render: (val) => <span>{countJsonArray(val)}</span>,
    },
    {
      key: 'notation',
      label: 'Notation',
      render: (val) => <Badge variant="info">{String(val ?? 'default')}</Badge>,
    },
    {
      key: 'layout',
      label: 'Layout',
      render: (val) => <span>{String(val ?? 'freeform')}</span>,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Canvas</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{canvases.length}</Badge>
          <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
            Create Canvas
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Browse canvas documents and open them as content entities.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : canvases.length === 0 ? (
          <EmptyState
            title="No canvases yet"
            description="Create a canvas to start organizing diagram content."
            action={
              <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
                Create Canvas
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={canvases}
            sortable
            ariaLabel="Canvas list"
            onRowClick={(row) => navigateToHref(`/content/${encodeURIComponent(String(row.node ?? row.canvas ?? row.name ?? ''))}`)}
          />
        )}
      </Card>

      <CreateForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        concept="Canvas"
        action="addNode"
        title="Create Canvas"
        fields={[
          { name: 'canvas', label: 'Canvas Id', required: true, placeholder: 'canvas:example' },
          { name: 'node', label: 'Initial Node', required: true, placeholder: 'node:1' },
          { name: 'x', label: 'X', type: 'number', placeholder: '0' },
          { name: 'y', label: 'Y', type: 'number', placeholder: '0' },
        ]}
      />
    </div>
  );
};

export default CanvasBrowserView;
