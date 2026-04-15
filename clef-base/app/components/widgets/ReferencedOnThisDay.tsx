'use client';

/**
 * ReferencedOnThisDay — React adapter for the referenced-on-this-day.widget spec.
 *
 * Right-rail panel for the daily notes page. Calls ContentNode/listByDateRef to
 * fetch all ContentNodes whose date fields match the given date, then groups
 * results by their applied schema. Never scans all nodes client-side — all
 * filtering is delegated to the kernel action. See DN-6 in
 * docs/plans/daily-notes-entrypoint-prd.md.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useConceptQuery } from '../../../lib/use-concept-query';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContentNodeRow {
  node_id: string;
  content: Record<string, unknown>;
  schemas: string[];
  created_at?: string;
}

interface SchemaGroup {
  schemaName: string;
  nodes: ContentNodeRow[];
}

export interface ReferencedOnThisDayProps {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Whether groups start expanded. Defaults to true. */
  initialExpanded?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getNodeTitle(row: ContentNodeRow): string {
  const c = row.content ?? {};
  if (typeof c.title === 'string' && c.title.trim()) return c.title.trim();
  if (typeof c.name === 'string' && c.name.trim()) return c.name.trim();
  return row.node_id;
}

function getNodePreview(row: ContentNodeRow): string {
  const c = row.content ?? {};
  if (typeof c.preview === 'string' && c.preview.trim()) return c.preview.trim();
  if (typeof c.description === 'string' && c.description.trim()) {
    return c.description.trim().slice(0, 120);
  }
  if (typeof c.body === 'string' && c.body.trim()) {
    return c.body.trim().slice(0, 120);
  }
  return '';
}

function groupBySchema(rows: ContentNodeRow[]): SchemaGroup[] {
  const map = new Map<string, ContentNodeRow[]>();
  for (const row of rows) {
    const schemas = Array.isArray(row.schemas) && row.schemas.length > 0
      ? row.schemas
      : ['Unclassified'];
    // A node may carry multiple schemas — place it in each group
    for (const schema of schemas) {
      const existing = map.get(schema) ?? [];
      existing.push(row);
      map.set(schema, existing);
    }
  }
  return Array.from(map.entries()).map(([schemaName, nodes]) => ({ schemaName, nodes }));
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const ReferencedOnThisDay: React.FC<ReferencedOnThisDayProps> = ({
  date,
  initialExpanded = true,
}) => {
  // Fetch via kernel action — never scan all nodes client-side (DN-6 invariant)
  const { data, loading, error } = useConceptQuery<{ nodes?: unknown }>(
    'ContentNode',
    'listByDateRef',
    { date },
  );

  const rows: ContentNodeRow[] = useMemo(() => {
    if (!data?.nodes) return [];
    try {
      const parsed =
        typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes;
      return Array.isArray(parsed) ? (parsed as ContentNodeRow[]) : [];
    } catch {
      return [];
    }
  }, [data]);

  const groups = useMemo(() => groupBySchema(rows), [rows]);

  // Per-group collapsed state — keyed by schema name
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isExpanded = (schemaName: string) =>
    collapsed[schemaName] === undefined ? initialExpanded : !collapsed[schemaName];
  const toggle = (schemaName: string) =>
    setCollapsed(prev => ({ ...prev, [schemaName]: isExpanded(schemaName) }));

  // ── Panel state derivation (mirrors referenced-on-this-day.widget FSM) ──
  const panelState = loading
    ? 'loading'
    : error
    ? 'error'
    : groups.length === 0
    ? 'empty'
    : 'browsing';

  return (
    <div
      data-part="root"
      data-state={panelState}
      data-date={date}
      aria-label="Referenced on this day"
      role="region"
      aria-live="polite"
      className="referenced-on-this-day-panel"
    >
      <h2 data-part="panel-heading" className="panel-heading">
        Referenced on this day
      </h2>

      {/* Loading */}
      {panelState === 'loading' && (
        <div
          data-part="loading-state"
          role="status"
          aria-label="Loading references"
          aria-busy="true"
          className="panel-loading"
        >
          <span className="loading-spinner" aria-hidden="true" />
          <span className="loading-text">Loading…</span>
        </div>
      )}

      {/* Error */}
      {panelState === 'error' && (
        <div
          data-part="error-state"
          role="alert"
          aria-label="Error loading references"
          className="panel-error"
        >
          <p className="error-message">Could not load references. Try refreshing.</p>
        </div>
      )}

      {/* Empty */}
      {panelState === 'empty' && (
        <div
          data-part="empty-state"
          role="status"
          aria-label="No references found"
          aria-live="polite"
          className="panel-empty"
        >
          <p data-part="empty-message" className="empty-message">
            Nothing referenced today.
          </p>
        </div>
      )}

      {/* Browsing */}
      {panelState === 'browsing' && (
        <ul data-part="group-list" role="list" aria-label="Schema groups" className="group-list">
          {groups.map(group => {
            const expanded = isExpanded(group.schemaName);
            return (
              <li key={group.schemaName} data-part="backlink-group" className="schema-group">
                <button
                  data-part="group-header"
                  data-schema={group.schemaName}
                  data-expanded={expanded ? 'true' : 'false'}
                  role="button"
                  aria-expanded={expanded}
                  aria-controls={`group-items-${group.schemaName}`}
                  onClick={() => toggle(group.schemaName)}
                  className="group-header"
                  type="button"
                >
                  <span data-part="group-label" className="group-label">
                    {group.schemaName}
                  </span>
                  <span data-part="group-count" className="group-count">
                    ({group.nodes.length})
                  </span>
                  <span className="group-chevron" aria-hidden="true">
                    {expanded ? '▾' : '▸'}
                  </span>
                </button>

                {expanded && (
                  <ul
                    id={`group-items-${group.schemaName}`}
                    data-part="group-items"
                    data-schema={group.schemaName}
                    role="list"
                    aria-label={`Nodes in ${group.schemaName}`}
                    className="node-list"
                  >
                    {group.nodes.map(row => {
                      const title = getNodeTitle(row);
                      const preview = getNodePreview(row);
                      return (
                        <li key={row.node_id} className="node-item">
                          <Link
                            data-part="node-row"
                            data-node-id={row.node_id}
                            href={`/admin/content/${row.node_id}`}
                            role="link"
                            aria-label={title}
                            className="node-row"
                          >
                            <span data-part="node-title" className="node-title">
                              {title}
                            </span>
                            {preview && (
                              <span data-part="node-preview" className="node-preview">
                                {preview}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ReferencedOnThisDay;
