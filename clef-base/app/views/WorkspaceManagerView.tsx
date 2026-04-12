'use client';

/**
 * WorkspaceManagerView — Manage saved workspace layouts.
 * Create, rename, duplicate, delete workspaces and set the default.
 */

import React, { useState, useCallback } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

interface WorkspaceRecord {
  workspace: string;
  name: string;
  owner: string;
  description?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const WorkspaceManagerView: React.FC = () => {
  const invoke = useKernelInvoke();
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const { data: workspacesRaw, loading, refetch } = useConceptQuery<Record<string, unknown>>(
    'Workspace', 'list', { owner: 'system' },
  );

  const workspaces: WorkspaceRecord[] = (() => {
    if (!workspacesRaw) return [];
    const raw = workspacesRaw as Record<string, unknown>;
    if (typeof raw.workspaces === 'string') {
      try { return JSON.parse(raw.workspaces); } catch { return []; }
    }
    return Array.isArray(raw.workspaces) ? raw.workspaces as WorkspaceRecord[] : [];
  })();

  const handleSetDefault = useCallback(async (workspaceId: string) => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('Workspace', 'setDefault', { workspace: workspaceId });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to set default workspace.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to set default workspace.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, refetch]);

  const handleDelete = useCallback(async (workspaceId: string) => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('Workspace', 'delete', { workspace: workspaceId });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to delete workspace.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete workspace.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, refetch]);

  const handleDuplicate = useCallback(async (workspaceId: string, name: string) => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('Workspace', 'duplicate', {
        workspace: workspaceId,
        newName: `${name} (copy)`,
      });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to duplicate workspace.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate workspace.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, refetch]);

  const handleRestore = useCallback(async (workspaceId: string) => {
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('Workspace', 'restore', { workspace: workspaceId });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to restore workspace.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to restore workspace.');
    } finally {
      setActionPending(false);
    }
  }, [invoke]);

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Workspaces</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Workspaces</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{workspaces.length}</Badge>
          <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
            Create Workspace
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Save and restore your panel arrangement. Each workspace remembers tab groups, splits, and dock positions.
      </p>
      {actionError && (
        <div style={{
          marginBottom: 'var(--spacing-md)',
          padding: '8px 12px',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{actionError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1 }} onClick={() => setActionError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {workspaces.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            title="No workspaces"
            description="Create a workspace to save your current layout arrangement."
            action={
              <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
                Create Workspace
              </button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
          {workspaces.map((ws) => (
            <Card key={ws.workspace} variant="outlined" style={{ padding: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>{ws.name}</div>
                  {ws.description && (
                    <div style={{ fontSize: '13px', color: 'var(--palette-on-surface-variant)', marginTop: '2px' }}>
                      {ws.description}
                    </div>
                  )}
                </div>
                {ws.isDefault && <Badge variant="primary">Default</Badge>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <button data-part="button" data-variant="filled" onClick={() => handleRestore(ws.workspace)} disabled={actionPending}>
                  Restore
                </button>
                {!ws.isDefault && (
                  <button data-part="button" data-variant="outlined" onClick={() => handleSetDefault(ws.workspace)} disabled={actionPending}>
                    Set Default
                  </button>
                )}
                <button data-part="button" data-variant="outlined" onClick={() => handleDuplicate(ws.workspace, ws.name)} disabled={actionPending}>
                  Duplicate
                </button>
                <button data-part="button" data-variant="outlined" onClick={() => handleDelete(ws.workspace)} disabled={actionPending}>
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        concept="Workspace"
        action="create"
        title="Create Workspace"
        fields={[
          { name: 'workspace', label: 'Workspace ID', required: true },
          { name: 'name', label: 'Display Name', required: true },
          { name: 'owner', label: 'Owner', required: true, placeholder: 'system' },
          { name: 'description', label: 'Description' },
        ]}
      />
    </div>
  );
};

export default WorkspaceManagerView;
