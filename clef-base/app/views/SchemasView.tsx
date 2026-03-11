'use client';

/**
 * SchemasView — Browse and manage schema definitions
 * Per spec §2.1: One ContentNode, many Schemas. Composable data shapes.
 */

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useNavigator } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

export const SchemasView: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { navigateToHref } = useNavigator();
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('Schema', 'list');

  const schemas = data ?? [];

  const columns: ColumnDef[] = [
    {
      key: 'schema',
      label: 'Schema Name',
      render: (val) => <strong>{String(val)}</strong>,
    },
    {
      key: 'fields',
      label: 'Fields',
      render: (val) => {
        try {
          const fields: string[] = JSON.parse(String(val));
          return <span>{fields.length} fields</span>;
        } catch { return <span>{String(val)}</span>; }
      },
    },
    {
      key: 'extends',
      label: 'Extends',
      render: (val) => val ? <Badge variant="secondary">{String(val)}</Badge> : <span>-</span>,
    },
    {
      key: 'associations',
      label: 'Associations',
      render: (val) => {
        try {
          const assoc: string[] = JSON.parse(String(val));
          return <span>{assoc.length}</span>;
        } catch { return <span>0</span>; }
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Schemas</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{schemas.length}</Badge>
          <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
            Create Schema
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Composable data shapes applied to ContentNodes. A ContentNode can have multiple
        Schemas applied simultaneously. See spec §2.1.
      </p>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : schemas.length === 0 ? (
          <EmptyState title="No schemas" description="Create a schema to define composable data shapes" />
        ) : (
          <DataTable
            columns={columns}
            data={schemas}
            sortable
            ariaLabel="Content schemas"
            onRowClick={(row) => navigateToHref(`/content/${encodeURIComponent(`schema:${row.schema}`)}`)}
          />
        )}
      </Card>

      <CreateForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        concept="Schema"
        action="defineSchema"
        title="Create Schema"
        fields={[
          { name: 'schema', label: 'Schema Name', required: true, placeholder: 'MySchema' },
          { name: 'fields', label: 'Fields (comma-separated)', required: true, placeholder: 'title,body,author,status' },
        ]}
      />
    </div>
  );
};

export default SchemasView;
