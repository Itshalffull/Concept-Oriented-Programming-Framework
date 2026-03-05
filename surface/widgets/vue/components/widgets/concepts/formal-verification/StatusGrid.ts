import { defineComponent, h, ref, computed } from 'vue';

/* ---------------------------------------------------------------------------
 * StatusGrid state machine
 * ------------------------------------------------------------------------- */

export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL'; row: number; col: number }
  | { type: 'CLICK_CELL'; row: number; col: number }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' };

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
 * Types & Helpers
 * ------------------------------------------------------------------------- */

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';
export type StatusFilterValue = 'all' | 'passed' | 'failed';

export interface StatusGridItem {
  id: string;
  name: string;
  status: CellStatus;
  duration?: number;
}

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: '#22c55e', failed: '#ef4444', running: '#3b82f6', pending: '#9ca3af', timeout: '#f97316',
};

const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed', failed: 'Failed', running: 'Running', pending: 'Pending', timeout: 'Timeout',
};

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

export const StatusGrid = defineComponent({
  name: 'StatusGrid',
  props: {
    items: { type: Array as () => StatusGridItem[], required: true },
    columns: { type: Number, default: 4 },
    showAggregates: { type: Boolean, default: true },
    variant: { type: String as () => 'compact' | 'expanded', default: 'expanded' },
    filterStatus: { type: String as () => StatusFilterValue, default: 'all' },
  },
  emits: ['cellSelect'],
  setup(props, { emit }) {
    const state = ref<StatusGridState>('idle');
    const send = (event: StatusGridEvent) => { state.value = statusGridReducer(state.value, event); };

    const filter = ref<StatusFilterValue>(props.filterStatus as StatusFilterValue);
    const hoveredIndex = ref<number | null>(null);
    const selectedIndex = ref<number | null>(null);
    const focusIndex = ref(0);

    const filteredItems = computed(() => {
      if (filter.value === 'all') return props.items;
      return props.items.filter((item) => item.status === filter.value);
    });

    const totalCells = computed(() => filteredItems.value.length);
    const actualCols = computed(() => Math.min(props.columns, totalCells.value));
    const totalRows = computed(() => Math.ceil(totalCells.value / actualCols.value) || 1);

    const counts = computed(() => {
      const c: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
      for (const item of props.items) c[item.status]++;
      return c;
    });

    const summaryText = computed(() => {
      const parts: string[] = [];
      if (counts.value.passed > 0) parts.push(`${counts.value.passed} passed`);
      if (counts.value.failed > 0) parts.push(`${counts.value.failed} failed`);
      if (counts.value.running > 0) parts.push(`${counts.value.running} running`);
      if (counts.value.pending > 0) parts.push(`${counts.value.pending} pending`);
      if (counts.value.timeout > 0) parts.push(`${counts.value.timeout} timeout`);
      return parts.join(', ');
    });

    const selectedItem = computed(() => selectedIndex.value != null ? filteredItems.value[selectedIndex.value] : null);
    const isCompact = computed(() => props.variant === 'compact');

    const handleFilterClick = (value: StatusFilterValue) => {
      filter.value = value;
      selectedIndex.value = null;
      hoveredIndex.value = null;
      focusIndex.value = 0;
      send({ type: 'FILTER' } as StatusGridEvent);
    };

    const handleCellMouseEnter = (index: number) => {
      const row = Math.floor(index / actualCols.value);
      const col = index % actualCols.value;
      hoveredIndex.value = index;
      send({ type: 'HOVER_CELL', row, col });
    };

    const handleCellMouseLeave = () => {
      hoveredIndex.value = null;
      send({ type: 'LEAVE_CELL' } as StatusGridEvent);
    };

    const handleCellClick = (index: number) => {
      const row = Math.floor(index / actualCols.value);
      const col = index % actualCols.value;
      selectedIndex.value = index;
      focusIndex.value = index;
      send({ type: 'CLICK_CELL', row, col });
      if (filteredItems.value[index]) emit('cellSelect', filteredItems.value[index]);
    };

    const focusCell = (index: number) => {
      focusIndex.value = clamp(index, 0, totalCells.value - 1);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (totalCells.value === 0) return;
      let nextIndex = focusIndex.value;
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); nextIndex = focusIndex.value + 1; break;
        case 'ArrowLeft': e.preventDefault(); nextIndex = focusIndex.value - 1; break;
        case 'ArrowDown': e.preventDefault(); nextIndex = focusIndex.value + actualCols.value; break;
        case 'ArrowUp': e.preventDefault(); nextIndex = focusIndex.value - actualCols.value; break;
        case 'Enter': {
          e.preventDefault();
          const row = Math.floor(focusIndex.value / actualCols.value);
          const col = focusIndex.value % actualCols.value;
          selectedIndex.value = focusIndex.value;
          send({ type: 'CLICK_CELL', row, col });
          if (filteredItems.value[focusIndex.value]) emit('cellSelect', filteredItems.value[focusIndex.value]);
          return;
        }
        case 'Escape': e.preventDefault(); selectedIndex.value = null; send({ type: 'DESELECT' } as StatusGridEvent); return;
        default: return;
      }
      focusCell(nextIndex);
    };

    return () => h('div', {
      role: 'grid', 'aria-label': 'Verification status matrix',
      'aria-rowcount': totalRows.value, 'aria-colcount': actualCols.value,
      'data-surface-widget': '', 'data-widget-name': 'status-grid',
      'data-part': 'root', 'data-state': state.value, 'data-variant': props.variant,
      tabindex: -1, onKeydown: handleKeyDown,
    }, [
      // Summary bar
      props.showAggregates
        ? h('div', {
            'data-part': 'aggregate-row', 'data-state': state.value, 'data-visible': 'true',
            'aria-live': 'polite',
            style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', fontSize: isCompact.value ? '12px' : '14px' },
          }, [h('span', { 'data-part': 'summary-text' }, summaryText.value)])
        : null,
      // Filter buttons
      h('div', {
        'data-part': 'filter-bar', 'data-state': state.value, role: 'toolbar',
        'aria-label': 'Filter verification results',
        style: { display: 'flex', gap: '4px', padding: '4px 0' },
      }, (['all', 'passed', 'failed'] as const).map((value) =>
        h('button', {
          key: value, type: 'button', 'data-part': 'filter-button',
          'data-active': filter.value === value ? 'true' : 'false',
          'aria-pressed': filter.value === value,
          onClick: () => handleFilterClick(value),
          style: {
            padding: isCompact.value ? '2px 8px' : '4px 12px',
            border: '1px solid', borderColor: filter.value === value ? '#6366f1' : '#d1d5db',
            borderRadius: '4px', background: filter.value === value ? '#eef2ff' : 'transparent',
            cursor: 'pointer', fontSize: isCompact.value ? '11px' : '13px',
            fontWeight: filter.value === value ? '600' : '400',
          },
        }, value.charAt(0).toUpperCase() + value.slice(1)),
      )),
      // Grid of cells
      h('div', {
        'data-part': 'grid', 'data-state': state.value, role: 'rowgroup',
        style: {
          display: 'grid', gridTemplateColumns: `repeat(${actualCols.value}, 1fr)`,
          gap: isCompact.value ? '2px' : '4px', padding: '4px 0',
        },
      }, filteredItems.value.map((item, index) => {
        const row = Math.floor(index / actualCols.value);
        const col = index % actualCols.value;
        const isHovered = hoveredIndex.value === index;
        const isSelected = selectedIndex.value === index;
        const isFocused = focusIndex.value === index;
        const statusColor = STATUS_COLORS[item.status];
        const isRunning = item.status === 'running';

        return h('div', {
          key: item.id, role: 'gridcell',
          'aria-rowindex': row + 1, 'aria-colindex': col + 1,
          'aria-label': `${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`,
          'aria-selected': isSelected,
          'data-part': 'cell', 'data-state': state.value, 'data-status': item.status,
          'data-selected': isSelected ? 'true' : 'false',
          'data-hovered': isHovered ? 'true' : 'false',
          tabindex: isFocused ? 0 : -1,
          onMouseenter: () => handleCellMouseEnter(index),
          onMouseleave: handleCellMouseLeave,
          onClick: () => handleCellClick(index),
          onFocus: () => { focusIndex.value = index; },
          style: {
            display: 'flex', flexDirection: 'column',
            alignItems: isCompact.value ? 'center' : 'flex-start',
            justifyContent: 'center',
            padding: isCompact.value ? '4px' : '8px 12px',
            borderRadius: '4px',
            border: `2px solid ${isSelected ? '#6366f1' : isHovered ? '#a5b4fc' : 'transparent'}`,
            cursor: 'pointer', background: isHovered ? '#f5f5f5' : 'transparent',
            outline: 'none', minHeight: isCompact.value ? '32px' : '48px',
            transition: 'border-color 0.15s, background 0.15s',
          },
        }, [
          h('div', {
            'data-part': 'cell-indicator', 'data-status': item.status, 'aria-hidden': 'true',
            style: {
              width: isCompact.value ? '10px' : '14px', height: isCompact.value ? '10px' : '14px',
              borderRadius: '50%', backgroundColor: statusColor,
              marginBottom: isCompact.value ? '2px' : '4px', flexShrink: '0',
              ...(isRunning ? { animation: 'statusgrid-pulse 1.2s ease-in-out infinite' } : {}),
            },
          }),
          h('span', {
            'data-part': 'cell-label',
            style: { fontSize: isCompact.value ? '10px' : '12px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' },
          }, item.name),
          !isCompact.value && item.duration != null
            ? h('span', { 'data-part': 'cell-duration', style: { fontSize: '11px', color: '#6b7280', marginTop: '2px' } }, formatDuration(item.duration))
            : null,
        ]);
      })),
      // Tooltip
      state.value === 'cellHovered' && hoveredIndex.value != null && filteredItems.value[hoveredIndex.value]
        ? h('div', {
            role: 'tooltip', 'data-part': 'cell-tooltip', 'data-state': state.value,
            style: { padding: '6px 10px', fontSize: '12px', background: '#1f2937', color: '#f9fafb', borderRadius: '4px', pointerEvents: 'none' },
          }, [
            h('strong', null, filteredItems.value[hoveredIndex.value].name),
            ` \u2014 ${STATUS_LABELS[filteredItems.value[hoveredIndex.value].status]}`,
            filteredItems.value[hoveredIndex.value].duration != null
              ? ` (${formatDuration(filteredItems.value[hoveredIndex.value].duration!)})`
              : '',
          ])
        : null,
      // Detail panel
      state.value === 'cellSelected' && selectedItem.value
        ? h('div', {
            'data-part': 'cell-detail', 'data-state': state.value, role: 'region',
            'aria-label': `Details for ${selectedItem.value.name}`,
            style: { padding: '12px', marginTop: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' },
          }, [
            h('div', { style: { fontWeight: '600', marginBottom: '4px' } }, selectedItem.value.name),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' } }, [
              h('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: STATUS_COLORS[selectedItem.value.status] } }),
              h('span', null, `Status: ${STATUS_LABELS[selectedItem.value.status]}`),
            ]),
            selectedItem.value.duration != null
              ? h('div', { style: { color: '#6b7280' } }, `Duration: ${formatDuration(selectedItem.value.duration)}`)
              : null,
          ])
        : null,
      // Column aggregate placeholder
      props.showAggregates
        ? h('div', { 'data-part': 'aggregate-col', 'data-state': state.value, 'data-visible': 'true', 'aria-hidden': 'true' })
        : null,
      // Pulse animation style
      h('style', null, `@keyframes statusgrid-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`),
    ]);
  },
});

export default StatusGrid;
