'use client';

/**
 * ViewRenderer — generic component that loads a ViewShell config from the
 * kernel and renders it using the appropriate display type component.
 *
 * Per spec §2.1: ContentNode identity = set of applied Schemas.
 * When a view's dataSource targets ContentNode, ViewRenderer enriches each
 * node with its Schema memberships and supports schema-based filtering
 * (both toggle-group filters on the `schemas` field and schemaFilter params).
 *
 * Flow:
 * 1. invoke('ViewShell', 'resolveHydrated', { name: viewId }) → loads the hydrated View config
 * 2. Parse dataSource → { concept, action, params }
 * 3. invoke(concept, action, params) → fetches the data
 * 4. If ContentNode data, enrich with Schema memberships
 * 5. Apply schemaFilter (from params) and toggle filters
 * 6. Render filtered data through the display type (table, card-grid, graph, etc.)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useInvokeWithFeedback } from '../../lib/useInvocation';
import { InvocationStatusIndicator } from './widgets/InvocationStatusIndicator';
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
import { getLabelVisualizationColorToken } from '../../lib/visualization-colors';
import {
  evaluateFilterNode,
  buildFilterTree,
  buildSchemaFilterNode,
  applySortKeys,
  parseSortKeys,
} from '../../lib/filter-evaluator';
import { ViewEditorToolbar, type FilterCondition, type SortKey as ToolbarSortKey, type GroupConfig as ToolbarGroupConfig, type FieldVisibilityConfig } from './widgets/ViewEditorToolbar';
import { ViewTabBar } from './widgets/ViewTabBar';
import { type FieldDef } from './widgets/FieldPickerDropdown';

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
  /**
   * ActionBinding id for the board card-move operation. When present, the board
   * display enables drag-and-drop: dropping a card onto a column invokes this
   * binding with context { rowId, field, value }. When absent, drag-to-move is
   * disabled and a visual indicator is shown (see BoardDisplay).
   *
   * Seed: ActionBinding.board.seeds.yaml — "board-card-move"
   */
  moveBinding?: string;
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
  // Prefill values forwarded to CreateForm when the modal is opened from a
  // calendar cell click. Keys are field names; values are pre-populated strings
  // (e.g. { date: "2026-04-13" } when the user clicks a day cell).
  const [createInitialValues, setCreateInitialValues] = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [resolvedLayout, setResolvedLayout] = useState<string | null>(null);
  const [resolvedWidget, setResolvedWidget] = useState<string | null>(null);
  // INV-06: per-action invocation feedback via useInvokeWithFeedback + InvocationStatusIndicator
  const rowActionFeedback = useInvokeWithFeedback();
  const bulkActionFeedback = useInvokeWithFeedback();
  // Board drag-and-drop card-move feedback — separate from row action feedback
  // so the status indicator doesn't conflict with row action indicators.
  const moveCardFeedback = useInvokeWithFeedback();
  // Optimistic board data: tracks cards displaced by in-flight drag operations.
  // When a move is initiated we update displayData locally so the card appears
  // in the target column immediately. If the action fails we revert.
  const [optimisticMoves, setOptimisticMoves] = useState<
    Array<{ rowId: string; field: string; prevValue: unknown; newValue: string }>
  >([]);
  // Inline field-save errors (detail/content-body layout) — separate from row/bulk action feedback
  const [inlineFieldError, setActionError] = useState<string | null>(null);

  // Toolbar state — advanced filter conditions, sort keys, group, and field visibility
  // managed by ViewEditorToolbar. Separate from the toggle-group activeFilters system.
  const [toolbarFilterConditions, setToolbarFilterConditions] = useState<FilterCondition[]>([]);
  const [toolbarSortKeys, setToolbarSortKeys] = useState<ToolbarSortKey[]>([]);
  const [toolbarGroupConfig, setToolbarGroupConfig] = useState<ToolbarGroupConfig | null>(null);
  const [toolbarFieldVisibility, setToolbarFieldVisibility] = useState<FieldVisibilityConfig[]>([]);
  const [toolbarLayout, setToolbarLayout] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  const isInlineMode = !!inlineData;

  // Saved views for the ViewTabBar — load all ViewShells so we can show tabs
  const { data: savedViewsData } = useConceptQuery<Record<string, unknown>>(
    (!compact && !isInlineMode && viewId) ? 'ViewShell' : '__none__',
    (!compact && !isInlineMode && viewId) ? 'list' : '__none__',
  );
  const savedViews = useMemo(() => {
    if (!savedViewsData) return [];
    const items = (savedViewsData as Record<string, unknown>).items;
    if (!items) return [];
    try {
      const parsed = typeof items === 'string' ? JSON.parse(items) : items;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((v: Record<string, unknown>) => ({
        id: String(v.name ?? v.view ?? ''),
        name: String(v.title ?? v.name ?? v.view ?? ''),
      }));
    } catch { return []; }
  }, [savedViewsData]);

  // Step 1: Load ViewShell/resolveHydrated — the sole config resolution path.
  // resolveHydrated returns fully hydrated child spec data — filter trees, sort keys,
  // projection fields, data source config, presentation, interaction — all as JSON
  // strings. Each field on the result is a JSON-encoded spec object, not just a
  // reference name.
  const { data: shellResult, loading: shellLoading, error: shellError } =
    useConceptQuery<{
      view: string;
      title: string;
      description: string;
      dataSource: string;
      filter: string;
      sort: string;
      group: string;
      projection: string;
      presentation: string;
      interaction: string;
    }>(
      'ViewShell', 'resolveHydrated', { name: viewId ?? '__none__' },
    );

  const { data: legacyViewResult, loading: legacyViewLoading, error: legacyViewError } =
    useConceptQuery<ViewConfig>(
      (!isInlineMode && viewId && !shellResult?.view) ? 'View' : '__none__',
      (!isInlineMode && viewId && !shellResult?.view) ? 'get' : '__none__',
      (!isInlineMode && viewId && !shellResult?.view) ? { view: viewId } : undefined,
    );

  // Parse hydrated ViewShell result into a ViewConfig shape and extract
  // structured spec objects for data-fetching and filter evaluation.
  //
  // resolveHydrated returns each field as a JSON string containing a spec object:
  //   dataSource:   { name, kind, config, parameters }   — config is itself a JSON string
  //   filter:       { name, tree, sourceType, ... }      — tree is the FilterNode for residual eval
  //   sort:         { name, keys }                        — keys is a JSON string of SortKey[]
  //   projection:   { name, fields }                      — fields is a JSON string of FieldConfig[]
  //   presentation: { name, displayType, hints, ... }
  //   interaction:  { name, createForm, rowClick, rowActions, pickerMode }
  //
  // When kernel hydration succeeds shellViewConfig is populated. When the view
  // is not found or the kernel returns notfound, shellViewConfig is null and
  // ViewRenderer renders an empty/error state.

  // Hydrated spec objects extracted from the resolveHydrated response
  interface HydratedDataSource { name: string; kind: string; config: string; parameters: string }
  interface HydratedFilter { name: string; tree: string; sourceType: string; fieldRefs: string; parameters: string }
  interface HydratedSort { name: string; keys: string }
  interface HydratedProjection { name: string; fields: string }
  interface HydratedPresentation { name: string; displayType: string; hints: string; displayModePolicy: string; defaultDisplayMode: string }
  interface HydratedInteraction { name: string; createForm: string; rowClick: string; rowActions: string; pickerMode: string; actionBindings?: string }

  const hydratedSpecs = useMemo(() => {
    if (!shellResult?.view) return null;
    try {
      const dataSourceSpec: HydratedDataSource | null = shellResult.dataSource
        ? JSON.parse(shellResult.dataSource) : null;
      const filterSpec: HydratedFilter | null = shellResult.filter
        ? JSON.parse(shellResult.filter) : null;
      const sortSpec: HydratedSort | null = shellResult.sort
        ? JSON.parse(shellResult.sort) : null;
      const projectionSpec: HydratedProjection | null = shellResult.projection
        ? JSON.parse(shellResult.projection) : null;
      const presentationSpec: HydratedPresentation | null = shellResult.presentation
        ? JSON.parse(shellResult.presentation) : null;
      const interactionSpec: HydratedInteraction | null = shellResult.interaction
        ? JSON.parse(shellResult.interaction) : null;
      return { dataSourceSpec, filterSpec, sortSpec, projectionSpec, presentationSpec, interactionSpec };
    } catch {
      return null;
    }
  }, [shellResult]);

  // The InteractionSpec name for the active view — passed to CreateForm as destinationId
  // so Tier 1a resolution (create_surface + create_mode_hint) fires for page-mode surfaces.
  // e.g. "views-list-controls" has create_surface="view-editor" + create_mode_hint="page",
  // which causes CreateForm to navigate to /admin/view-editor/new instead of opening a modal.
  const interactionSpecName = hydratedSpecs?.interactionSpec?.name ?? null;

  // Build a ViewConfig from the hydrated specs. Each spec field maps to the
  // ViewConfig field that ViewRenderer already knows how to parse — we re-encode
  // the hydrated objects back to the JSON strings ViewConfig expects.
  const shellViewConfig: ViewConfig | null = useMemo(() => {
    if (!hydratedSpecs || !shellResult?.view) return null;
    const { dataSourceSpec, filterSpec, sortSpec, projectionSpec, presentationSpec, interactionSpec } = hydratedSpecs;

    // DataSource: config is a JSON string like {"concept":"ContentNode","action":"list",...}
    // Pass it through directly — ViewRenderer will JSON.parse it into DataSourceConfig.
    const dataSourceJson = dataSourceSpec?.config ?? '';

    // Filters: for interactive filters (sourceType=interactive), reconstruct
    // FilterConfig[] from fieldRefs so the existing toggle UI renders correctly.
    // fieldRefs is a JSON string like '["schemas"]' listing fields referenced in
    // the filter tree. Each field becomes a toggle-group FilterConfig entry.
    // Non-interactive filters (system/contextual) are backend-pushed and are
    // NOT added to the client filter array — they don't appear in the toggle UI.
    let filtersJson = '[]';
    if (filterSpec && filterSpec.sourceType === 'interactive') {
      try {
        const fieldNames = JSON.parse(filterSpec.fieldRefs ?? '[]') as string[];
        if (fieldNames.length > 0) {
          const filterConfigs = fieldNames.map((field) => ({
            field,
            type: 'toggle-group' as const,
          }));
          filtersJson = JSON.stringify(filterConfigs);
        }
      } catch { /* leave as empty array */ }
    }

    // Sort: keys is a JSON array of SortKey objects
    const sortsJson = sortSpec?.keys ?? '[]';

    // Projection: fields is a JSON array of FieldConfig objects
    const visibleFieldsJson = projectionSpec?.fields ?? '[]';

    // Presentation: displayType maps to layout
    const layout = presentationSpec?.displayType ?? 'table';

    // Controls: map interaction spec fields to ControlsConfig shape
    let controlsJson = '{}';
    if (interactionSpec) {
      const controlsObj: Record<string, unknown> = {};
      if (interactionSpec.createForm) {
        try { controlsObj.create = JSON.parse(interactionSpec.createForm); } catch { /* ignore */ }
      }
      if (interactionSpec.rowClick) {
        try { controlsObj.rowClick = JSON.parse(interactionSpec.rowClick); } catch { /* ignore */ }
      }
      if (interactionSpec.rowActions) {
        try {
          const parsedRowActions: RowActionConfig[] = JSON.parse(interactionSpec.rowActions);
          // Enrich each row action with its ActionBinding ID when actionBindings field is present
          if (interactionSpec.actionBindings) {
            try {
              const actionBindings: Array<{ id: string; key?: string; actionKey?: string }> =
                JSON.parse(interactionSpec.actionBindings as string);
              controlsObj.rowActions = parsedRowActions.map(ra => {
                const binding = actionBindings.find(
                  ab => (ab.key ?? ab.actionKey) === ra.key,
                );
                return binding ? { ...ra, actionBindingId: binding.id } : ra;
              });
            } catch {
              controlsObj.rowActions = parsedRowActions;
            }
          } else {
            controlsObj.rowActions = parsedRowActions;
          }
        } catch { /* ignore */ }
      }
      controlsJson = JSON.stringify(controlsObj);
    }

    // Presentation: defaultDisplayMode and displayModePolicy
    const defaultDisplayMode = presentationSpec?.defaultDisplayMode || undefined;
    const useDisplayMode = presentationSpec?.displayModePolicy
      ? (presentationSpec.displayModePolicy !== 'disabled' ? 'true' : 'false')
      : undefined;

    return {
      view:              shellResult.view,
      title:             shellResult.title         ?? '',
      description:       shellResult.description   ?? '',
      dataSource:        dataSourceJson,
      layout,
      filters:           filtersJson,
      sorts:             sortsJson,
      groups:            '',
      visibleFields:     visibleFieldsJson,
      formatting:        '{}',
      controls:          controlsJson,
      defaultDisplayMode,
      useDisplayMode,
    } satisfies ViewConfig;
  }, [hydratedSpecs, shellResult]);

  const viewConfig = shellViewConfig ?? legacyViewResult ?? null;
  const configLoading = shellLoading || (!shellViewConfig && legacyViewLoading);
  const configError = viewConfig
    ? null
    : (legacyViewError ?? shellError ?? null);

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

  // Initialize toolbar field visibility when fields are loaded (one-time, non-destructive)
  const toolbarFieldsInitialized = toolbarFieldVisibility.length > 0;
  if (!toolbarFieldsInitialized && fields.length > 0) {
    setToolbarFieldVisibility(
      fields.map((f) => ({ key: f.key, label: f.label, visible: f.visible !== false }))
    );
  }

  // Apply interactive filters then sort, then toolbar conditions
  const displayData_base = useMemo(() => {
    let filtered = allData;

    // Apply interactive toggle-group filters via FilterNode tree evaluation
    if (interactiveFilters.length > 0 && Object.keys(activeFilters).length > 0) {
      const filterTree = buildFilterTree(activeFilters, interactiveFilters);
      filtered = filtered.filter((row) => evaluateFilterNode(filterTree, row));
    }

    // Apply toolbar advanced filter conditions (AND all conditions together)
    if (toolbarFilterConditions.length > 0) {
      filtered = filtered.filter((row) => {
        return toolbarFilterConditions.every((cond) => {
          const rawVal = row[cond.field];
          const cellStr = rawVal != null ? String(rawVal) : '';
          const condVal = cond.value;
          switch (cond.operator) {
            case 'eq': return cellStr === condVal;
            case 'neq': return cellStr !== condVal;
            case 'contains': return cellStr.toLowerCase().includes(condVal.toLowerCase());
            case 'notContains': return !cellStr.toLowerCase().includes(condVal.toLowerCase());
            case 'startsWith': return cellStr.toLowerCase().startsWith(condVal.toLowerCase());
            case 'endsWith': return cellStr.toLowerCase().endsWith(condVal.toLowerCase());
            case 'isEmpty': return cellStr === '' || rawVal == null;
            case 'isNotEmpty': return cellStr !== '' && rawVal != null;
            case 'gt': return Number(cellStr) > Number(condVal);
            case 'gte': return Number(cellStr) >= Number(condVal);
            case 'lt': return Number(cellStr) < Number(condVal);
            case 'lte': return Number(cellStr) <= Number(condVal);
            case 'before': return cellStr < condVal;
            case 'after': return cellStr > condVal;
            case 'on': return cellStr === condVal;
            default: return true;
          }
        });
      });
    }

    // Apply toolbar sort (overrides config sort when toolbar sort is active)
    const effectiveSortKeys = toolbarSortKeys.length > 0 ? toolbarSortKeys : sortKeys;
    if (effectiveSortKeys.length > 0) {
      filtered = applySortKeys(filtered, effectiveSortKeys);
    }

    return filtered;
  }, [allData, activeFilters, interactiveFilters, toolbarFilterConditions, toolbarSortKeys, sortKeys]);

  // Apply optimistic board moves on top of the filtered+sorted data so that
  // dragged cards appear in their target column immediately while the action
  // is in flight. Optimistic moves are keyed by rowId; when an action
  // completes (success or failure) the entry is removed and the server data
  // takes over.
  const displayData = useMemo(() => {
    if (optimisticMoves.length === 0) return displayData_base;
    return displayData_base.map(row => {
      const move = optimisticMoves.find(m => {
        if (row.id !== undefined && row.id !== null) return String(row.id) === m.rowId;
        // Fallback: match by first field value (mirrors rowId() in BoardDisplay)
        return false;
      });
      if (!move) return row;
      return { ...row, [move.field]: move.newValue };
    });
  }, [displayData_base, optimisticMoves]);

  const layout = inlineLayout ?? viewConfig?.layout ?? 'table';
  // Toolbar layout override takes precedence over config layout
  const effectiveLayout = resolvedLayout ?? (toolbarLayout ?? layout);

  // Effective fields: apply toolbar field visibility filter when toolbar has been initialized
  const baseFields = inlineFields ?? fields;
  const effectiveFields = toolbarFieldVisibility.length > 0
    ? baseFields.filter((f) => {
        const vis = toolbarFieldVisibility.find((v) => v.key === f.key);
        return vis === undefined ? true : vis.visible;
      })
    : baseFields;
  const viewTitle = titleOverride ?? viewConfig?.title ?? viewId ?? '';
  const viewDescription = viewConfig?.description ?? '';
  const loading = (isInlineMode ? false : configLoading) || (isInlineMode ? false : dataLoading);

  // Build available fields list for toolbar pickers from the field config
  const toolbarAvailableFields = useMemo((): FieldDef[] => {
    if (baseFields.length > 0) {
      return baseFields.map((f) => ({ key: f.key, label: f.label ?? f.key }));
    }
    // Fallback: derive from data keys if no field config
    if (allData.length > 0) {
      return Object.keys(allData[0]).map((k) => ({ key: k, label: k }));
    }
    return [];
  }, [baseFields, allData]);

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

  // Bulk action handler — invoke a concept action for each selected row.
  // INV-06: migrated to bulkActionFeedback (useInvokeWithFeedback) so failures
  // are surfaced via InvocationStatusIndicator rather than a silent state variable.
  // TODO: migrate to <ActionButtonCompact> when InteractionSpec seeds create ActionBinding records
  const handleBulkAction = useCallback(async (actionKey: string, selectedRows: Record<string, unknown>[]) => {
    const bulkDef = controls.bulk?.actions.find(a => a.key === actionKey);
    if (!bulkDef) return;
    // Find matching row action config to get concept/action/params mapping
    const rowActionDef = controls.rowActions?.find(a => a.key === actionKey);
    if (!rowActionDef) return;

    for (const row of selectedRows) {
      const params: Record<string, unknown> = {};
      for (const [paramKey, rowField] of Object.entries(rowActionDef.params)) {
        // INV-06 null-safety: skip rows where the mapped field is undefined
        // rather than propagating undefined into the kernel call.
        const fieldValue = row[rowField];
        if (fieldValue === undefined) continue;
        params[paramKey] = fieldValue;
      }
      // bulkActionFeedback.invoke tracks the last invocation id for the indicator.
      const result = await bulkActionFeedback.invoke(
        rowActionDef.concept, rowActionDef.action, params,
      );
      if (result.variant !== 'ok') return; // stop on first failure; indicator shows error
    }
    refetch();
  }, [controls.bulk?.actions, controls.rowActions, refetch, bulkActionFeedback]);

  // Row action handler — legacy path; actions with actionBindingId bypass this via ActionButtonCompact in display components.
  // INV-06: migrated to rowActionFeedback (useInvokeWithFeedback) so failures
  // surface via InvocationStatusIndicator rather than a silent state variable.
  const handleRowAction = useCallback(async (action: RowActionConfig, row: Record<string, unknown>) => {
    const params: Record<string, unknown> = {};
    for (const [paramKey, rowField] of Object.entries(action.params)) {
      // INV-06 null-safety: guard against undefined row fields — skip the param
      // rather than forwarding undefined into the kernel, which causes silent
      // failures or unexpected behaviour in the handler.
      const fieldValue = row[rowField];
      if (fieldValue === undefined) continue;
      params[paramKey] = fieldValue;
    }
    const result = await rowActionFeedback.invoke(action.concept, action.action, params);
    if (result.variant === 'ok') {
      refetch();
    }
  }, [refetch, rowActionFeedback]);

  // Board card-move handler — invoked when a card is dropped onto a different
  // column. Uses optimistic UI: the card moves locally first, then an
  // ActionBinding/invoke call persists the change. On failure the optimistic
  // move is reverted so the card snaps back to its original column.
  //
  // The grouping field comes from effectiveGroupConfig — the same field that
  // BoardDisplay uses to partition cards into columns. We pass it in the
  // context so the board-card-move binding's parameterMap routes it to
  // ContentNode/update with { node: rowId, field: groupField, value: newValue }.
  const handleCardMove = useCallback(async (rowId: string, newGroupValue: string) => {
    if (!controls.moveBinding) return;

    // Resolve the grouping field from the current group config.
    const groupField = effectiveGroupConfig?.fields[0]?.field ?? '';
    if (!groupField) return;

    // Find the row to capture its current group value for rollback.
    const targetRow = displayData.find(r => {
      if (r.id !== undefined && r.id !== null) return String(r.id) === rowId;
      const firstKey = effectiveFields[0]?.key;
      return firstKey ? String(r[firstKey] ?? '') === rowId : false;
    });
    const prevValue = targetRow ? targetRow[groupField] : undefined;

    // Optimistic update — move the card visually before the action completes.
    setOptimisticMoves(prev => [...prev, { rowId, field: groupField, prevValue, newValue: newGroupValue }]);

    try {
      const result = await moveCardFeedback.invoke('ActionBinding', 'invoke', {
        binding: controls.moveBinding,
        context: JSON.stringify({ rowId, field: groupField, value: newGroupValue }),
      });

      if (result.variant === 'ok') {
        // Clear the optimistic move and reload authoritative data.
        setOptimisticMoves(prev => prev.filter(m => m.rowId !== rowId));
        refetch();
      } else {
        // Revert optimistic move on failure — card snaps back.
        setOptimisticMoves(prev => prev.filter(m => m.rowId !== rowId));
      }
    } catch {
      // Network error — revert optimistic move.
      setOptimisticMoves(prev => prev.filter(m => m.rowId !== rowId));
    }
  }, [controls.moveBinding, effectiveGroupConfig, displayData, effectiveFields, moveCardFeedback, refetch]);

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
            const dotColor = getLabelVisualizationColorToken(value);
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
      // INV-06: add a retry button so users can recover from transient query failures
      // without a full page reload.  The retry action re-triggers the underlying
      // useConceptQuery by calling the unified refetch() from the active data mode.
      return (
        <EmptyState
          title="Query failed"
          description={dataError}
          action={
            <button
              data-part="button"
              data-variant="outlined"
              onClick={() => refetch()}
            >
              Retry
            </button>
          }
        />
      );
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
                  setActionError(null);
                  try {
                    let result: Record<string, unknown>;
                    if (field === 'content') {
                      result = await invoke('ContentNode', 'update', { node, content: value });
                    } else if (field === 'metadata') {
                      result = await invoke('ContentNode', 'setMetadata', { node, metadata: value });
                    } else {
                      return;
                    }
                    if (result.variant !== 'ok') {
                      setActionError(String(result.message ?? `${field} save failed`));
                      return;
                    }
                    refetch();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : `${field} save failed`);
                  }
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
                  setActionError(null);
                  try {
                    const result = await invoke('ContentNode', 'update', { node, content: value });
                    if (result.variant !== 'ok') {
                      setActionError(String(result.message ?? 'Content save failed'));
                      return;
                    }
                    refetch();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : 'Content save failed');
                  }
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
            onCardMove={controls.moveBinding ? handleCardMove : undefined}
          />
        );

      case 'calendar': {
        // Resolve the date field key using the same heuristic CalendarDisplay uses
        // internally (formatter: 'date' wins; otherwise regex match on the key name).
        // This lets ViewRenderer build the correct prefill map without CalendarDisplay
        // needing to expose its internal dateField selection.
        const calDateField = (() => {
          const byFormatter = effectiveFields.find(f => f.formatter === 'date');
          if (byFormatter) return byFormatter.key;
          const byName = effectiveFields.find(f =>
            /date|at|on|time|created|updated|due|start|end/i.test(f.key),
          );
          return byName?.key ?? effectiveFields[0]?.key ?? 'date';
        })();

        // Infer start/end field keys for range prefill. Falls back to the date
        // field when no dedicated start/end key is found in the projection.
        const calStartField = effectiveFields.find(
          f => /start/i.test(f.key) && f.key !== calDateField,
        )?.key ?? calDateField;

        const calEndField = effectiveFields.find(
          f => /end/i.test(f.key) && f.key !== calDateField,
        )?.key ?? calDateField;

        const handleCalendarCreateEvent = controls.create
          ? (isoDate: string) => {
              setCreateInitialValues({ [calDateField]: isoDate });
              setShowCreate(true);
            }
          : undefined;

        // Drag-to-select: prefill both start and end time fields. The calendar
        // passes ISO datetime strings (YYYY-MM-DDTHH:00). Prefill uses the
        // inferred start/end field keys so the Tier 3 form pre-populates both.
        const handleCalendarCreateEventRange = controls.create
          ? (startIso: string, endIso: string) => {
              setCreateInitialValues({
                [calStartField]: startIso,
                [calEndField]: endIso,
              });
              setShowCreate(true);
            }
          : undefined;

        return (
          <CalendarDisplay
            data={displayData} fields={effectiveFields}
            onRowClick={(onSelect || controls.rowClick) ? handleRowClick : undefined}
            onCreateEvent={handleCalendarCreateEvent}
            onCreateEventRange={handleCalendarCreateEventRange}
          />
        );
      }

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
      {/* ViewTabBar — tabs for switching between saved views */}
      {!compact && !isInlineMode && savedViews.length > 1 && viewId && (
        <ViewTabBar
          tabs={savedViews.map(v => ({ id: v.id, label: v.name }))}
          activeViewId={viewId}
          onTabClick={(id) => {
            // Navigate to the same page but with a different view — for now refresh with the new viewId
            // In practice this would switch the active view without a full page nav
            if (id !== viewId) navigateToHref(`/admin/view-builder/${encodeURIComponent(id)}`);
          }}
          onCreateNew={() => navigateToHref('/admin/view-builder')}
        />
      )}

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
              {/* Save as View — appears when ad-hoc toolbar filters are active */}
              {toolbarFilterConditions.length > 0 && viewId && (
                <button
                  data-part="button"
                  data-variant="outlined"
                  onClick={() => navigateToHref('/admin/view-builder')}
                  title="Save current filter/sort/group as a new view"
                  style={{ fontSize: 'var(--typography-body-sm-size)' }}
                >
                  Save as View
                </button>
              )}
              {/* Edit View gear — navigate to view editor */}
              {viewId && !isInlineMode && (
                <button
                  data-part="button"
                  data-variant="outlined"
                  onClick={() => navigateToHref(`/admin/view-builder/${encodeURIComponent(viewId)}`)}
                  title="Edit this view's configuration"
                  style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '16px', lineHeight: 1 }}
                >
                  &#9881;
                </button>
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

      {/* ViewEditorToolbar — shown when toolbar is enabled or there are interactive filters/fields */}
      {!compact && !isInlineMode && (toolbarAvailableFields.length > 0 || interactiveFilters.length > 0) && (
        <ViewEditorToolbar
          availableFields={toolbarAvailableFields}
          filterConditions={toolbarFilterConditions}
          onFilterConditionsChange={setToolbarFilterConditions}
          sortKeys={toolbarSortKeys}
          onSortKeysChange={setToolbarSortKeys}
          groupConfig={toolbarGroupConfig}
          onGroupConfigChange={setToolbarGroupConfig}
          fieldVisibility={toolbarFieldVisibility}
          onFieldVisibilityChange={setToolbarFieldVisibility}
          currentLayout={effectiveLayout}
          onLayoutChange={(l) => {
            setToolbarLayout(l);
            setResolvedLayout(null); // clear widget-resolver override
          }}
          hasUnsavedChanges={false}
        />
      )}

      {/* Inline field-save errors (detail / content-body layouts) */}
      {inlineFieldError && (
        <div style={{ marginBottom: 'var(--spacing-sm)', padding: 'var(--spacing-xs) var(--spacing-md)', borderRadius: 'var(--radius-sm)', background: 'var(--palette-error-container)', color: 'var(--palette-on-error-container)', fontSize: 'var(--typography-body-sm-size)' }}>
          {inlineFieldError}
        </div>
      )}

      {/* Action feedback — INV-06: InvocationStatusIndicator replaces manual pending/error/success divs */}
      {rowActionFeedback.invocationId && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <InvocationStatusIndicator
            invocationId={rowActionFeedback.invocationId}
            verbose
            label={rowActionFeedback.status === 'ok' ? 'Action completed' : undefined}
          />
        </div>
      )}
      {bulkActionFeedback.invocationId && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <InvocationStatusIndicator
            invocationId={bulkActionFeedback.invocationId}
            verbose
            label={bulkActionFeedback.status === 'ok' ? 'Bulk action completed' : undefined}
          />
        </div>
      )}
      {moveCardFeedback.invocationId && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <InvocationStatusIndicator
            invocationId={moveCardFeedback.invocationId}
            verbose
            label={moveCardFeedback.status === 'ok' ? 'Card moved' : undefined}
          />
        </div>
      )}

      {/* Legacy toggle-group filters — shown only when no toolbar-managed filter conditions */}
      {toolbarFilterConditions.length === 0 && renderFilters()}

      {renderDisplay()}

      {children}

      {controls.create && (
        <CreateForm
          open={showCreate}
          onClose={() => {
            setShowCreate(false);
            // Clear calendar prefill values so the next open starts fresh.
            setCreateInitialValues({});
          }}
          onCreated={refetch}
          concept={controls.create.concept}
          action={controls.create.action}
          title={`Create ${viewTitle.replace(/s$/, '')}`}
          fields={controls.create.fields as Array<{ name: string; label?: string; type?: 'text' | 'textarea' | 'select'; options?: string[]; required?: boolean; placeholder?: string }>}
          destinationId={interactionSpecName ?? undefined}
          initialValues={Object.keys(createInitialValues).length > 0 ? createInitialValues : undefined}
        />
      )}
    </div>
  );
};

export type { FieldConfig } from './widgets/TableDisplay';
export default ViewRenderer;
