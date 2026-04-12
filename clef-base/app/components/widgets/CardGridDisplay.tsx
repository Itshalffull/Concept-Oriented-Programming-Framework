'use client';

/**
 * CardGridDisplay — renders View data as a grid of cards.
 * Display type component: receives data + field config from ViewRenderer.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import type { FieldConfig } from './TableDisplay';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';
import { ActionButtonCompact } from './ActionButton';

interface CardGridDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  /** Custom item renderer — when provided, replaces default card content with DisplayMode rendering */
  renderItem?: (row: Record<string, unknown>, onClick?: () => void) => React.ReactNode;
}

// ─── CardRowActionButtons ─────────────────────────────────────────────────
// Per-card action buttons with pending/error state management.

const CardRowActionButtons: React.FC<{
  row: Record<string, unknown>;
  rowActions: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
  stopPropagation?: boolean;
}> = ({ row, rowActions, onRowAction, stopPropagation = true }) => {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback(async (e: React.MouseEvent, action: RowActionConfig) => {
    if (stopPropagation) e.stopPropagation();
    if (pending) return;

    setPending(action.key);
    setError(null);
    setErrorAction(null);
    setSuccess(null);

    try {
      const result = onRowAction?.(action, row) as unknown;
      if (result instanceof Promise) {
        const resolved = await result as { variant?: string; message?: string } | undefined;
        if (resolved && resolved.variant && resolved.variant !== 'ok') {
          setError(resolved.message ?? `Action failed: ${resolved.variant}`);
          setErrorAction(action.key);
          setPending(null);
          return;
        }
      }
      setPending(null);
      setSuccess(action.key);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setErrorAction(action.key);
      setPending(null);
    }
  }, [pending, onRowAction, row, stopPropagation]);

  return (
    <div data-surface="display-row-actions">
      <div data-part="row-action-list">
        {rowActions.map(action => {
          const { visible, label } = resolveRowAction(action, row);
          if (!visible) return null;
          // ActionBinding path — delegate to ActionButtonCompact
          if (action.actionBindingId) {
            return (
              <ActionButtonCompact
                key={action.key}
                binding={action.actionBindingId}
                context={row}
                label={label}
                buttonVariant={action.variant === 'filled' ? 'primary' : action.variant === 'outlined' ? 'default' : 'ghost'}
              />
            );
          }
          // Legacy path — raw button
          const isPending = pending === action.key;
          const isSuccess = success === action.key;
          return (
              <button
              key={action.key}
              data-part="button"
              data-variant={isSuccess ? 'ghost' : (action.variant ?? 'ghost')}
              disabled={!!pending}
              onClick={(e) => handleAction(e, action)}
              data-state={isSuccess ? 'success' : undefined}
            >
              {isPending ? '...' : isSuccess ? 'Done' : label}
            </button>
          );
        })}
      </div>
      {error && errorAction && (
        <div data-part="row-action-error">
          <span>{error}</span>
          <button
            data-part="button"
            data-variant="ghost"
            data-role="row-action-retry"
            onClick={(e) => {
              e.stopPropagation();
              const action = rowActions.find(a => a.key === errorAction);
              if (action) handleAction(e, action);
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

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
    <div className="card-grid" data-surface="display-card-grid">
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
                <div data-part="card-row-actions" onClick={(e) => e.stopPropagation()}>
                  <CardRowActionButtons
                    row={row}
                    rowActions={rowActions}
                    onRowAction={onRowAction}
                  />
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
            <strong data-part="card-title">
              {titleValue}
            </strong>
            <div data-part="card-meta-list">
              {metaFields.map(field => {
                const val = row[field.key];
                const rendered = formatCardValue(val, field.formatter);
                if (!rendered) return null;
                return (
                  <div key={field.key} data-part="card-meta">
                    <span data-part="card-meta-label">
                      {field.label ?? field.key}:
                    </span>
                    {rendered}
                  </div>
                );
              })}
            </div>
            {rowActions && rowActions.length > 0 && (
              <div data-part="card-row-actions" onClick={(e) => e.stopPropagation()}>
                <CardRowActionButtons
                  row={row}
                  rowActions={rowActions}
                  onRowAction={onRowAction}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default CardGridDisplay;
