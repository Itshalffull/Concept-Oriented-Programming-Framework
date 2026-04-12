'use client';

/**
 * WorkspaceManagerView — Manage saved workspace layouts.
 * Create, rename, duplicate, delete workspaces and set the default.
 */

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { ActionButton } from '../components/widgets/ActionButton';
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
  const [showCreate, setShowCreate] = useState(false);
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
                <ActionButton
                  binding="workspace-restore"
                  context={{ workspace: ws.workspace }}
                  label="Restore"
                  buttonVariant="primary"
                  onSuccess={() => refetch()}
                />
                {!ws.isDefault && (
                  <ActionButton
                    binding="workspace-set-default"
                    context={{ workspace: ws.workspace }}
                    label="Set Default"
                    buttonVariant="secondary"
                    onSuccess={() => refetch()}
                  />
                )}
                <ActionButton
                  binding="workspace-duplicate"
                  context={{ workspace: ws.workspace, newName: `${ws.name} (copy)` }}
                  label="Duplicate"
                  buttonVariant="secondary"
                  onSuccess={() => refetch()}
                />
                <ActionButton
                  binding="workspace-delete"
                  context={{ workspace: ws.workspace }}
                  label="Delete"
                  buttonVariant="ghost"
                  onSuccess={() => refetch()}
                />
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
