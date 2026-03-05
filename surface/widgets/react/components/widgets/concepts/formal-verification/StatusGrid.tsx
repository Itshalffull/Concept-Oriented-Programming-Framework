/* ---------------------------------------------------------------------------
 * StatusGrid state machine
 * States: idle (initial), cellHovered, cellSelected
 * ------------------------------------------------------------------------- */

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL'; row: number; col: number }
  | { type: 'CLICK_CELL'; row: number; col: number }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' }
  | { type: 'FOCUS_NEXT_COL' }
  | { type: 'FOCUS_PREV_COL' }
  | { type: 'FOCUS_NEXT_ROW' }
  | { type: 'FOCUS_PREV_ROW' };

export function statusGridReducer(state: StatusGridState, event: StatusGridEvent): StatusGridState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_CELL') return 'cellHovered';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'cellHovered':
      if (event.type === 'LEAVE_CELL') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Imports
 * ------------------------------------------------------------------------- */

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';

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

export interface StatusGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Items to display in the grid. */
  items: StatusGridItem[];
  /** Number of columns in the grid layout. */
  columns?: number;
  /** Whether to show the summary bar. */
  showAggregates?: boolean;
  /** Visual variant. */
  variant?: 'compact' | 'expanded';
  /** Called when a cell is selected. */
  onCellSelect?: (item: StatusGridItem) => void;
  /** Initial filter value. */
  filterStatus?: StatusFilterValue;
}

/* ---------------------------------------------------------------------------
 * Status color mapping
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

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const StatusGrid = forwardRef<HTMLDivElement, StatusGridProps>(
  function StatusGrid(
    {
      items,
      columns = 4,
      showAggregates = true,
      variant = 'expanded',
      onCellSelect,
      filterStatus: initialFilter = 'all',
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(statusGridReducer, 'idle');
    const [filter, setFilter] = useState<StatusFilterValue>(initialFilter);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

    /* -- Filtered items --------------------------------------------------- */
    const filteredItems = useMemo(() => {
      if (filter === 'all') return items;
      return items.filter((item) => item.status === filter);
    }, [items, filter]);

    const totalCells = filteredItems.length;
    const actualCols = Math.min(columns, totalCells);
    const totalRows = Math.ceil(totalCells / actualCols) || 1;

    /* -- Summary counts --------------------------------------------------- */
    const counts = useMemo(() => {
      const c: Record<CellStatus, number> = {
        passed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        timeout: 0,
      };
      for (const item of items) {
        c[item.status]++;
      }
      return c;
    }, [items]);

    const summaryText = useMemo(() => {
      const parts: string[] = [];
      if (counts.passed > 0) parts.push(`${counts.passed} passed`);
      if (counts.failed > 0) parts.push(`${counts.failed} failed`);
      if (counts.running > 0) parts.push(`${counts.running} running`);
      if (counts.pending > 0) parts.push(`${counts.pending} pending`);
      if (counts.timeout > 0) parts.push(`${counts.timeout} timeout`);
      return parts.join(', ');
    }, [counts]);

    /* -- Selected item for detail panel ----------------------------------- */
    const selectedItem = selectedIndex != null ? filteredItems[selectedIndex] : null;

    /* -- Focus management ------------------------------------------------- */
    const focusCell = useCallback(
      (index: number) => {
        const clamped = clamp(index, 0, totalCells - 1);
        setFocusIndex(clamped);
        cellRefs.current[clamped]?.focus();
      },
      [totalCells],
    );

    /* -- Filter handler --------------------------------------------------- */
    const handleFilterClick = useCallback(
      (value: StatusFilterValue) => {
        setFilter(value);
        setSelectedIndex(null);
        setHoveredIndex(null);
        setFocusIndex(0);
        send({ type: 'FILTER', row: 0, col: 0 } as StatusGridEvent);
      },
      [],
    );

    /* -- Cell event handlers ---------------------------------------------- */
    const handleCellMouseEnter = useCallback(
      (index: number) => {
        const row = Math.floor(index / actualCols);
        const col = index % actualCols;
        setHoveredIndex(index);
        send({ type: 'HOVER_CELL', row, col });
      },
      [actualCols],
    );

    const handleCellMouseLeave = useCallback(() => {
      setHoveredIndex(null);
      send({ type: 'LEAVE_CELL' } as StatusGridEvent);
    }, []);

    const handleCellClick = useCallback(
      (index: number) => {
        const row = Math.floor(index / actualCols);
        const col = index % actualCols;
        setSelectedIndex(index);
        setFocusIndex(index);
        send({ type: 'CLICK_CELL', row, col });
        if (filteredItems[index]) {
          onCellSelect?.(filteredItems[index]);
        }
      },
      [actualCols, filteredItems, onCellSelect],
    );

    /* -- Keyboard navigation ---------------------------------------------- */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (totalCells === 0) return;
        let nextIndex = focusIndex;

        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            nextIndex = focusIndex + 1;
            break;
          case 'ArrowLeft':
            e.preventDefault();
            nextIndex = focusIndex - 1;
            break;
          case 'ArrowDown':
            e.preventDefault();
            nextIndex = focusIndex + actualCols;
            break;
          case 'ArrowUp':
            e.preventDefault();
            nextIndex = focusIndex - actualCols;
            break;
          case 'Enter': {
            e.preventDefault();
            const row = Math.floor(focusIndex / actualCols);
            const col = focusIndex % actualCols;
            setSelectedIndex(focusIndex);
            send({ type: 'CLICK_CELL', row, col });
            if (filteredItems[focusIndex]) {
              onCellSelect?.(filteredItems[focusIndex]);
            }
            return;
          }
          case 'Escape':
            e.preventDefault();
            setSelectedIndex(null);
            send({ type: 'DESELECT' } as StatusGridEvent);
            return;
          default:
            return;
        }

        focusCell(nextIndex);
      },
      [focusIndex, actualCols, totalCells, filteredItems, onCellSelect, focusCell],
    );

    /* -- Render ----------------------------------------------------------- */
    const isCompact = variant === 'compact';

    return (
      <div
        ref={ref}
        role="grid"
        aria-label="Verification status matrix"
        aria-rowcount={totalRows}
        aria-colcount={actualCols}
        data-surface-widget=""
        data-widget-name="status-grid"
        data-part="root"
        data-state={state}
        data-variant={variant}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {/* Summary bar */}
        {showAggregates && (
          <div
            data-part="aggregate-row"
            data-state={state}
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
          data-state={state}
          role="toolbar"
          aria-label="Filter verification results"
          style={{
            display: 'flex',
            gap: '4px',
            padding: '4px 0',
          }}
        >
          {(['all', 'passed', 'failed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              data-part="filter-button"
              data-active={filter === value ? 'true' : 'false'}
              aria-pressed={filter === value}
              onClick={() => handleFilterClick(value)}
              style={{
                padding: isCompact ? '2px 8px' : '4px 12px',
                border: '1px solid',
                borderColor: filter === value ? '#6366f1' : '#d1d5db',
                borderRadius: '4px',
                background: filter === value ? '#eef2ff' : 'transparent',
                cursor: 'pointer',
                fontSize: isCompact ? '11px' : '13px',
                fontWeight: filter === value ? 600 : 400,
              }}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        {/* Grid of cells */}
        <div
          data-part="grid"
          data-state={state}
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
            const isHovered = hoveredIndex === index;
            const isSelected = selectedIndex === index;
            const isFocused = focusIndex === index;
            const statusColor = STATUS_COLORS[item.status];
            const isRunning = item.status === 'running';

            return (
              <div
                key={item.id}
                ref={(el) => {
                  cellRefs.current[index] = el;
                }}
                role="gridcell"
                aria-rowindex={row + 1}
                aria-colindex={col + 1}
                aria-label={`${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`}
                aria-selected={isSelected}
                data-part="cell"
                data-state={state}
                data-status={item.status}
                data-selected={isSelected ? 'true' : 'false'}
                data-hovered={isHovered ? 'true' : 'false'}
                tabIndex={isFocused ? 0 : -1}
                onMouseEnter={() => handleCellMouseEnter(index)}
                onMouseLeave={handleCellMouseLeave}
                onClick={() => handleCellClick(index)}
                onFocus={() => setFocusIndex(index)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isCompact ? 'center' : 'flex-start',
                  justifyContent: 'center',
                  padding: isCompact ? '4px' : '8px 12px',
                  borderRadius: '4px',
                  border: `2px solid ${isSelected ? '#6366f1' : isHovered ? '#a5b4fc' : 'transparent'}`,
                  cursor: 'pointer',
                  background: isHovered ? '#f5f5f5' : 'transparent',
                  outline: 'none',
                  minHeight: isCompact ? '32px' : '48px',
                  transition: 'border-color 0.15s, background 0.15s',
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
                    ...(isRunning
                      ? {
                          animation: 'statusgrid-pulse 1.2s ease-in-out infinite',
                        }
                      : {}),
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

                {/* Duration (expanded only) */}
                {!isCompact && item.duration != null && (
                  <span
                    data-part="cell-duration"
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginTop: '2px',
                    }}
                  >
                    {formatDuration(item.duration)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tooltip for hovered cell */}
        {state === 'cellHovered' && hoveredIndex != null && filteredItems[hoveredIndex] && (
          <div
            role="tooltip"
            data-part="cell-tooltip"
            data-state={state}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              background: '#1f2937',
              color: '#f9fafb',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}
          >
            <strong>{filteredItems[hoveredIndex].name}</strong>
            {' \u2014 '}
            {STATUS_LABELS[filteredItems[hoveredIndex].status]}
            {filteredItems[hoveredIndex].duration != null &&
              ` (${formatDuration(filteredItems[hoveredIndex].duration!)})`}
          </div>
        )}

        {/* Detail panel for selected cell */}
        {state === 'cellSelected' && selectedItem && (
          <div
            data-part="cell-detail"
            data-state={state}
            role="region"
            aria-label={`Details for ${selectedItem.name}`}
            style={{
              padding: '12px',
              marginTop: '8px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedItem.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: STATUS_COLORS[selectedItem.status],
                }}
              />
              <span>Status: {STATUS_LABELS[selectedItem.status]}</span>
            </div>
            {selectedItem.duration != null && (
              <div style={{ color: '#6b7280' }}>
                Duration: {formatDuration(selectedItem.duration)}
              </div>
            )}
          </div>
        )}

        {/* Column aggregate (right side, hidden by default if no aggregates) */}
        {showAggregates && (
          <div
            data-part="aggregate-col"
            data-state={state}
            data-visible="true"
            aria-hidden="true"
          />
        )}

        {/* Pulse animation for running status */}
        <style>{`
          @keyframes statusgrid-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  },
);

StatusGrid.displayName = 'StatusGrid';
export { StatusGrid };
export default StatusGrid;
