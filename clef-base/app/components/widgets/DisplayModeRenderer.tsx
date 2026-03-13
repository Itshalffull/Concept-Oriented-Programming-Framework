'use client';

/**
 * DisplayModeRenderer — resolves and renders a DisplayMode for a single entity.
 *
 * Given an entity, schema, and mode_id, it:
 * 1. Calls DisplayMode.get(schema:mode_id) to get the rendering strategy
 * 2. Dispatches to:
 *    - ComponentMapping.render() for full widget takeover
 *    - LayoutRenderer for spatial composition
 *    - Flat FieldPlacement list for simple vertical rendering
 * 3. Falls back to a simple field list if the mode is not found
 */

import React, { useMemo } from 'react';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { Badge } from './Badge';

interface DisplayModeRendererProps {
  /** The entity data to render */
  entity: Record<string, unknown>;
  /** The schema to resolve display mode for */
  schema: string;
  /** The mode ID (e.g. 'card', 'table-row', 'compact') */
  modeId: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS styles for the wrapper */
  style?: React.CSSProperties;
}

interface DisplayModeConfig {
  variant: string;
  mode: string;
  name: string;
  mode_id: string;
  schema: string;
  layout: string | null;
  component_mapping: string | null;
  placements: string;
  role_visibility: string | null;
  cacheable: boolean | null;
}

interface FieldPlacementConfig {
  placement: string;
  source_field: string;
  formatter: string;
  formatter_options: string | null;
  label_display: string;
  label_override: string | null;
  visible: boolean;
  role_visibility: string | null;
  field_mapping: string | null;
}

/**
 * Format a field value using a FieldPlacement formatter.
 * Mirrors the formatters in TableDisplay for consistency.
 */
function formatFieldValue(value: unknown, formatter: string, _options?: string | null): React.ReactNode {
  if (value === null || value === undefined) return <span style={{ opacity: 0.4 }}>-</span>;

  switch (formatter) {
    case 'heading':
      return <strong>{String(value)}</strong>;

    case 'badge':
      return <Badge variant="secondary">{String(value)}</Badge>;

    case 'boolean-badge':
    case 'boolean_badge':
      return <Badge variant={value ? 'success' : 'secondary'}>{value ? 'yes' : 'no'}</Badge>;

    case 'rich_text':
    case 'rich-text':
      return <div dangerouslySetInnerHTML={{ __html: String(value) }} />;

    case 'date_relative':
    case 'date-relative': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return <span>{String(value)}</span>;
      const now = Date.now();
      const diff = now - d.getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return <span>today</span>;
      if (days === 1) return <span>yesterday</span>;
      if (days < 30) return <span>{days}d ago</span>;
      return <span>{d.toLocaleDateString()}</span>;
    }

    case 'date_absolute':
    case 'date-absolute': {
      const d = new Date(String(value));
      return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
    }

    case 'entity_reference':
    case 'entity-reference':
      return <Badge variant="info">{String(value)}</Badge>;

    case 'tag_list':
    case 'tag-list': {
      const tags = Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
      return (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.map((t: unknown, i: number) => (
            <Badge key={i} variant="secondary">{String(t).trim()}</Badge>
          ))}
        </span>
      );
    }

    case 'image':
      return <img src={String(value)} alt="" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />;

    case 'json': {
      const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return <code style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{str}</code>;
    }

    case 'json_count':
    case 'json-count': {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) return <span>{parsed.length} items</span>;
        if (typeof parsed === 'object' && parsed !== null)
          return <span>{Object.keys(parsed).length} entries</span>;
      } catch { /* fall through */ }
      return <span>{String(value)}</span>;
    }

    case 'schema-badges':
    case 'schema_badges': {
      const schemas = Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
      return (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {schemas.map((s: unknown, i: number) => (
            <Badge key={i} variant="info">{String(s).trim()}</Badge>
          ))}
        </span>
      );
    }

    case 'code':
      return <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{String(value)}</code>;

    case 'truncate': {
      const s = String(value);
      return <span title={s}>{s.length > 60 ? s.slice(0, 60) + '...' : s}</span>;
    }

    case 'plain_text':
    case 'plain-text':
    default:
      return <span>{String(value)}</span>;
  }
}

/**
 * Renders a flat list of FieldPlacements for an entity.
 * Fetches all FieldPlacements once and filters to the requested IDs.
 */
const FlatFieldsRenderer: React.FC<{
  entity: Record<string, unknown>;
  placementIds: string[];
}> = ({ entity, placementIds }) => {
  const { data: allPlacementsData } = useConceptQuery<Record<string, unknown>[]>(
    'FieldPlacement', 'list',
  );

  const placements = useMemo(() => {
    if (!allPlacementsData) return [];
    const items: Record<string, unknown>[] = Array.isArray(allPlacementsData)
      ? allPlacementsData
      : (typeof allPlacementsData === 'object' && 'items' in allPlacementsData)
        ? (() => { try { return JSON.parse(String((allPlacementsData as Record<string, unknown>).items)); } catch { return []; } })()
        : [];
    const byId = new Map<string, FieldPlacementConfig>();
    for (const item of items) {
      byId.set(String(item.placement ?? ''), item as unknown as FieldPlacementConfig);
    }
    return placementIds
      .map(id => byId.get(id))
      .filter(Boolean) as FieldPlacementConfig[];
  }, [allPlacementsData, placementIds]);

  if (placements.length === 0) {
    return <SimpleFieldList entity={entity} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {placements.filter(p => p.visible !== false).map(placement => {
        const value = entity[placement.source_field];
        const labelText = placement.label_override ?? placement.source_field;

        return (
          <div key={placement.placement}>
            {placement.label_display !== 'hidden' && (
              <span style={{
                fontSize: '11px',
                color: 'var(--palette-on-surface-variant)',
                opacity: 0.7,
                ...(placement.label_display === 'above' ? { display: 'block', marginBottom: 1 } : { marginRight: 4 }),
              }}>
                {labelText}:
              </span>
            )}
            <span style={{ fontSize: 'var(--typography-body-sm-size, 13px)' }}>
              {formatFieldValue(value, placement.formatter, placement.formatter_options)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Simple fallback renderer — shows all non-internal fields.
 */
const SimpleFieldList: React.FC<{ entity: Record<string, unknown> }> = ({ entity }) => {
  const entries = Object.entries(entity).filter(
    ([k]) => !k.startsWith('_') && k !== 'hasChildren' && k !== 'childCount'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.slice(0, 8).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null;
        return (
          <div key={key} style={{ fontSize: 'var(--typography-body-sm-size, 13px)' }}>
            <span style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', opacity: 0.6 }}>
              {key}:
            </span>{' '}
            <span style={{ color: 'var(--palette-on-surface)', wordBreak: 'break-word' }}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Infer a formatter from a slot or prop name.
 * Falls back to 'plain_text' if no hint matches.
 */
function inferFormatter(name: string): string {
  const n = name.toLowerCase();
  if (n === 'title' || n === 'heading' || n === 'name') return 'heading';
  if (n === 'badge' || n === 'status' || n === 'type' || n === 'kind') return 'badge';
  if (n === 'tags' || n === 'labels') return 'tag_list';
  if (n === 'date' || n === 'created' || n === 'updated' || n.endsWith('_at') || n.endsWith('_date')) return 'date_relative';
  if (n === 'description' || n === 'body' || n === 'content') return 'truncate';
  if (n === 'icon' || n === 'image' || n === 'avatar') return 'image';
  return 'plain_text';
}

/**
 * Resolve a single source string against an entity.
 * Returns { node, resolved } where resolved indicates whether the source was meaningful.
 */
function resolveSource(
  source: string,
  entity: Record<string, unknown>,
  formatter: string,
): { node: React.ReactNode; resolved: boolean } {
  // entity_field:fieldname
  const fieldMatch = source.match(/^entity_field:(.+)$/);
  if (fieldMatch) {
    const val = entity[fieldMatch[1]];
    return { node: formatFieldValue(val, formatter), resolved: true };
  }

  // static_value:literal
  const staticMatch = source.match(/^static_value:(.*)$/);
  if (staticMatch) {
    return { node: <span>{staticMatch[1]}</span>, resolved: true };
  }

  // entity_reference_display:fieldname — render as info badge
  const refMatch = source.match(/^entity_reference_display:(.+)$/);
  if (refMatch) {
    const val = entity[refMatch[1]];
    if (val !== null && val !== undefined) {
      return { node: <Badge variant="info">{String(val)}</Badge>, resolved: true };
    }
    return { node: <span style={{ opacity: 0.4 }}>-</span>, resolved: true };
  }

  // Unknown source type — show as a subtle badge
  const colonIdx = source.indexOf(':');
  const sourceType = colonIdx > 0 ? source.slice(0, colonIdx) : source;
  return {
    node: <Badge variant="secondary">{sourceType}</Badge>,
    resolved: false,
  };
}

/**
 * ComponentMapping renderer — calls ComponentMapping.render() and renders the tree.
 */
const ComponentMappingRenderer: React.FC<{
  entity: Record<string, unknown>;
  mappingId: string;
}> = ({ entity, mappingId }) => {
  const invoke = useKernelInvoke();
  const [renderTree, setRenderTree] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    invoke('ComponentMapping', 'render', {
      mapping: mappingId,
      context: JSON.stringify({ entity }),
    })
      .then(result => {
        if (cancelled) return;
        if (result.variant === 'ok' && result.render_tree) {
          const tree = typeof result.render_tree === 'string'
            ? JSON.parse(result.render_tree)
            : result.render_tree;
          setRenderTree(tree);
        } else {
          setError(`Mapping render failed: ${result.variant}`);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [mappingId, JSON.stringify(entity), invoke]);

  if (error) {
    return <SimpleFieldList entity={entity} />;
  }

  if (!renderTree) {
    return <SimpleFieldList entity={entity} />;
  }

  const widgetId = renderTree.widget_id as string | undefined;
  const slots = renderTree.slots as Array<{ name: string; sources: string[] }> | undefined;
  const props = renderTree.props as Array<{ name: string; source: string }> | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm, 6px)' }}>
      {widgetId && (
        <span style={{ alignSelf: 'flex-start', fontSize: '10px' }}>
          <Badge variant="secondary">{widgetId}</Badge>
        </span>
      )}
      {slots?.map(slot => {
        const formatter = inferFormatter(slot.name);
        return (
          <div key={slot.name} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{
              fontSize: '10px',
              color: 'var(--palette-on-surface-variant)',
              opacity: 0.55,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {slot.name}
            </span>
            <span style={{
              fontSize: 'var(--typography-body-sm-size, 13px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
            }}>
              {slot.sources.map((src, i) => (
                <React.Fragment key={i}>
                  {resolveSource(src, entity, formatter).node}
                </React.Fragment>
              ))}
            </span>
          </div>
        );
      })}
      {props?.map(prop => {
        const formatter = inferFormatter(prop.name);
        const { node } = resolveSource(prop.source, entity, formatter);
        return (
          <div key={prop.name} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{
              fontSize: '10px',
              color: 'var(--palette-on-surface-variant)',
              opacity: 0.55,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {prop.name}
            </span>
            <span style={{ fontSize: 'var(--typography-body-sm-size, 13px)' }}>
              {node}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * DisplayModeRenderer — the main export.
 * Resolves a (schema, mode_id) pair and renders the entity accordingly.
 */
export const DisplayModeRenderer: React.FC<DisplayModeRendererProps> = ({
  entity, schema, modeId, onClick, style,
}) => {
  const modeKey = `${schema}:${modeId}`;

  // Fetch the DisplayMode config
  const { data: modeConfig, loading } = useConceptQuery<DisplayModeConfig>(
    'DisplayMode', 'get', { mode: modeKey },
  );

  const placementIds = useMemo(() => {
    if (!modeConfig || modeConfig.variant !== 'ok') return [];
    try {
      const parsed = JSON.parse(modeConfig.placements);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [modeConfig?.placements]);

  const wrapperStyle: React.CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  const content = (() => {
    // Loading state
    if (loading) {
      return (
        <div style={{ padding: 4, fontSize: '11px', color: 'var(--palette-on-surface-variant)' }}>
          ...
        </div>
      );
    }

    // Mode not found — fall back to simple field list
    if (!modeConfig || modeConfig.variant !== 'ok') {
      return <SimpleFieldList entity={entity} />;
    }

    // Strategy 1: ComponentMapping takeover
    if (modeConfig.component_mapping) {
      return (
        <ComponentMappingRenderer
          entity={entity}
          mappingId={modeConfig.component_mapping}
        />
      );
    }

    // Strategy 2: Layout — delegate to LayoutRenderer
    // (lazy import to avoid circular deps since LayoutRenderer imports ViewRenderer)
    if (modeConfig.layout) {
      // For now, fall back to flat fields when layout is set.
      // Full LayoutRenderer integration will be wired in a follow-up step.
      if (placementIds.length > 0) {
        return <FlatFieldsRenderer entity={entity} placementIds={placementIds} />;
      }
      return <SimpleFieldList entity={entity} />;
    }

    // Strategy 3: Flat field placements
    if (placementIds.length > 0) {
      return <FlatFieldsRenderer entity={entity} placementIds={placementIds} />;
    }

    // No strategy configured — simple fallback
    return <SimpleFieldList entity={entity} />;
  })();

  return (
    <div onClick={onClick} style={wrapperStyle}>
      {content}
    </div>
  );
};

export default DisplayModeRenderer;
