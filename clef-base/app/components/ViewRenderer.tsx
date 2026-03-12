'use client';

/**
 * ViewRenderer — generic component that loads a View config entity from the
 * kernel and renders it using the appropriate display type component.
 *
 * Flow:
 * 1. invoke('View', 'get', { view: viewId }) → loads the View config
 * 2. Parse dataSource → { concept, action, params }
 * 3. invoke(concept, action, params) → fetches the data
 * 4. Parse filters → exposed filter controls rendered in header
 * 5. Render filtered data through the display type (table, card-grid, graph, etc.)
 * 6. Wire controls (create button, row click, etc.)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from './widgets/Card';
import { Badge } from './widgets/Badge';
import { EmptyState } from './widgets/EmptyState';
import { CreateForm } from './widgets/CreateForm';
import { TableDisplay, type FieldConfig } from './widgets/TableDisplay';
import { CardGridDisplay } from './widgets/CardGridDisplay';
import { GraphDisplay } from './widgets/GraphDisplay';
import { CanvasDisplay } from './widgets/CanvasDisplay';
import { StatCardsDisplay } from './widgets/StatCardsDisplay';
import { DetailDisplay } from './widgets/DetailDisplay';
import { ContentBodyDisplay } from './widgets/ContentBodyDisplay';
import { useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

interface ViewConfig {
  view: string;
  dataSource: string;
  layout: string;
  filters: string;
  sorts: string;
  groups: string;
  visibleFields: string;
  formatting: string;
  controls: string;
  title: string;
  description: string;
}

interface DataSourceConfig {
  concept: string;
  action: string;
  params?: Record<string, unknown>;
}

interface FilterConfig {
  field: string;
  label?: string;
  type: 'toggle-group';
  /** Values that are ON by default. If omitted, all values are on. */
  defaultOn?: string[];
  /** Values that are OFF by default. */
  defaultOff?: string[];
}

interface ControlsConfig {
  create?: {
    concept: string;
    action: string;
    fields: Array<{
      name: string;
      label?: string;
      type?: string;
      options?: string[];
      required?: boolean;
      placeholder?: string;
    }>;
  };
  rowClick?: {
    navigateTo: string;
  };
}

interface ViewRendererProps {
  viewId: string;
  title?: string;
  /** Context variables for template resolution — replaces {{var}} in dataSource params */
  context?: Record<string, string>;
  children?: React.ReactNode;
}

/** Resolve {{var}} template placeholders in an object using context */
function resolveTemplates(obj: Record<string, unknown>, context: Record<string, string>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName) => context[varName] ?? '');
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveTemplates(value as Record<string, unknown>, context);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export const ViewRenderer: React.FC<ViewRendererProps> = ({ viewId, title: titleOverride, context, children }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();
  const [showCreate, setShowCreate] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Step 1: Load the View config
  const { data: viewConfig, loading: configLoading, error: configError } =
    useConceptQuery<ViewConfig>('View', 'get', { view: viewId });

  // Parse the config
  let dataSource: DataSourceConfig | null = null;
  let fields: FieldConfig[] = [];
  let controls: ControlsConfig = {};
  let filters: FilterConfig[] = [];

  if (viewConfig) {
    try { dataSource = JSON.parse(viewConfig.dataSource); } catch { /* empty */ }
    try { fields = JSON.parse(viewConfig.visibleFields); } catch { /* empty */ }
    try { controls = JSON.parse(viewConfig.controls); } catch { /* empty */ }
    try {
      const parsed = JSON.parse(viewConfig.filters);
      if (Array.isArray(parsed)) filters = parsed;
    } catch { /* empty */ }
  }

  // Resolve template variables in dataSource params using context
  const resolvedParams = useMemo(() => {
    if (!dataSource?.params || !context) return dataSource?.params;
    return resolveTemplates(dataSource.params, context);
  }, [dataSource?.params, context]);

  // Step 2: Fetch data using the dataSource config
  const { data: rawData, loading: dataLoading, error: dataError, refetch } =
    useConceptQuery<Record<string, unknown>[] | Record<string, unknown>>(
      dataSource?.concept ?? '__none__',
      dataSource?.action ?? '__none__',
      resolvedParams,
    );

  // Normalize: wrap single-object results into array for uniform handling
  const allData = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    return [rawData];
  }, [rawData]);

  // Initialize filter state from data + config once data arrives
  if (allData.length > 0 && filters.length > 0 && !filtersInitialized) {
    const initial: Record<string, Set<string>> = {};
    for (const filter of filters) {
      const allValues = [...new Set(allData.map((row) => String(row[filter.field] ?? '')))];
      if (filter.defaultOn) {
        initial[filter.field] = new Set(filter.defaultOn);
      } else if (filter.defaultOff) {
        const offSet = new Set(filter.defaultOff);
        initial[filter.field] = new Set(allValues.filter((v) => !offSet.has(v)));
      } else {
        initial[filter.field] = new Set(allValues);
      }
    }
    setActiveFilters(initial);
    setFiltersInitialized(true);
  }

  // Apply filters to data
  const displayData = useMemo(() => {
    if (filters.length === 0 || Object.keys(activeFilters).length === 0) return allData;
    return allData.filter((row) => {
      for (const filter of filters) {
        const active = activeFilters[filter.field];
        if (active && !active.has(String(row[filter.field] ?? ''))) return false;
      }
      return true;
    });
  }, [allData, activeFilters, filters]);

  const layout = viewConfig?.layout ?? 'table';
  const viewTitle = titleOverride ?? viewConfig?.title ?? viewId;
  const viewDescription = viewConfig?.description ?? '';
  const loading = configLoading || dataLoading;

  // Toggle a filter value
  const toggleFilter = useCallback((field: string, value: string) => {
    setActiveFilters((prev) => {
      const current = new Set(prev[field] ?? []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [field]: current };
    });
  }, []);

  // Toggle all values for a filter field
  const toggleAllFilter = useCallback((field: string, allValues: string[]) => {
    setActiveFilters((prev) => {
      const current = prev[field] ?? new Set();
      const allOn = allValues.every((v) => current.has(v));
      return { ...prev, [field]: allOn ? new Set<string>() : new Set(allValues) };
    });
  }, []);

  // Row click handler
  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    if (!controls.rowClick?.navigateTo) return;
    let path = controls.rowClick.navigateTo;
    path = path.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(String(row[key] ?? '')));
    navigateToHref(path);
  }, [controls.rowClick, navigateToHref]);

  // Loading state
  if (loading && !viewConfig) {
    return (
      <div>
        <div className="page-header"><h1>{viewTitle}</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading...</p>
      </div>
    );
  }

  // Error state
  if (configError) {
    return (
      <div>
        <div className="page-header"><h1>{viewId}</h1></div>
        <Card variant="outlined">
          <EmptyState title={`View "${viewId}" not found`} description={configError} />
        </Card>
      </div>
    );
  }

  // Render filter controls
  const renderFilters = () => {
    if (filters.length === 0 || allData.length === 0) return null;

    // Color map for common types
    const TYPE_COLORS: Record<string, string> = {
      concept: '#6366f1', schema: '#10b981', sync: '#f59e0b', suite: '#ec4899',
      workflow: '#8b5cf6', theme: '#06b6d4', view: '#3b82f6',
      'display-mode': '#14b8a6', 'automation-rule': '#f97316', taxonomy: '#84cc16',
      'version-space': '#a855f7',
    };

    return filters.map((filter) => {
      const allValues = [...new Set(allData.map((row) => String(row[filter.field] ?? '')))].sort();
      const active = activeFilters[filter.field] ?? new Set(allValues);

      return (
        <div key={filter.field} style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px',
          marginBottom: 'var(--spacing-sm)',
        }}>
          <button
            data-part="filter-toggle"
            onClick={() => toggleAllFilter(filter.field, allValues)}
            style={{
              padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--palette-outline-variant)',
              background: allValues.every((v) => active.has(v))
                ? 'var(--palette-surface-variant)' : 'var(--palette-surface)',
              color: 'var(--palette-on-surface-variant)', cursor: 'pointer',
              fontFamily: 'var(--typography-font-family-mono)',
            }}
          >
            {filter.label ?? filter.field}: all
          </button>
          {allValues.map((value) => {
            const isOn = active.has(value);
            const dotColor = TYPE_COLORS[value] ?? '#64748b';
            const count = allData.filter((row) => String(row[filter.field] ?? '') === value).length;
            return (
              <button
                key={value}
                data-part="filter-toggle"
                onClick={() => toggleFilter(filter.field, value)}
                style={{
                  padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isOn ? dotColor : 'var(--palette-outline-variant)'}`,
                  background: isOn ? `${dotColor}18` : 'var(--palette-surface)',
                  color: isOn ? 'var(--palette-on-surface)' : 'var(--palette-on-surface-variant)',
                  cursor: 'pointer', opacity: isOn ? 1 : 0.5,
                  fontFamily: 'var(--typography-font-family-mono)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <span style={{
                  display: 'inline-block', width: 6, height: 6,
                  borderRadius: '50%', background: dotColor,
                  opacity: isOn ? 1 : 0.3,
                }} />
                {value} ({count})
              </button>
            );
          })}
        </div>
      );
    });
  };

  // Render the display type
  const renderDisplay = () => {
    if (dataLoading) {
      return (
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>
          Loading data...
        </div>
      );
    }

    if (dataError) {
      return <EmptyState title="Query failed" description={dataError} />;
    }

    if (displayData.length === 0) {
      return (
        <EmptyState
          title={`No ${viewTitle.toLowerCase()} found`}
          description={controls.create ? 'Create one to get started.' : 'No data available.'}
          action={controls.create ? (
            <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
              Create
            </button>
          ) : undefined}
        />
      );
    }

    switch (layout) {
      case 'detail':
        return (
          <DetailDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
            onFieldSave={async (field, value) => {
              if (displayData[0]) {
                const entity = displayData[0];
                const node = entity.node as string;
                if (node) {
                  if (field === 'content') {
                    await invoke('ContentNode', 'update', { node, content: value });
                  } else if (field === 'metadata') {
                    await invoke('ContentNode', 'setMetadata', { node, metadata: value });
                  } else if (field === 'type') {
                    await invoke('ContentNode', 'changeType', { node, type: value });
                  }
                  refetch();
                }
              }
            }}
          />
        );

      case 'content-body':
        return (
          <ContentBodyDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
            onFieldSave={async (field, value) => {
              if (displayData[0]) {
                const entity = displayData[0];
                const node = entity.node as string;
                if (node) {
                  await invoke('ContentNode', 'update', { node, content: value });
                  refetch();
                }
              }
            }}
          />
        );

      case 'card-grid':
        return (
          <CardGridDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
          />
        );

      case 'canvas':
        return (
          <CanvasDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
          />
        );

      case 'graph':
        return (
          <GraphDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
          />
        );

      case 'stat-cards':
        return (
          <StatCardsDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
          />
        );

      case 'table':
      default:
        return (
          <Card variant="outlined" padding="none">
            <TableDisplay
              data={displayData} fields={fields}
              onRowClick={controls.rowClick ? handleRowClick : undefined}
            />
          </Card>
        );
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{viewTitle}</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Badge variant="info">{displayData.length}{allData.length !== displayData.length ? `/${allData.length}` : ''}</Badge>
          <Badge variant="secondary">{layout}</Badge>
          {controls.create && (
            <button data-part="button" data-variant="filled" onClick={() => setShowCreate(true)}>
              Create {viewTitle.replace(/s$/, '')}
            </button>
          )}
        </div>
      </div>

      {viewDescription && (
        <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-sm)' }}>
          {viewDescription}
        </p>
      )}

      {renderFilters()}

      {renderDisplay()}

      {children}

      {controls.create && (
        <CreateForm
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
          concept={controls.create.concept}
          action={controls.create.action}
          title={`Create ${viewTitle.replace(/s$/, '')}`}
          fields={controls.create.fields as Array<{ name: string; label?: string; type?: 'text' | 'textarea' | 'select'; options?: string[]; required?: boolean; placeholder?: string }>}
        />
      )}
    </div>
  );
};

export default ViewRenderer;
