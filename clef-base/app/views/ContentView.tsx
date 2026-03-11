'use client';

/**
 * ContentView — Universal content browser
 * Per spec §2.1: All ContentNodes in one pool, searchable across all Schemas
 */

import React, { useState } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useNavigator } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

const TYPE_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'error'> = {
  concept: 'primary',
  schema: 'info',
  article: 'success',
  page: 'success',
  media: 'warning',
  workflow: 'secondary',
  'automation-rule': 'secondary',
  view: 'info',
  theme: 'warning',
  'display-mode': 'info',
};

export const ContentView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { navigateToHref } = useNavigator();
  const { data, loading, refetch } = useConceptQuery<Record<string, unknown>[]>('ContentNode', 'list');

  const items = (data ?? []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(item.node ?? '').toLowerCase().includes(q) ||
      String(item.type ?? '').toLowerCase().includes(q) ||
      String(item.content ?? '').toLowerCase().includes(q)
    );
  });

  const columns: ColumnDef[] = [
    {
      key: 'node',
      label: 'Name',
      render: (val) => {
        const name = String(val).replace(/^(concept|schema):/, '');
        return <strong>{name}</strong>;
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <Badge variant={TYPE_COLORS[String(val)] ?? 'secondary'}>
          {String(val)}
        </Badge>
      ),
    },
    {
      key: 'createdBy',
      label: 'Created By',
      render: (val) => <span>{String(val ?? 'unknown')}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (val) => {
        if (!val) return <span>-</span>;
        const d = new Date(String(val));
        return <span>{d.toLocaleDateString()}</span>;
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Content</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{items.length} items</Badge>
          <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
            Create Content
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Browse all content entities in the system. Every piece of data is a ContentNode.
      </p>

      <div data-part="search-input" style={{ marginBottom: 'var(--spacing-lg)', maxWidth: '500px' }}>
        <input
          type="text"
          placeholder="Filter by name, type, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card variant="outlined" padding="none">
        {loading ? (
          <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No content found"
            description={searchQuery ? 'Try a different search term' : 'Create your first content node'}
            action={
              <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
                Create Content
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            sortable
            ariaLabel="Content nodes"
            onRowClick={(row) => navigateToHref(`/content/${encodeURIComponent(String(row.node))}`)}
          />
        )}
      </Card>

      <CreateForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        concept="ContentNode"
        action="create"
        title="Create Content Node"
        fields={[
          { name: 'node', label: 'Node ID', required: true, placeholder: 'unique-id' },
          { name: 'type', label: 'Type', type: 'select', options: ['article', 'page', 'media', 'concept', 'schema', 'workflow', 'view', 'theme'], required: true },
          { name: 'content', label: 'Content', type: 'textarea', placeholder: 'Content body...' },
          { name: 'createdBy', label: 'Created By', placeholder: 'user' },
        ]}
      />
    </div>
  );
};

export default ContentView;
