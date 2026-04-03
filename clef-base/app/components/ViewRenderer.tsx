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
import { TableDisplay, type FieldConfig, type BulkActionConfig } from './widgets/TableDisplay';
import { CardGridDisplay } from './widgets/CardGridDisplay';
import { GraphDisplay } from './widgets/GraphDisplay';
import { CanvasDisplay } from './widgets/CanvasDisplay';
import { StatCardsDisplay } from './widgets/StatCardsDisplay';
import { DetailDisplay } from './widgets/DetailDisplay';
import { ContentBodyDisplay } from './widgets/ContentBodyDisplay';
import { BoardDisplay } from './widgets/BoardDisplay';
import { CalendarDisplay } from './widgets/CalendarDisplay';
import { TimelineDisplay } from './widgets/TimelineDisplay';
import { TreeDisplay } from './widgets/TreeDisplay';
import { DisplayModeRenderer } from './widgets/DisplayModeRenderer';
import { useActiveTheme, useNavigator, useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';
import {
  buildDisplayWidgetContext,
  getDisplayInteractor,
  mapWidgetToLayout,
} from '../../lib/widget-selection';
import {
  evaluateFilterNode,
  buildFilterTree,
  buildSchemaFilterNode,
  applySortKeys,
  parseSortKeys,
} from '../../lib/filter-evaluator';

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
  /** Display mode used for each item (e.g. 'card', 'table-row'). Items render through DisplayMode.resolve(). */
  defaultDisplayMode?: string;
  /** When false, bypass display mode and use hardcoded display component. Default true. */
  useDisplayMode?: string; // stored as string in kernel, parsed to boolean
}

interface DataSourceConfig {
  concept: string;
  action: string;
  params?: Record<string, unknown>;
  /** Query expression — when present, data is fetched via Query/execute
   *  instead of raw concept invocation. Supports schema predicates,
   *  field filters, and sorts server-side. */
  query?: string;
}

interface FilterConfig {
  field: string;
  label?: string;
  type?: 'toggle-group';
  /** Values that are ON by default. If omitted, all values are on. */
  defaultOn?: string[];
  /** Values that are OFF by default. */
  defaultOff?: string[];
  /** Contextual filter source type */
  source_type?: 'contextual';
  /** Context binding path e.g. "context.entity" */
  context_binding?: string;
  /** Operator for contextual filters */
  operator?: string;
  /** What to do when context binding can't be resolved */
  fallback_behavior?: 'hide' | 'show-all';
}

import { type RowActionConfig } from '../../lib/row-actions';

// ─── Grouping Config ──────────────────────────────────────────────────────
import type { GroupConfig } from '../../lib/view-types';
export type { GroupConfig, GroupFieldConfig } from '../../lib/view-types';

function parseGroupConfig(raw: string | undefined): GroupConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Support simple string shorthand: "status" → { fields: [{ field: "status" }] }
    if (typeof parsed === 'string') return { fields: [{ field: parsed }] };
    if (parsed && Array.isArray(parsed.fields)) return parsed as GroupConfig;
    return null;
  } catch {
    // Plain string (unquoted) — treat as field name
    if (raw.trim()) return { fields: [{ field: raw.trim() }] };
    return null;
  }
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
  rowActions?: RowActionConfig[];
  bulk?: {
    actions: BulkActionConfig[];
  };
}

interface ViewRendererProps {
  viewId?: string;
  title?: string;
  /** Context variables for template resolution — replaces {{var}} in dataSource params */
  context?: Record<string, string>;
  children?: React.ReactNode;
  /** Inline data — when provided, skip dataSource fetch and render this data directly.
   *  Enables block children view modes and other non-query-driven rendering. */
  inlineData?: Record<string, unknown>[];
  /** Layout override — used with inlineData when no View entity is needed */
  inlineLayout?: string;
  /** Field config override — used with inlineData when no View entity is needed */
  inlineFields?: FieldConfig[];
  /** Hide the header (title, badges, create button) — useful for inline/embedded views */
  compact?: boolean;
  /** Selection callback — when provided, row clicks call onSelect instead of navigating.
   *  Used for picker mode (ViewPicker, EntityPicker). */
  onSelect?: (row: Record<string, unknown>) => void;
  /** Inline group config — used with inlineData for default grouping (e.g. blocks grouped by parent) */
  inlineGroupConfig?: GroupConfig;
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


export const ViewRenderer: React.FC<ViewRendererProps> = ({
  viewId, title: titleOverride, context, children,
  inlineData, inlineLayout, inlineFields, compact, onSelect, inlineGroupConfig,
}) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();
  const theme = useActiveTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [resolvedLayout, setResolvedLayout] = useState<string | null>(null);
  const [resolvedWidget, setResolvedWidget] = useState<string | null>(null);

  const isInlineMode = !!inlineData;

  // Step 1a: Try ViewShell/resolve first (new dual-path resolution).
  // ViewShell returns { view, config } where config is a JSON string containing
  // the decomposed child spec reference names (dataSource, filter, sort, etc.).
  // If ViewShell is not registered in the kernel or the view name is not found,
  // this silently returns null — zero impact on the existing View/get path.
  const { data: shellResult, loading: shellLoading, error: shellError } =
    useConceptQuery<{ view: string; config: string }>(
      'ViewShell', 'resolve', { name: viewId ?? '__none__' },
    );

  // Parse ViewShell config into a ViewConfig shape when available.
  // The resolve action returns a JSON string with the same field names as
  // ViewConfig but holding child spec reference names rather than inline JSON.
  // Fields that the current ViewRenderer parses as JSON (dataSource, filters,
  // etc.) will gracefully fail parsing and fall through to empty defaults —
  // the actual hydration of reference names into inline JSON is a downstream
  // concern handled by the child spec concepts themselves.
  const shellViewConfig: ViewConfig | null = useMemo(() => {
    if (!shellResult?.config) return null;
    try {
      const parsed = JSON.parse(shellResult.config);
      return {
        view:              parsed.view         ?? '',
        title:             parsed.title        ?? '',
        description:       parsed.description  ?? '',
        dataSource:        parsed.dataSource   ?? '',
        layout:            parsed.layout       ?? '',
        filters:           parsed.filter       ?? '',
        sorts:             parsed.sort         ?? '',
        groups:            parsed.group        ?? '',
        visibleFields:     parsed.projection   ?? '',
        formatting:        parsed.formatting   ?? '',
        controls:          parsed.interaction  ?? '',
        defaultDisplayMode: parsed.presentation ?? undefined,
        useDisplayMode:    parsed.useDisplayMode ?? undefined,
      } satisfies ViewConfig;
    } catch {
      return null;
    }
  }, [shellResult]);

  // Step 1b: Load the legacy View config (skip if pure inline mode with no viewId).
  // When ViewShell resolved successfully we still run this query (it's a hook and
  // must be called unconditionally) but its result will be superseded.
  const { data: legacyViewConfig, loading: legacyConfigLoading, error: legacyConfigError } =
    useConceptQuery<ViewConfig>('View', 'get', { view: viewId ?? '__none__' });

  // Dual-path merge: prefer ViewShell when it returned data, fall back to View/get.
  const viewConfig = shellViewConfig ?? legacyViewConfig;
  const configLoading = shellLoading || (shellViewConfig == null && legacyConfigLoading);
  const configError = shellViewConfig != null ? null : (shellError ? null : legacyConfigError);

  // Parse the config
  let dataSource: DataSourceConfig | null = null;
  let fields: FieldConfig[] = [];
  let controls: ControlsConfig = {};
  let filters: FilterConfig[] = [];
  let groupConfig: GroupConfig | null = null;

  if (viewConfig) {
    try { dataSource = JSON.parse(viewConfig.dataSource); } catch { /* empty */ }
    try { fields = JSON.parse(viewConfig.visibleFields); } catch { /* empty */ }
    try { controls = JSON.parse(viewConfig.controls); } catch { /* empty */ }
    try {
      const parsed = JSON.parse(viewConfig.filters);
      if (Array.isArray(parsed)) filters = parsed;
    } catch { /* empty */ }
    groupConfig = parseGroupConfig(viewConfig.groups);
  }

  // Parse display mode fields
  const defaultDisplayMode = viewConfig?.defaultDisplayMode ?? undefined;
  const useDisplayMode = viewConfig?.useDisplayMode !== undefined
    ? viewConfig.useDisplayMode !== 'false' && viewConfig.useDisplayMode !== '0'
    : true; // default true

  // Inline group config takes precedence when no view-level config
  const effectiveGroupConfig = groupConfig ?? inlineGroupConfig ?? null;

  // Check for contextual filters that can't be resolved — hide the view if fallback_behavior is "hide"
  const hasUnresolvedContextualHide = filters.some(f => {
    if (f.source_type !== 'contextual' || f.fallback_behavior !== 'hide') return false;
    // Resolve context binding — e.g. "context.entity" → context.entityId
    if (!context) return true;
    const binding = f.context_binding;
    if (binding === 'context.entity') return !context.entityId;
    return false;
  });

  // Separate interactive (toggle-group) filters from contextual filters
  const interactiveFilters = filters.filter(f => f.source_type !== 'contextual');
  const contextualFilters = filters.filter(f => f.source_type === 'contextual');

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

  // Determine the data fetching strategy:
  // 1. Query mode: dataSource has a `query` expression → use Query/parse + Query/execute
  // 2. Schema-optimized: ContentNode + schemaFilter → use ContentNode/listBySchema
  // 3. Legacy: raw concept/action invocation + separate listMemberships
  const hasQueryExpression = !isInlineMode && !!dataSource?.query;
  const useListBySchema = !isInlineMode && !hasQueryExpression
    && dataSource?.concept === 'ContentNode'
    && (dataSource?.action === 'list' || !dataSource?.action)
    && !!resolvedSchemaFilter;

  // Query mode: parse then execute the query expression
  const queryId = viewId ? `view-query:${viewId}` : undefined;
  const { data: queryParseResult } = useConceptQuery<Record<string, unknown>>(
    hasQueryExpression ? 'Query' : '__none__',
    hasQueryExpression ? 'parse' : '__none__',
    hasQueryExpression ? { query: queryId, expression: dataSource!.query } : undefined,
  );
  const queryParsed = hasQueryExpression && queryParseResult?.variant === 'ok';
  const { data: queryExecResult, loading: queryLoading, error: queryError, refetch: queryRefetch } =
    useConceptQuery<Record<string, unknown>>(
      queryParsed ? 'Query' : '__none__',
      queryParsed ? 'execute' : '__none__',
      queryParsed ? { query: queryId } : undefined,
    );

  // Schema-optimized mode: use listBySchema to avoid two full scans
  const { data: schemaData, loading: schemaLoading, error: schemaError, refetch: schemaRefetch } =
    useConceptQuery<Record<string, unknown>>(
      useListBySchema ? 'ContentNode' : '__none__',
      useListBySchema ? 'listBySchema' : '__none__',
      useListBySchema ? { schema: resolvedSchemaFilter } : undefined,
    );

  // Legacy mode: raw concept/action invocation
  const useLegacy = !isInlineMode && !hasQueryExpression && !useListBySchema;
  const { data: rawData, loading: rawDataLoading, error: rawDataError, refetch: rawRefetch } =
    useConceptQuery<Record<string, unknown>[] | Record<string, unknown>>(
      useLegacy ? (dataSource?.concept ?? '__none__') : '__none__',
      useLegacy ? (dataSource?.action ?? '__none__') : '__none__',
      useLegacy ? resolvedParams : undefined,
    );

  // Legacy mode: fetch Schema memberships for ContentNode enrichment
  const isContentNodeData = useLegacy && dataSource?.concept === 'ContentNode';
  const { data: membershipsData } = useConceptQuery<Record<string, unknown>[]>(
    isContentNodeData ? 'Schema' : '__none__',
    isContentNodeData ? 'listMemberships' : '__none__',
  );

  // Unified loading/error/refetch across all three modes
  const dataLoading = hasQueryExpression ? queryLoading : useListBySchema ? schemaLoading : rawDataLoading;
  const dataError = hasQueryExpression ? queryError : useListBySchema ? schemaError : rawDataError;
  const refetch = hasQueryExpression ? queryRefetch : useListBySchema ? schemaRefetch : rawRefetch;

  // Normalize + enrich data across all three modes
  const allData = useMemo(() => {
    // Inline data path — use provided data directly
    if (isInlineMode) return inlineData!;

    // Query mode: results come pre-filtered and schema-enriched from Query/execute
    if (hasQueryExpression) {
      if (!queryExecResult) return [];
      const resultsStr = queryExecResult.results as string;
      if (!resultsStr) return [];
      try {
        const parsed = JSON.parse(resultsStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    }

    // Schema-optimized mode: results come pre-filtered and enriched from listBySchema
    if (useListBySchema) {
      if (!schemaData) return [];
      const itemsStr = (schemaData as Record<string, unknown>).items as string;
      if (!itemsStr) return [];
      try {
        const parsed = JSON.parse(itemsStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    }

    // Legacy mode: raw concept data + client-side enrichment
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
    let enriched: Record<string, unknown>[] = items.map((item) => ({
      ...item,
      schemas: schemasByEntity.get(item.node as string) ?? [],
    }));

    // Apply schemaFilter if present — uses FilterNode evaluation with array intersection
    if (resolvedSchemaFilter) {
      const schemaNode = buildSchemaFilterNode(resolvedSchemaFilter);
      enriched = enriched.filter((n) => evaluateFilterNode(schemaNode, n));
    }

    return enriched;
  }, [rawData, isContentNodeData, isInlineMode, inlineData, membershipsData,
      resolvedSchemaFilter, hasQueryExpression, queryExecResult,
      useListBySchema, schemaData]);

  // Initialize filter state from data + config once data arrives (interactive filters only)
  if (allData.length > 0 && interactiveFilters.length > 0 && !filtersInitialized) {
    const initial: Record<string, Set<string>> = {};
    for (const filter of interactiveFilters) {
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

  // Parse sort keys from view config
  const sortKeys = useMemo(() => parseSortKeys(viewConfig?.sorts), [viewConfig?.sorts]);

  // Apply interactive filters then sort
  const displayData = useMemo(() => {
    let filtered = allData;

    // Apply interactive filters via FilterNode tree evaluation
    if (interactiveFilters.length > 0 && Object.keys(activeFilters).length > 0) {
      const filterTree = buildFilterTree(activeFilters, interactiveFilters);
      filtered = filtered.filter((row) => evaluateFilterNode(filterTree, row));
    }

    // Apply sort if configured
    if (sortKeys.length > 0) {
      filtered = applySortKeys(filtered, sortKeys);
    }

    return filtered;
  }, [allData, activeFilters, interactiveFilters, sortKeys]);

  const layout = inlineLayout ?? viewConfig?.layout ?? 'table';
  const effectiveLayout = resolvedLayout ?? layout;
  const effectiveFields = inlineFields ?? fields;
  const viewTitle = titleOverride ?? viewConfig?.title ?? viewId ?? '';
  const viewDescription = viewConfig?.description ?? '';
  const loading = (isInlineMode ? false : configLoading) || (isInlineMode ? false : dataLoading);

  useEffect(() => {
    const interactor = getDisplayInteractor(layout);
    if (!interactor) {
      setResolvedLayout(layout);
      setResolvedWidget(null);
      return;
    }

    const context = buildDisplayWidgetContext({
      viewId: viewId ?? '',
      layout,
      rowCount: allData.length,
      fieldCount: effectiveFields.length,
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

  // Row click handler — onSelect overrides navigation when in picker mode
  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    if (onSelect) {
      onSelect(row);
      return;
    }
    if (!controls.rowClick?.navigateTo) return;
    let path = controls.rowClick.navigateTo;
    path = path.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(String(row[key] ?? '')));
    navigateToHref(path);
  }, [controls.rowClick, navigateToHref, onSelect]);

  // Bulk action handler — invoke a concept action for each selected row
  const handleBulkAction = useCallback(async (actionKey: string, selectedRows: Record<string, unknown>[]) => {
    const bulkDef = controls.bulk?.actions.find(a => a.key === actionKey);
    if (!bulkDef) return;
    // Find matching row action config to get concept/action/params mapping
    const rowActionDef = controls.rowActions?.find(a => a.key === actionKey);
    if (rowActionDef) {
      for (const row of selectedRows) {
        const params: Record<string, unknown> = {};
        for (const [paramKey, rowField] of Object.entries(rowActionDef.params)) {
          params[paramKey] = row[rowField];
        }
        await invoke(rowActionDef.concept, rowActionDef.action, params);
      }
      refetch();
    }
  }, [controls.bulk?.actions, controls.rowActions, invoke, refetch]);

  // Row action handler — invoke a concept action with params mapped from the row
  const handleRowAction = useCallback(async (action: RowActionConfig, row: Record<string, unknown>) => {
    const params: Record<string, unknown> = {};
    for (const [paramKey, rowField] of Object.entries(action.params)) {
      params[paramKey] = row[rowField];
    }
    await invoke(action.concept, action.action, params);
    refetch();
  }, [invoke, refetch]);

  // Hide view if contextual filters can't be resolved
  if (hasUnresolvedContextualHide) {
    return null;
  }

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

  // Render filter controls (interactive filters only, not contextual)
  const renderFilters = () => {
    if (interactiveFilters.length === 0 || allData.length === 0) return null;

    return interactiveFilters.map((filter) => {
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

    // Display mode item renderer: when useDisplayMode is true and defaultDisplayMode is set,
    // create a renderItem function that renders each item through DisplayModeRenderer.
    // Layout components that support per-item rendering use this; holistic layouts bypass it.
    const shouldUseDisplayMode = useDisplayMode && !!defaultDisplayMode && !isInlineMode;
    const holisticLayouts = new Set(['graph', 'stat-cards', 'canvas', 'detail', 'content-body', 'calendar', 'timeline', 'tree']);

    // Build a renderItem function for layout components that support it
    const renderDisplayModeItem = shouldUseDisplayMode && !holisticLayouts.has(effectiveLayout)
      ? (row: Record<string, unknown>, onClick?: () => void) => {
          const rowSchema = (row.schemas as string[])?.[0]
            ?? (row.type as string)
            ?? dataSource?.concept
            ?? 'ContentNode';
          return (
            <DisplayModeRenderer
              entity={row}
              schema={rowSchema}
              modeId={defaultDisplayMode!}
              onClick={onClick}
            />
          );
        }
      : null;

    switch (effectiveLayout) {
      case 'detail':
        return (
          <DetailDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
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
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
            context={context}
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
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
            rowActions={controls.rowActions}
            onRowAction={handleRowAction}
            renderItem={renderDisplayModeItem ?? undefined}
          />
        );

      case 'canvas':
        return (
          <CanvasDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'graph':
        return (
          <GraphDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'stat-cards':
        return (
          <StatCardsDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'board':
        return (
          <BoardDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
            rowActions={controls.rowActions}
            onRowAction={handleRowAction}
            groupBy={effectiveGroupConfig?.fields[0]?.field}
            renderItem={renderDisplayModeItem ?? undefined}
          />
        );

      case 'calendar':
        return (
          <CalendarDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'timeline':
        return (
          <TimelineDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'tree':
        return (
          <TreeDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
          />
        );

      case 'table':
      default:
        return (
          <Card variant="outlined" padding="none">
            <TableDisplay
              data={displayData} fields={effectiveFields}
              onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
              rowActions={controls.rowActions}
              onRowAction={handleRowAction}
              groupConfig={effectiveGroupConfig ?? undefined}
              selectable={!!controls.bulk}
              bulkActions={controls.bulk?.actions}
              onBulkAction={handleBulkAction}
            />
          </Card>
        );
    }
  };

  return (
    <div>
      {!compact && (
        <>
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
        </>
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

export type { FieldConfig } from './widgets/TableDisplay';
export default ViewRenderer;
