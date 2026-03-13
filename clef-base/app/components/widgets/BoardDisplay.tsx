'use client';

/**
 * BoardDisplay — Kanban board display type for ViewRenderer.
 *
 * Groups data rows into columns based on a grouping field. Each column
 * shows cards that can be clicked. The first field with a "badge" formatter
 * is used as the group-by field by default, or the first field if none.
 */

import React, { useMemo } from 'react';
import type { FieldConfig } from './TableDisplay';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';

interface BoardDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  /** Field key to group by. If omitted, uses the first badge-formatted field or the first field. */
  groupBy?: string;
  /** Custom item renderer — when provided, replaces default card content with DisplayMode rendering */
  renderItem?: (row: Record<string, unknown>, onClick?: () => void) => React.ReactNode;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const BoardDisplay: React.FC<BoardDisplayProps> = ({
  data, fields, onRowClick, rowActions, onRowAction, groupBy, renderItem,
}) => {
  // Determine the grouping field
  const groupField = useMemo(() => {
    if (groupBy) return groupBy;
    // Use the first badge-formatted field, or fall back to the first field
    const badgeField = fields.find(f => f.formatter === 'badge');
    return badgeField?.key ?? fields[0]?.key ?? 'type';
  }, [groupBy, fields]);

  // Non-group fields for card content
  const cardFields = useMemo(() =>
    fields.filter(f => f.key !== groupField),
  [fields, groupField]);

  // Group data into columns
  const columns = useMemo(() => {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of data) {
      const key = formatValue(row[groupField]) || '(none)';
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  }, [data, groupField]);

  if (columns.length === 0) {
    return (
      <div style={{
        padding: 'var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--palette-on-surface-variant)',
      }}>
        No data to display
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--spacing-md)',
      overflowX: 'auto',
      padding: 'var(--spacing-sm)',
      minHeight: 200,
    }}>
      {columns.map(col => (
        <div
          key={col.key}
          style={{
            minWidth: 220,
            maxWidth: 320,
            flex: '1 0 220px',
            background: 'var(--palette-surface-variant)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Column header */}
          <div style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            fontWeight: 600,
            fontSize: 'var(--typography-label-md-size, 13px)',
            color: 'var(--palette-on-surface)',
            borderBottom: '2px solid var(--palette-outline-variant)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{col.key}</span>
            <span style={{
              fontSize: '11px',
              color: 'var(--palette-on-surface-variant)',
              fontFamily: 'var(--typography-font-family-mono)',
            }}>
              {col.rows.length}
            </span>
          </div>

          {/* Cards */}
          <div style={{
            padding: 'var(--spacing-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-xs)',
            flex: 1,
            overflowY: 'auto',
          }}>
            {col.rows.map((row, i) => (
              <div
                key={i}
                onClick={() => onRowClick?.(row)}
                style={{
                  background: 'var(--palette-surface)',
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--spacing-sm)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  if (onRowClick) {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      'var(--elevation-1, 0 1px 3px rgba(0,0,0,0.1))';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {renderItem ? renderItem(row, onRowClick ? () => onRowClick(row) : undefined) : (
                  <>
                    {cardFields.map(field => {
                      const val = row[field.key];
                      if (val === null || val === undefined || val === '') return null;
                      // Skip internal fields
                      if (field.key === '_children' || field.key === 'hasChildren') return null;
                      return (
                        <div key={field.key} style={{ marginBottom: 2 }}>
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--palette-on-surface-variant)',
                            opacity: 0.6,
                          }}>
                            {field.label ?? field.key}:
                          </span>{' '}
                          <span style={{
                            fontSize: 'var(--typography-body-sm-size, 13px)',
                            color: 'var(--palette-on-surface)',
                            wordBreak: 'break-word',
                          }}>
                            {formatValue(val)}
                          </span>
                        </div>
                      );
                    })}
                    {/* Child count indicator */}
                    {row.hasChildren && (
                      <div style={{
                        fontSize: '10px',
                        color: 'var(--palette-on-surface-variant)',
                        opacity: 0.6,
                        marginTop: 2,
                      }}>
                        ▸ {String(row.childCount)} {Number(row.childCount) === 1 ? 'child' : 'children'}
                      </div>
                    )}
                  </>
                )}

                {/* Row actions */}
                {rowActions && rowActions.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 4, marginTop: 4,
                    borderTop: '1px solid var(--palette-outline-variant)',
                    paddingTop: 4,
                  }}>
                    {rowActions.map(action => {
                      const { visible, label } = resolveRowAction(action, row);
                      if (!visible) return null;
                      return (
                        <button
                          key={action.key}
                          onClick={e => {
                            e.stopPropagation();
                            onRowAction?.(action, row);
                          }}
                          style={{
                            padding: '2px 6px', fontSize: '10px',
                            background: action.variant === 'filled' ? 'var(--palette-primary)' : 'transparent',
                            color: action.variant === 'filled' ? 'var(--palette-on-primary)' : 'var(--palette-primary)',
                            border: action.variant === 'outlined' ? '1px solid var(--palette-primary)' : 'none',
                            borderRadius: 3, cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BoardDisplay;
