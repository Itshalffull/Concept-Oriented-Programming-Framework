'use client';

import React, { useState } from 'react';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';

const createFields = [
  { name: 'rule', label: 'Rule ID', required: true, placeholder: 'e.g. notify-on-publish' },
  { name: 'trigger', label: 'Trigger', required: true, placeholder: 'e.g. ContentStorage/save' },
  { name: 'conditions', label: 'Conditions', type: 'textarea' as const, placeholder: 'JSON conditions (optional)' },
  { name: 'actions', label: 'Actions', required: true, placeholder: 'e.g. Notification/send' },
];

const columns: ColumnDef[] = [
  { key: 'rule', label: 'Rule', render: (val) => <code>{String(val)}</code> },
  { key: 'trigger', label: 'Trigger', render: (val) => <code>{String(val)}</code> },
  {
    key: 'conditions',
    label: 'Conditions',
    render: (val) => {
      const str = String(val ?? '');
      return (
        <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
          {str.length > 60 ? str.slice(0, 60) + '...' : str || '--'}
        </span>
      );
    },
  },
  {
    key: 'enabled',
    label: 'Enabled',
    render: (val) => (
      <Badge variant={val ? 'success' : 'warning'}>{val ? 'enabled' : 'disabled'}</Badge>
    ),
  },
  { key: 'actions', label: 'Actions', render: (val) => <code>{String(val)}</code> },
];

export const AutomationsView: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('AutomationRule', 'list');
  const { navigateToHref } = useNavigator();

  const rows = data ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Automations</h1>
        <button data-part="button" data-variant="filled" onClick={() => setCreateOpen(true)}>
          Create Automation
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Automation rules trigger actions in response to events — like sending notifications
        when content is published or running validation when schemas change. Each rule is
        a ContentNode with Schema &quot;AutomationRule&quot;.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No automation rules"
            description="Create an automation rule to define event-driven actions. Rules use the same sync pattern as the rest of the framework."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            sortable
            ariaLabel="Automation rules"
            onRowClick={(row) => navigateToHref(`/content/${row.rule ?? row.id}`)}
          />
        )}
      </Card>

      <CreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
        concept="AutomationRule"
        action="define"
        title="Create Automation Rule"
        fields={createFields}
      />
    </div>
  );
};

export default AutomationsView;
