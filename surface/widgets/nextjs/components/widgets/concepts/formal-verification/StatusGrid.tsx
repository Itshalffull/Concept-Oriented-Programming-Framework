import type { HTMLAttributes } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';

export interface StatusGridItem {
  id: string;
  name: string;
  status: CellStatus;
  duration?: number;
}

export type StatusFilterValue = 'all' | 'passed' | 'failed';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  running: '#3b82f6',
  pending: '#9ca3af',
  timeout: '#f97316',
};

const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  pending: 'Pending',
  timeout: 'Timeout',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StatusGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: StatusGridItem[];
  columns?: number;
  showAggregates?: boolean;
  variant?: 'compact' | 'expanded';
  filterStatus?: StatusFilterValue;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function StatusGrid({
  items,
  columns = 4,
  showAggregates = true,
  variant = 'expanded',
  filterStatus = 'all',
  ...rest
}: StatusGridProps) {
  const filteredItems = filterStatus === 'all'
    ? items
    : items.filter((item) => item.status === filterStatus);

  const totalCells = filteredItems.length;
  const actualCols = Math.min(columns, totalCells);
  const totalRows = Math.ceil(totalCells / actualCols) || 1;
  const isCompact = variant === 'compact';

  // Summary counts
  const counts: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
  for (const item of items) counts[item.status]++;

  const summaryParts: string[] = [];
  if (counts.passed > 0) summaryParts.push(`${counts.passed} passed`);
  if (counts.failed > 0) summaryParts.push(`${counts.failed} failed`);
  if (counts.running > 0) summaryParts.push(`${counts.running} running`);
  if (counts.pending > 0) summaryParts.push(`${counts.pending} pending`);
  if (counts.timeout > 0) summaryParts.push(`${counts.timeout} timeout`);
  const summaryText = summaryParts.join(', ');

  return (
    <div
      role="grid"
      aria-label="Verification status matrix"
      aria-rowcount={totalRows}
      aria-colcount={actualCols}
      data-surface-widget=""
      data-widget-name="status-grid"
      data-part="root"
      data-state="idle"
      data-variant={variant}
      tabIndex={-1}
      {...rest}
    >
      {/* Summary bar */}
      {showAggregates && (
        <div
          data-part="aggregate-row"
          data-state="idle"
          data-visible="true"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            fontSize: isCompact ? '12px' : '14px',
          }}
        >
          <span data-part="summary-text">{summaryText}</span>
        </div>
      )}

      {/* Filter buttons */}
      <div
        data-part="filter-bar"
        data-state="idle"
        role="toolbar"
        aria-label="Filter verification results"
        style={{ display: 'flex', gap: '4px', padding: '4px 0' }}
      >
        {(['all', 'passed', 'failed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            data-part="filter-button"
            data-active={filterStatus === value ? 'true' : 'false'}
            aria-pressed={filterStatus === value}
            style={{
              padding: isCompact ? '2px 8px' : '4px 12px',
              border: '1px solid',
              borderColor: filterStatus === value ? '#6366f1' : '#d1d5db',
              borderRadius: '4px',
              background: filterStatus === value ? '#eef2ff' : 'transparent',
              cursor: 'pointer',
              fontSize: isCompact ? '11px' : '13px',
              fontWeight: filterStatus === value ? 600 : 400,
            }}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid of cells */}
      <div
        data-part="grid"
        data-state="idle"
        role="rowgroup"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${actualCols}, 1fr)`,
          gap: isCompact ? '2px' : '4px',
          padding: '4px 0',
        }}
      >
        {filteredItems.map((item, index) => {
          const row = Math.floor(index / actualCols);
          const col = index % actualCols;
          const statusColor = STATUS_COLORS[item.status];

          return (
            <div
              key={item.id}
              role="gridcell"
              aria-rowindex={row + 1}
              aria-colindex={col + 1}
              aria-label={`${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`}
              aria-selected={false}
              data-part="cell"
              data-state="idle"
              data-status={item.status}
              data-selected="false"
              data-hovered="false"
              tabIndex={-1}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isCompact ? 'center' : 'flex-start',
                justifyContent: 'center',
                padding: isCompact ? '4px' : '8px 12px',
                borderRadius: '4px',
                border: '2px solid transparent',
                cursor: 'pointer',
                minHeight: isCompact ? '32px' : '48px',
              }}
            >
              {/* Status indicator */}
              <div
                data-part="cell-indicator"
                data-status={item.status}
                aria-hidden="true"
                style={{
                  width: isCompact ? '10px' : '14px',
                  height: isCompact ? '10px' : '14px',
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  marginBottom: isCompact ? '2px' : '4px',
                  flexShrink: 0,
                }}
              />

              {/* Property name */}
              <span
                data-part="cell-label"
                style={{
                  fontSize: isCompact ? '10px' : '12px',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {item.name}
              </span>

              {/* Duration */}
              {!isCompact && item.duration != null && (
                <span
                  data-part="cell-duration"
                  style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}
                >
                  {formatDuration(item.duration)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Column aggregate placeholder */}
      {showAggregates && (
        <div data-part="aggregate-col" data-state="idle" data-visible="true" aria-hidden="true" />
      )}
    </div>
  );
}

export { StatusGrid };
