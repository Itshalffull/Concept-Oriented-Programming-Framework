'use client';

/**
 * WorkflowsView — Workflow state machine browser
 * Per spec: Workflows define content moderation state machines
 */

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

export const WorkflowsView: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('Workflow', 'list');

  const workflows = data ?? [];

  const handleCreate = async () => {
    setShowCreate(true);
  };

  const columns: ColumnDef[] = [
    {
      key: 'workflow',
      label: 'Workflow',
      render: (val) => <strong>{String(val)}</strong>,
    },
    {
      key: 'states',
      label: 'States',
      render: (val) => {
        try {
          const states = JSON.parse(String(val));
          return <Badge variant="info">{states.length} states</Badge>;
        } catch { return <span>0</span>; }
      },
    },
    {
      key: 'transitions',
      label: 'Transitions',
      render: (val) => {
        try {
          const transitions = JSON.parse(String(val));
          return <span>{transitions.length}</span>;
        } catch { return <span>0</span>; }
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Workflows</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{workflows.length}</Badge>
          <button data-part="button" data-variant="filled" onClick={handleCreate}>
            Create Workflow
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Workflows define content moderation state machines — states like Draft, Review,
        Published with transitions between them.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : workflows.length === 0 ? (
          <EmptyState
            title="No workflows defined"
            description="Create a workflow to define content moderation states and transitions."
            action={
              <button data-part="button" data-variant="filled" onClick={handleCreate}>
                Create Workflow
              </button>
            }
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={workflows}
              sortable
              ariaLabel="Workflows"
              onRowClick={(row) => navigateToHref(`/content/${encodeURIComponent(`workflow:${row.workflow}`)}`)}
            />
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', borderTop: '1px solid var(--palette-outline-variant)', display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              {workflows.map((w) => (
                <button
                  key={String(w.workflow)}
                  data-part="button"
                  data-variant="outlined"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  title={`Open Flow Builder for ${w.workflow}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToHref(`/admin/processes/${encodeURIComponent(String(w.workflow))}/edit`);
                  }}
                >
                  Edit flow: {String(w.workflow)}
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <CreateForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        concept="Workflow"
        action="defineState"
        title="Create Workflow"
        fields={[
          { name: 'workflow', label: 'Workflow Name', required: true, placeholder: 'content-moderation' },
          { name: 'name', label: 'Initial State Name', required: true, placeholder: 'draft' },
          { name: 'flags', label: 'Flags', placeholder: 'initial' },
        ]}
      />
    </div>
  );
};

export default WorkflowsView;
