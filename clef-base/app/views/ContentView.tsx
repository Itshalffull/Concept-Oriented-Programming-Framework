'use client';

/**
 * ContentView — Universal content browser
 * Per spec §2.1: All ContentNodes in one pool, identity from Schema membership.
 * Supports filtering by multiple schemas with AND/OR grouping.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { CreateForm } from '../components/widgets/CreateForm';
import { useNavigator } from '../../lib/clef-provider';
import { useContentNodes, type EnrichedContentNode } from '../../lib/use-content-nodes';
import { useConceptQuery } from '../../lib/use-concept-query';

const SCHEMA_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'error'> = {
  Concept: 'primary',
  Schema: 'info',
  Sync: 'warning',
  Widget: 'info',
  Workflow: 'secondary',
  AutomationRule: 'secondary',
  Taxonomy: 'success',
  Theme: 'warning',
  DisplayMode: 'info',
  VersionSpace: 'primary',
  VersionOverride: 'secondary',
  Article: 'success',
  Page: 'success',
  Media: 'warning',
};

type FilterMode = 'or' | 'and';

export const ContentView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeSchemas, setActiveSchemas] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('or');
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const { navigateToHref } = useNavigator();
  const { data, loading, refetch } = useContentNodes();
  const { data: allSchemas } = useConceptQuery<Record<string, unknown>[]>('Schema', 'list');

  // Available schema names from both defined schemas and actual memberships
  const availableSchemas = useMemo(() => {
    const fromData = new Set<string>();
    for (const item of data ?? []) {
      for (const s of item.schemas) fromData.add(s);
    }
    const fromDefined = new Set<string>();
    for (const s of allSchemas ?? []) {
      fromDefined.add(s.schema as string);
    }
    return [...new Set([...fromData, ...fromDefined])].sort();
  }, [data, allSchemas]);

  // Initialize filters: all schemas on by default
  if (!filtersInitialized && availableSchemas.length > 0) {
    setActiveSchemas(new Set(availableSchemas));
    setFiltersInitialized(true);
  }

  // Apply search + schema filters
  const items = useMemo(() => {
    let filtered = data ?? [];

    // Schema filter
    if (activeSchemas.size > 0 && activeSchemas.size < availableSchemas.length) {
      filtered = filtered.filter((item) => {
        if (item.schemas.length === 0) return false;
        if (filterMode === 'or') {
          return item.schemas.some((s) => activeSchemas.has(s));
        } else {
          // AND: node must have ALL active schemas
          return [...activeSchemas].every((s) => item.schemas.includes(s));
        }
      });
    }

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        String(item.node ?? '').toLowerCase().includes(q) ||
        item.schemas.some((s) => s.toLowerCase().includes(q)) ||
        String(item.content ?? '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [data, searchQuery, activeSchemas, availableSchemas.length, filterMode]);

  const toggleSchema = useCallback((schema: string) => {
    setActiveSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setActiveSchemas((prev) => {
      const allOn = availableSchemas.every((s) => prev.has(s));
      return allOn ? new Set<string>() : new Set(availableSchemas);
    });
  }, [availableSchemas]);

  const columns: ColumnDef[] = [
    {
      key: 'node',
      label: 'Name',
      render: (val) => {
        const name = String(val).replace(/^(concept|schema|sync|widget|workflow|taxonomy):/, '');
        return <strong>{name}</strong>;
      },
    },
    {
      key: 'schemas',
      label: 'Schemas',
      render: (val) => {
        const schemas = Array.isArray(val) ? val : [];
        if (schemas.length === 0) return <Badge variant="secondary">none</Badge>;
        return (
          <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {schemas.map((s: string) => (
              <Badge key={s} variant={SCHEMA_COLORS[s] ?? 'secondary'}>
                {s}
              </Badge>
            ))}
          </span>
        );
      },
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
          <Badge variant="info">{items.length}{data && items.length !== data.length ? `/${data.length}` : ''} items</Badge>
          <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
            Create Content
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-md)' }}>
        Browse all content entities in the system. Every entity is a ContentNode — identity comes from applied Schemas.
      </p>

      {/* Schema filter toggles with AND/OR mode */}
      {availableSchemas.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            <button
              data-part="filter-toggle"
              onClick={toggleAll}
              style={{
                padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--palette-outline-variant)',
                background: availableSchemas.every((s) => activeSchemas.has(s))
                  ? 'var(--palette-surface-variant)' : 'var(--palette-surface)',
                color: 'var(--palette-on-surface-variant)', cursor: 'pointer',
                fontFamily: 'var(--typography-font-family-mono)',
              }}
            >
              Schemas: all
            </button>
            <button
              data-part="filter-toggle"
              onClick={() => setFilterMode((m) => m === 'or' ? 'and' : 'or')}
              style={{
                padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--palette-primary)',
                background: 'var(--palette-surface)',
                color: 'var(--palette-primary)', cursor: 'pointer',
                fontFamily: 'var(--typography-font-family-mono)',
                fontWeight: 600,
              }}
            >
              {filterMode.toUpperCase()}
            </button>
            {availableSchemas.map((schema) => {
              const isOn = activeSchemas.has(schema);
              const count = (data ?? []).filter((n) => n.schemas.includes(schema)).length;
              return (
                <button
                  key={schema}
                  data-part="filter-toggle"
                  onClick={() => toggleSchema(schema)}
                  style={{
                    padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isOn ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                    background: isOn ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                    color: isOn ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface-variant)',
                    cursor: 'pointer', opacity: isOn ? 1 : 0.5,
                    fontFamily: 'var(--typography-font-family-mono)',
                  }}
                >
                  {schema} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div data-part="search-input" style={{ marginBottom: 'var(--spacing-lg)', maxWidth: '500px' }}>
        <input
          type="text"
          placeholder="Filter by name, schema, or content..."
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
          { name: 'content', label: 'Content (JSON)', type: 'textarea', placeholder: '{"title": "My Entity"}' },
          { name: 'createdBy', label: 'Created By', placeholder: 'user' },
        ]}
      />
    </div>
  );
};

export default ContentView;
