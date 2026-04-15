'use client';

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
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
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();
  const { data, loading, refetch } = useConceptQuery<CanvasRecord[]>('ContentNode', 'listBySchema', { schema: 'Canvas' });

  const canvases = data ?? [];

  const openCreate = () => {
    setCreateName('');
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await invoke('Canvas', 'create', { name: createName });
      if (result.variant !== 'ok') {
        setCreateError(String(result.message ?? `Unexpected result: ${result.variant}`));
        return;
      }
      const newId = result.id as string;
      setShowCreate(false);
      refetch?.();
      navigateToHref(`/admin/canvas/${encodeURIComponent(newId)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setCreating(false);
    }
  };

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
          <button data-part="button" data-variant="filled" onClick={openCreate}>
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
              <button data-part="button" data-variant="filled" onClick={openCreate}>
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
            onRowClick={(row) => navigateToHref(`/admin/canvas/${encodeURIComponent(String(row.canvas ?? row.node ?? row.name ?? ''))}`)}
          />
        )}
      </Card>

      {/* Simple name-only create dialog — Canvas ID is auto-generated server-side.
          Invariant: creation MUST NOT require the user to enter node IDs or coordinates.
          Reason: node placement is an interactive concern inside the canvas editor;
          forcing it in a modal leaks implementation detail. */}
      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="canvas-create-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{
            background: 'var(--palette-surface, #fff)',
            borderRadius: 'var(--radius-lg, 8px)',
            padding: 'var(--spacing-xl, 24px)',
            minWidth: 360, maxWidth: 480, width: '100%',
            boxShadow: 'var(--elevation-3, 0 8px 24px rgba(0,0,0,0.15))',
          }}>
            <h2 id="canvas-create-title" style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.25rem' }}>
              Create Canvas
            </h2>

            <label style={{ display: 'block', marginBottom: 'var(--spacing-md)' }}>
              <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Name</span>
              <input
                autoFocus
                data-part="nameInput"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                placeholder="e.g. System Architecture"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--palette-on-surface-variant)', marginTop: 4, display: 'block' }}>
                Optional — a unique ID is generated automatically.
              </span>
            </label>

            {createError && (
              <p role="alert" style={{ color: 'var(--palette-error)', margin: '0 0 var(--spacing-md)' }}>
                {createError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <button
                data-part="button"
                data-variant="outlined"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                data-part="button"
                data-variant="filled"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasBrowserView;
