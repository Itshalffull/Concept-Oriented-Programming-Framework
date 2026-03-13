'use client';

/**
 * CardGridDisplay — renders View data as a grid of cards.
 * Display type component: receives data + field config from ViewRenderer.
 */

import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import type { FieldConfig } from './TableDisplay';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';

interface CardGridDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  /** Custom item renderer — when provided, replaces default card content with DisplayMode rendering */
  renderItem?: (row: Record<string, unknown>, onClick?: () => void) => React.ReactNode;
}

function formatCardValue(value: unknown, formatter?: string): React.ReactNode {
  if (value === null || value === undefined) return null;

  switch (formatter) {
    case 'badge':
      return value ? <Badge variant="secondary">{String(value)}</Badge> : null;
    case 'boolean-badge':
      return <Badge variant={value ? 'success' : 'secondary'}>{value ? 'yes' : 'no'}</Badge>;
    case 'json-count': {
      try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) return <span>{parsed.length} items</span>;
        if (typeof parsed === 'object' && parsed !== null)
          return <span>{Object.keys(parsed).length} entries</span>;
      } catch { /* fall through */ }
      return <span>{String(value)}</span>;
    }
    default:
      return <span>{String(value)}</span>;
  }
}

export const CardGridDisplay: React.FC<CardGridDisplayProps> = ({ data, fields, onRowClick, rowActions, onRowAction, renderItem }) => {
  const visibleFields = fields.filter(f => f.visible !== false);

  // First field is used as card title, rest as metadata
  const titleField = visibleFields[0];
  const metaFields = visibleFields.slice(1);

  return (
    <div className="card-grid">
      {data.map((row, i) => {
        // Custom renderItem from DisplayMode — replaces default card content
        if (renderItem) {
          return (
            <Card
              key={(row.node as string) ?? (row.id as string) ?? i}
              variant="outlined"
              clickable={!!onRowClick}
              onClick={() => onRowClick?.(row)}
            >
              {renderItem(row, onRowClick ? () => onRowClick(row) : undefined)}
              {rowActions && rowActions.length > 0 && (
                <div
                  style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {rowActions.map(action => {
                    const { visible, label } = resolveRowAction(action, row);
                    if (!visible) return null;
                    return (
                      <button
                        key={action.key}
                        data-part="button"
                        data-variant={action.variant ?? 'ghost'}
                        onClick={() => onRowAction?.(action, row)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        }

        const titleValue = titleField ? String(row[titleField.key] ?? '') : `Item ${i + 1}`;
        return (
          <Card
            key={i}
            variant="outlined"
            clickable={!!onRowClick}
            onClick={() => onRowClick?.(row)}
          >
            <strong style={{ fontSize: 'var(--typography-heading-sm-size)', marginBottom: 'var(--spacing-sm)', display: 'block' }}>
              {titleValue}
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
              {metaFields.map(field => {
                const val = row[field.key];
                const rendered = formatCardValue(val, field.formatter);
                if (!rendered) return null;
                return (
                  <div key={field.key} style={{ fontSize: 'var(--typography-body-sm-size)' }}>
                    <span style={{ color: 'var(--palette-on-surface-variant)', marginRight: 'var(--spacing-xs)' }}>
                      {field.label ?? field.key}:
                    </span>
                    {rendered}
                  </div>
                );
              })}
            </div>
            {rowActions && rowActions.length > 0 && (
              <div
                style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {rowActions.map(action => {
                  const { visible, label } = resolveRowAction(action, row);
                  if (!visible) return null;
                  return (
                    <button
                      key={action.key}
                      data-part="button"
                      data-variant={action.variant ?? 'ghost'}
                      onClick={() => onRowAction?.(action, row)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default CardGridDisplay;
