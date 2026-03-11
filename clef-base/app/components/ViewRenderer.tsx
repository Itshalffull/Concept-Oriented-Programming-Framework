'use client';

/**
 * ViewRenderer — generic component that loads a View config entity from the
 * kernel and renders it using the appropriate display type component.
 *
 * Per spec §2.1: ContentNode identity = set of applied Schemas.
 * When a view's dataSource targets ContentNode, ViewRenderer enriches each
 * node with its Schema memberships and supports schema-based filtering
 * (both toggle-group filters on the `schemas` field and schemaFilter params).
 *
 * Flow:
 * 1. invoke('View', 'get', { view: viewId }) → loads the View config
 * 2. Parse dataSource → { concept, action, params }
 * 3. invoke(concept, action, params) → fetches the data
 * 4. If ContentNode data, enrich with Schema memberships
 * 5. Apply schemaFilter (from params) and toggle filters
 * 6. Render filtered data through the display type (table, card-grid, graph, etc.)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card } from './widgets/Card';
import { Badge } from './widgets/Badge';
import { EmptyState } from './widgets/EmptyState';
import { CreateForm } from './widgets/CreateForm';
import { TableDisplay, type FieldConfig } from './widgets/TableDisplay';
import { CardGridDisplay } from './widgets/CardGridDisplay';
import { GraphDisplay } from './widgets/GraphDisplay';
import { StatCardsDisplay } from './widgets/StatCardsDisplay';
import { DetailDisplay } from './widgets/DetailDisplay';
import { ContentBodyDisplay } from './widgets/ContentBodyDisplay';
import { useActiveTheme, useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';
import {
  buildDisplayWidgetContext,
  getDisplayInteractor,
  mapWidgetToLayout,
} from '../../lib/widget-selection';

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

// Schema color map for visual differentiation
const SCHEMA_COLORS: Record<string, string> = {
  Concept: '#6366f1', Schema: '#10b981', Sync: '#f59e0b', Suite: '#ec4899',
  Workflow: '#8b5cf6', Theme: '#06b6d4', View: '#3b82f6', Widget: '#14b8a6',
  AutomationRule: '#f97316', Taxonomy: '#84cc16', DisplayMode: '#0ea5e9',
  VersionSpace: '#a855f7', VersionOverride: '#d946ef',
  Article: '#22c55e', Page: '#22c55e', Media: '#eab308',
  Comment: '#78716c', File: '#64748b',
};

/**
 * Extract all unique schema values from data rows for filter UI.
 * Since `schemas` is an array field, we flatten across all rows.
 */
function extractSchemaValues(data: Record<string, unknown>[]): string[] {
  const schemaSet = new Set<string>();
  for (const row of data) {
    const schemas = row.schemas;
    if (Array.isArray(schemas)) {
      for (const s of schemas) schemaSet.add(String(s));
    }
  }
  return [...schemaSet].sort();
}

/**
 * Check if a row matches an active schema filter.
 * A node with schemas ["Concept", "Commentable"] matches if ANY of its
 * schemas are in the active set — this supports multi-schema entities.
 */
function rowMatchesSchemaFilter(row: Record<string, unknown>, activeSchemas: Set<string>): boolean {
  const schemas = row.schemas;
  if (!Array.isArray(schemas) || schemas.length === 0) return activeSchemas.size === 0;
  return schemas.some((s: unknown) => activeSchemas.has(String(s)));
}

export const ViewRenderer: React.FC<ViewRendererProps> = ({ viewId, title: titleOverride, context, children }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();
  const theme = useActiveTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [resolvedLayout, setResolvedLayout] = useState<string | null>(null);
  const [resolvedWidget, setResolvedWidget] = useState<string | null>(null);

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

  // Extract schemaFilter from params before resolving (it's a UI-layer filter, not a concept action param)
  const schemaFilter = dataSource?.params?.schemaFilter as string | undefined;
  const cleanParams = useMemo(() => {
    if (!dataSource?.params) return undefined;
    const { schemaFilter: _sf, ...rest } = dataSource.params;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }, [dataSource?.params]);

  // Resolve template variables in dataSource params using context
  const resolvedParams = useMemo(() => {
    if (!cleanParams || !context) return cleanParams;
    return resolveTemplates(cleanParams, context);
  }, [cleanParams, context]);

  // Resolve schemaFilter templates too
  const resolvedSchemaFilter = useMemo(() => {
    if (!schemaFilter || !context) return schemaFilter;
    return schemaFilter.replace(/\{\{(\w+)\}\}/g, (_, varName) => context[varName] ?? '');
  }, [schemaFilter, context]);

  // Step 2: Fetch primary data
  const { data: rawData, loading: dataLoading, error: dataError, refetch } =
    useConceptQuery<Record<string, unknown>[] | Record<string, unknown>>(
      dataSource?.concept ?? '__none__',
      dataSource?.action ?? '__none__',
      resolvedParams,
    );

  // Step 3: If this is ContentNode data, fetch Schema memberships for enrichment
  const isContentNodeData = dataSource?.concept === 'ContentNode';
  const { data: membershipsData } = useConceptQuery<Record<string, unknown>[]>(
    isContentNodeData ? 'Schema' : '__none__',
    isContentNodeData ? 'listMemberships' : '__none__',
  );

  // Normalize + enrich data
  const allData = useMemo(() => {
    if (!rawData) return [];
    const items = (Array.isArray(rawData) ? rawData : [rawData]) as Record<string, unknown>[];

    if (!isContentNodeData || !membershipsData) return items;

    // Build entity_id → schemas[] lookup
    const memberships = Array.isArray(membershipsData) ? membershipsData : [];
    const schemasByEntity = new Map<string, string[]>();
    for (const m of memberships) {
      const entityId = m.entity_id as string;
      const schema = m.schema as string;
      if (!entityId || !schema) continue;
      const existing = schemasByEntity.get(entityId) ?? [];
      existing.push(schema);
      schemasByEntity.set(entityId, existing);
    }

    // Enrich each node with its schemas
    let enriched = items.map((item) => ({
      ...item,
      schemas: schemasByEntity.get(item.node as string) ?? [],
    }));

    // Apply schemaFilter if present
    if (resolvedSchemaFilter) {
      enriched = enriched.filter((n) =>
        (n.schemas as string[]).includes(resolvedSchemaFilter),
      );
    }

    return enriched;
  }, [rawData, isContentNodeData, membershipsData, resolvedSchemaFilter]);

  // Initialize filter state from data + config once data arrives
  if (allData.length > 0 && filters.length > 0 && !filtersInitialized) {
    const initial: Record<string, Set<string>> = {};
    for (const filter of filters) {
      // Special handling for schemas (array field)
      if (filter.field === 'schemas') {
        const allValues = extractSchemaValues(allData);
        if (filter.defaultOn) {
          initial[filter.field] = new Set(filter.defaultOn);
        } else if (filter.defaultOff) {
          const offSet = new Set(filter.defaultOff);
          initial[filter.field] = new Set(allValues.filter((v) => !offSet.has(v)));
        } else {
          initial[filter.field] = new Set(allValues);
        }
      } else {
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
        if (!active) continue;
        if (filter.field === 'schemas') {
          if (!rowMatchesSchemaFilter(row, active)) return false;
        } else {
          if (!active.has(String(row[filter.field] ?? ''))) return false;
        }
      }
      return true;
    });
  }, [allData, activeFilters, filters]);

  const layout = viewConfig?.layout ?? 'table';
  const effectiveLayout = resolvedLayout ?? layout;
  const viewTitle = titleOverride ?? viewConfig?.title ?? viewId;
  const viewDescription = viewConfig?.description ?? '';
  const loading = configLoading || dataLoading;

  useEffect(() => {
    const interactor = getDisplayInteractor(layout);
    if (!interactor) {
      setResolvedLayout(layout);
      setResolvedWidget(null);
      return;
    }

    const context = buildDisplayWidgetContext({
      viewId,
      layout,
      rowCount: allData.length,
      fieldCount: fields.length,
      density: theme.density,
      motif: theme.motif,
      styleProfile: theme.styleProfile,
      sourceType: theme.sourceType,
    });

    let cancelled = false;
    invoke('WidgetResolver', 'resolve', {
      resolver: 'clef-base-view-resolver',
      element: interactor,
      context: JSON.stringify(context),
    })
      .then((result) => {
        if (cancelled) return;
        const widget = result.variant === 'ok' && typeof result.widget === 'string'
          ? result.widget
          : null;
        setResolvedWidget(widget);
        setResolvedLayout(mapWidgetToLayout(widget, layout));
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedWidget(null);
        setResolvedLayout(layout);
      });

    return () => {
      cancelled = true;
    };
  }, [
    allData.length,
    fields.length,
    invoke,
    layout,
    theme.density,
    theme.motif,
    theme.sourceType,
    theme.styleProfile,
    viewId,
  ]);

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

    return filters.map((filter) => {
      // For schemas, extract unique values from array fields
      const allValues = filter.field === 'schemas'
        ? extractSchemaValues(allData)
        : [...new Set(allData.map((row) => String(row[filter.field] ?? '')))].sort();
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
            const dotColor = SCHEMA_COLORS[value] ?? '#64748b';
            // Count: for schemas, count nodes that have this schema
            const count = filter.field === 'schemas'
              ? allData.filter((row) => Array.isArray(row.schemas) && (row.schemas as string[]).includes(value)).length
              : allData.filter((row) => String(row[filter.field] ?? '') === value).length;
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

    switch (effectiveLayout) {
      case 'detail':
        return (
          <DetailDisplay
            data={displayData} fields={fields}
            onRowClick={controls.rowClick ? handleRowClick : undefined}
            onFieldSave={async (field, value) => {
              if (displayData[0]) {
                const entity = displayData[0] as Record<string, unknown>;
                const node = entity.node as string;
                if (node) {
                  if (field === 'content') {
                    await invoke('ContentNode', 'update', { node, content: value });
                  } else if (field === 'metadata') {
                    await invoke('ContentNode', 'setMetadata', { node, metadata: value });
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
                const entity = displayData[0] as Record<string, unknown>;
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
          <Badge variant="secondary">{effectiveLayout}</Badge>
          {resolvedWidget && (
            <Badge variant="info">{resolvedWidget}</Badge>
          )}
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
