export type AdminDisplayWidgetId =
  | 'admin-table-display'
  | 'admin-card-grid-display'
  | 'admin-graph-display'
  | 'admin-stat-cards-display'
  | 'admin-detail-display'
  | 'admin-content-body-display';

export interface AdminThemeContext {
  density?: string | null;
  motif?: string | null;
  styleProfile?: string | null;
  sourceType?: string | null;
}

export interface DisplayWidgetContext extends AdminThemeContext {
  viewId: string;
  layout: string;
  rowCount: number;
  fieldCount: number;
}

export function getDisplayInteractor(layout: string): string | null {
  switch (layout) {
    case 'table':
    case 'card-grid':
      return 'records-collection';
    case 'graph':
      return 'record-graph';
    case 'stat-cards':
      return 'record-metrics';
    case 'detail':
      return 'record-detail';
    case 'content-body':
      return 'record-body';
    default:
      return null;
  }
}

export function buildDisplayWidgetContext(input: DisplayWidgetContext): Record<string, unknown> {
  const tags = [
    'admin',
    'view',
    input.layout,
    input.rowCount <= 6 ? 'small-collection' : 'large-collection',
  ];

  return {
    platform: 'browser',
    viewport: 'desktop',
    density: input.density ?? null,
    motif: input.motif ?? null,
    styleProfile: input.styleProfile ?? null,
    sourceType: input.sourceType ?? null,
    optionCount: input.rowCount,
    fieldCount: input.fieldCount,
    viewId: input.viewId,
    tags,
  };
}

export function mapWidgetToLayout(widget: string | null | undefined, fallbackLayout: string): string {
  switch (widget) {
    case 'admin-table-display':
      return 'table';
    case 'admin-card-grid-display':
      return 'card-grid';
    case 'admin-graph-display':
      return 'graph';
    case 'admin-stat-cards-display':
      return 'stat-cards';
    case 'admin-detail-display':
      return 'detail';
    case 'admin-content-body-display':
      return 'content-body';
    default:
      return fallbackLayout;
  }
}
