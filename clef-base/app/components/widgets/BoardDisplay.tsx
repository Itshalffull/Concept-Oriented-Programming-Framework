'use client';

/**
 * BoardDisplay — Kanban board display type for ViewRenderer.
 *
 * Groups data rows into columns based on a grouping field. Each column
 * shows cards that can be clicked. The first field with a "badge" formatter
 * is used as the group-by field by default, or the first field if none.
 *
 * Keyboard navigation (KB-18):
 * The root container carries data-keybinding-scope="app.display.board" so
 * the global useKeyBindings dispatcher routes arrow-key events through the
 * KeyBinding / ActionBinding pipeline. The widget listens for the resulting
 * `clef:display-nav` CustomEvent and updates its column / card selection state.
 *
 * Navigation signals: board-col-prev, board-col-next, board-card-prev,
 * board-card-next, board-card-activate, board-card-move-right.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { FieldConfig } from './TableDisplay';
import { resolveRowAction, type RowActionConfig } from '../../../lib/row-actions';
import { ActionButtonCompact } from './ActionButton';

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
  /**
   * Called when a card is dropped onto a different column.
   * Receives the row's ID (value of the first field, or `id` field if present)
   * and the new group value (the target column key).
   *
   * TODO: views wire onCardMove via ActionBinding based on their grouping field.
   *
   * When undefined, dragging is disabled and a visual indicator is shown.
   */
  onCardMove?: (rowId: string, newGroupValue: string) => void;
}

// ─── BoardCardActionButtons ───────────────────────────────────────────────
// Per-card action buttons with pending/error state management.

const BoardCardActionButtons: React.FC<{
  row: Record<string, unknown>;
  rowActions: RowActionConfig[];
  onRowAction?: (action: RowActionConfig, row: Record<string, unknown>) => void;
}> = ({ row, rowActions, onRowAction }) => {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback(async (e: React.MouseEvent, action: RowActionConfig) => {
    e.stopPropagation();
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
  }, [pending, onRowAction, row]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      borderTop: '1px solid var(--palette-outline-variant)',
      paddingTop: 4, marginTop: 4,
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
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
              onClick={(e) => handleAction(e, action)}
              disabled={!!pending}
              style={{
                padding: '2px 6px', fontSize: '10px',
                background: isSuccess
                  ? 'transparent'
                  : action.variant === 'filled' ? 'var(--palette-primary)' : 'transparent',
                color: isSuccess
                  ? 'var(--palette-success, #2e7d32)'
                  : action.variant === 'filled' ? 'var(--palette-on-primary)' : 'var(--palette-primary)',
                border: action.variant === 'outlined' ? '1px solid var(--palette-primary)' : 'none',
                borderRadius: 3, cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending && !isPending ? 0.5 : 1,
              }}
            >
              {isPending ? '...' : isSuccess ? 'Done' : label}
            </button>
          );
        })}
      </div>
      {error && (
        <div style={{
          fontSize: '10px',
          color: 'var(--palette-error, #d32f2f)',
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const action = rowActions.find(a => a.key === errorAction);
              if (action) handleAction(e, action);
            }}
            style={{
              fontSize: '10px', padding: '0 2px',
              background: 'none', border: 'none',
              color: 'var(--palette-error, #d32f2f)',
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Derive a stable string ID for a row. Prefers an `id` field, then the first field value. */
function rowId(row: Record<string, unknown>, fields: FieldConfig[]): string {
  if (row.id !== undefined && row.id !== null) return String(row.id);
  const firstKey = fields[0]?.key;
  return firstKey ? String(row[firstKey] ?? '') : '';
}

export const BoardDisplay: React.FC<BoardDisplayProps> = ({
  data, fields, onRowClick, rowActions, onRowAction, groupBy, renderItem, onCardMove,
}) => {
  // Track which column is the current drag-over target for visual feedback
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Keyboard navigation state (KB-18)
  const [selectedCol, setSelectedCol] = useState<number>(-1);
  const [selectedCard, setSelectedCard] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
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

  // ── Keyboard navigation (KB-18) ───────────────────────────────────
  // Stable refs so the event listener does not need to be re-registered
  // on every render.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onRowClickRef = useRef(onRowClick);
  onRowClickRef.current = onRowClick;
  const onCardMoveRef = useRef(onCardMove);
  onCardMoveRef.current = onCardMove;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const handleNav = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail;
      const cols = columnsRef.current;

      setSelectedCol(prevCol => {
        const colCount = cols.length;
        if (colCount === 0) return prevCol;
        switch (action) {
          case 'board-col-prev':
            return prevCol <= 0 ? 0 : prevCol - 1;
          case 'board-col-next':
            return Math.min(colCount - 1, prevCol < 0 ? 0 : prevCol + 1);
          default:
            return prevCol;
        }
      });

      setSelectedCard(prevCard => {
        const colIdx = selectedCol >= 0 ? selectedCol : 0;
        const col = cols[colIdx];
        const cardCount = col?.rows.length ?? 0;
        switch (action) {
          case 'board-card-prev':
            return prevCard <= 0 ? 0 : prevCard - 1;
          case 'board-card-next':
            return Math.min(cardCount - 1, prevCard < 0 ? 0 : prevCard + 1);
          case 'board-card-activate': {
            const row = col?.rows[prevCard >= 0 ? prevCard : 0];
            if (row) onRowClickRef.current?.(row);
            return prevCard;
          }
          case 'board-card-move-right': {
            const colIdx2 = selectedCol >= 0 ? selectedCol : 0;
            const col2 = cols[colIdx2];
            const nextCol = cols[colIdx2 + 1];
            if (!col2 || !nextCol) return prevCard;
            const row = col2.rows[prevCard >= 0 ? prevCard : 0];
            if (!row || !onCardMoveRef.current) return prevCard;
            onCardMoveRef.current(rowId(row, []), nextCol.key);
            return prevCard;
          }
          default:
            return prevCard;
        }
      });
    };

    el.addEventListener('clef:display-nav', handleNav);
    return () => el.removeEventListener('clef:display-nav', handleNav);
  }, [selectedCol]); // selectedCol in dep array so board-card-* reads correct column

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
    <div
      ref={rootRef}
      data-keybinding-scope="app.display.board"
      tabIndex={0}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 'var(--spacing-md)',
        overflowX: 'auto',
        padding: 'var(--spacing-sm)',
        minHeight: 200,
      }}
    >
      {columns.map((col, colIdx) => (
        <div
          key={col.key}
          data-selected-col={selectedCol === colIdx ? 'true' : undefined}
          data-drag-over={dragOverCol === col.key ? 'true' : undefined}
          onDragOver={onCardMove ? (e) => {
            e.preventDefault();
            setDragOverCol(col.key);
          } : undefined}
          onDragLeave={onCardMove ? (e) => {
            // Only clear when leaving the column entirely (not entering a child element)
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragOverCol(null);
            }
          } : undefined}
          onDrop={onCardMove ? (e) => {
            e.preventDefault();
            setDragOverCol(null);
            const id = e.dataTransfer.getData('text/plain');
            if (id) onCardMove(id, col.key);
          } : undefined}
          style={{
            minWidth: 220,
            maxWidth: 320,
            flex: '1 0 220px',
            background: dragOverCol === col.key
              ? 'var(--palette-primary-container, rgba(var(--palette-primary-rgb, 103,80,164), 0.12))'
              : 'var(--palette-surface-variant)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            outline: dragOverCol === col.key
              ? '2px dashed var(--palette-primary, #6750A4)'
              : 'none',
            transition: 'background 0.15s, outline 0.15s',
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
                data-selected={selectedCol === colIdx && selectedCard === i ? 'true' : undefined}
                aria-selected={selectedCol === colIdx && selectedCard === i}
                draggable={onCardMove ? true : false}
                onDragStart={onCardMove ? (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', rowId(row, fields));
                } : undefined}
                onDragEnd={onCardMove ? () => setDragOverCol(null) : undefined}
                onClick={() => onRowClick?.(row)}
                title={!onCardMove ? 'Drag-to-move is not configured for this view' : undefined}
                style={{
                  background: 'var(--palette-surface)',
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--spacing-sm)',
                  cursor: onCardMove ? 'grab' : onRowClick ? 'pointer' : 'default',
                  transition: 'box-shadow 0.15s, opacity 0.15s',
                  opacity: onCardMove ? 1 : 0.85,
                }}
                onMouseEnter={e => {
                  if (onRowClick || onCardMove) {
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
                  <BoardCardActionButtons
                    row={row}
                    rowActions={rowActions}
                    onRowAction={onRowAction}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Visual indicator shown when drag-to-move is not wired up */}
      {!onCardMove && (
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          fontSize: '10px',
          color: 'var(--palette-on-surface-variant)',
          opacity: 0.45,
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          drag-to-move not available
        </div>
      )}
    </div>
  );
};

export default BoardDisplay;
