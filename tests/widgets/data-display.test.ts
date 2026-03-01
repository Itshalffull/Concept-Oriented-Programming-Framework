import { describe, it, expect } from 'vitest';

import {
  calendarViewReducer,
  isSameDay,
  getMonthGrid,
  formatDate,
  type CalendarViewState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/CalendarView.reducer.js';

import {
  cardReducer,
  cardInitialState,
  type CardState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/Card.reducer.js';

import {
  cardGridReducer,
  cardGridInitialState,
  type CardGridState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/CardGrid.reducer.js';

import {
  chartReducer,
  chartInitialState,
  type ChartState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/Chart.reducer.js';

import {
  dataListReducer,
  dataListInitialState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/DataList.reducer.js';

import {
  dataTableReducer,
  type DataTableState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/DataTable.reducer.js';

import {
  emptyStateReducer,
  emptyStateInitialState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/EmptyState.reducer.js';

import {
  gaugeReducer,
  gaugeInitialState,
  getThresholdLevel,
  getThresholdColor,
  type GaugeState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/Gauge.reducer.js';

import {
  kanbanBoardReducer,
  kanbanBoardInitialState,
  type KanbanBoardState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/KanbanBoard.reducer.js';

import {
  createListReducer,
  type ListState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/List.reducer.js';

import {
  notificationItemReducer,
  type NotificationItemState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/NotificationItem.reducer.js';

import {
  skeletonReducer,
  skeletonInitialState,
  type SkeletonState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/Skeleton.reducer.js';

import {
  statCardReducer,
  statCardInitialState,
  type StatCardState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/StatCard.reducer.js';

import {
  timelineReducer,
  timelineInitialState,
  type TimelineState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/Timeline.reducer.js';

import {
  createViewToggleReducer,
  type ViewToggleState,
} from '../../surface/widgets/nextjs/components/widgets/data-display/ViewToggle.reducer.js';

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------
describe('CalendarView', () => {
  describe('calendarViewReducer', () => {
    // Use explicit year/month/day constructor to avoid timezone issues
    const base: CalendarViewState = {
      current: 'monthView',
      focusedDate: new Date(2025, 5, 15), // June 15, 2025
      displayDate: new Date(2025, 5, 1),  // June 1, 2025
    };

    it('defaults to returning the same state for unknown actions', () => {
      const result = calendarViewReducer(base, { type: 'UNKNOWN' } as any);
      expect(result).toBe(base);
    });

    // NAVIGATE_PREV
    it('NAVIGATE_PREV in monthView moves displayDate back one month', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_PREV' });
      expect(result.current).toBe('navigating');
      expect(result.displayDate.getMonth()).toBe(4); // May (0-indexed)
    });

    it('NAVIGATE_PREV in weekView moves displayDate back 7 days', () => {
      const weekState: CalendarViewState = { ...base, current: 'weekView' };
      const result = calendarViewReducer(weekState, { type: 'NAVIGATE_PREV' });
      expect(result.current).toBe('navigating');
      // June 1 - 7 = May 25
      const expected = new Date(2025, 4, 25);
      expect(result.displayDate.getDate()).toBe(expected.getDate());
    });

    it('NAVIGATE_PREV in navigating state treats as monthView navigation', () => {
      const navState: CalendarViewState = { ...base, current: 'navigating' };
      const result = calendarViewReducer(navState, { type: 'NAVIGATE_PREV' });
      expect(result.current).toBe('navigating');
      expect(result.displayDate.getMonth()).toBe(4);
    });

    // NAVIGATE_NEXT
    it('NAVIGATE_NEXT in monthView moves displayDate forward one month', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_NEXT' });
      expect(result.current).toBe('navigating');
      expect(result.displayDate.getMonth()).toBe(6); // July
    });

    it('NAVIGATE_NEXT in weekView moves displayDate forward 7 days', () => {
      const weekState: CalendarViewState = { ...base, current: 'weekView' };
      const result = calendarViewReducer(weekState, { type: 'NAVIGATE_NEXT' });
      expect(result.current).toBe('navigating');
      // June 1 + 7 = June 8
      const expected = new Date(2025, 5, 8);
      expect(result.displayDate.getDate()).toBe(expected.getDate());
    });

    // NAVIGATE_COMPLETE / NAVIGATE_COMPLETE_WEEK
    it('NAVIGATE_COMPLETE transitions to monthView', () => {
      const navState: CalendarViewState = { ...base, current: 'navigating' };
      const result = calendarViewReducer(navState, { type: 'NAVIGATE_COMPLETE' });
      expect(result.current).toBe('monthView');
    });

    it('NAVIGATE_COMPLETE_WEEK transitions to weekView', () => {
      const navState: CalendarViewState = { ...base, current: 'navigating' };
      const result = calendarViewReducer(navState, { type: 'NAVIGATE_COMPLETE_WEEK' });
      expect(result.current).toBe('weekView');
    });

    // SWITCH_MONTH / SWITCH_WEEK
    it('SWITCH_MONTH sets current to monthView', () => {
      const weekState: CalendarViewState = { ...base, current: 'weekView' };
      const result = calendarViewReducer(weekState, { type: 'SWITCH_MONTH' });
      expect(result.current).toBe('monthView');
    });

    it('SWITCH_WEEK sets current to weekView', () => {
      const result = calendarViewReducer(base, { type: 'SWITCH_WEEK' });
      expect(result.current).toBe('weekView');
    });

    // SELECT_DATE / FOCUS_DATE
    it('SELECT_DATE updates focusedDate', () => {
      const newDate = new Date('2025-06-20');
      const result = calendarViewReducer(base, { type: 'SELECT_DATE', date: newDate });
      expect(result.focusedDate).toBe(newDate);
    });

    it('FOCUS_DATE updates focusedDate', () => {
      const newDate = new Date('2025-06-22');
      const result = calendarViewReducer(base, { type: 'FOCUS_DATE', date: newDate });
      expect(result.focusedDate).toBe(newDate);
    });

    // NAVIGATE_DAY
    it('NAVIGATE_DAY moves focusedDate by offset days', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_DAY', offset: 3 });
      expect(result.focusedDate.getDate()).toBe(18);
    });

    it('NAVIGATE_DAY with negative offset moves backwards', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_DAY', offset: -5 });
      expect(result.focusedDate.getDate()).toBe(10);
    });

    // NAVIGATE_WEEK
    it('NAVIGATE_WEEK moves focusedDate by offset * 7 days', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_WEEK', offset: 1 });
      expect(result.focusedDate.getDate()).toBe(22);
    });

    it('NAVIGATE_WEEK with negative offset goes back a week', () => {
      const result = calendarViewReducer(base, { type: 'NAVIGATE_WEEK', offset: -1 });
      expect(result.focusedDate.getDate()).toBe(8);
    });
  });

  describe('isSameDay', () => {
    it('returns true for same date', () => {
      expect(isSameDay(new Date('2025-06-15'), new Date('2025-06-15'))).toBe(true);
    });

    it('returns true for same date different times', () => {
      expect(isSameDay(new Date('2025-06-15T08:00:00'), new Date('2025-06-15T22:30:00'))).toBe(true);
    });

    it('returns false for different dates', () => {
      expect(isSameDay(new Date('2025-06-15'), new Date('2025-06-16'))).toBe(false);
    });

    it('returns false for same day different months', () => {
      expect(isSameDay(new Date('2025-06-15'), new Date('2025-07-15'))).toBe(false);
    });

    it('returns false for same day different years', () => {
      expect(isSameDay(new Date('2025-06-15'), new Date('2026-06-15'))).toBe(false);
    });
  });

  describe('getMonthGrid', () => {
    it('returns an array of week arrays', () => {
      const grid = getMonthGrid(2025, 5); // June 2025
      expect(grid.length).toBeGreaterThanOrEqual(4);
      expect(grid.length).toBeLessThanOrEqual(6);
      for (const week of grid) {
        expect(week).toHaveLength(7);
      }
    });

    it('first week starts on Sunday', () => {
      const grid = getMonthGrid(2025, 5);
      expect(grid[0][0].getDay()).toBe(0); // Sunday
    });

    it('contains the first day of the month', () => {
      const grid = getMonthGrid(2025, 5);
      const allDates = grid.flat();
      const hasFirstDay = allDates.some(
        (d) => d.getFullYear() === 2025 && d.getMonth() === 5 && d.getDate() === 1
      );
      expect(hasFirstDay).toBe(true);
    });

    it('contains the last day of the month', () => {
      const grid = getMonthGrid(2025, 5); // June has 30 days
      const allDates = grid.flat();
      const hasLastDay = allDates.some(
        (d) => d.getFullYear() === 2025 && d.getMonth() === 5 && d.getDate() === 30
      );
      expect(hasLastDay).toBe(true);
    });
  });

  describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const result = formatDate(new Date('2025-06-15T12:00:00Z'));
      expect(result).toBe('2025-06-15');
    });

    it('pads single digit months and days', () => {
      const result = formatDate(new Date('2025-01-05T12:00:00Z'));
      expect(result).toBe('2025-01-05');
    });
  });
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
describe('Card', () => {
  describe('cardReducer', () => {
    it('starts in idle state', () => {
      expect(cardInitialState.current).toBe('idle');
    });

    // From idle
    it('idle -> hovered on HOVER', () => {
      const result = cardReducer(cardInitialState, { type: 'HOVER' });
      expect(result.current).toBe('hovered');
    });

    it('idle -> focused on FOCUS', () => {
      const result = cardReducer(cardInitialState, { type: 'FOCUS' });
      expect(result.current).toBe('focused');
    });

    it('idle -> pressed on PRESS', () => {
      const result = cardReducer(cardInitialState, { type: 'PRESS' });
      expect(result.current).toBe('pressed');
    });

    it('idle ignores UNHOVER', () => {
      const result = cardReducer(cardInitialState, { type: 'UNHOVER' });
      expect(result).toBe(cardInitialState);
    });

    it('idle ignores BLUR', () => {
      const result = cardReducer(cardInitialState, { type: 'BLUR' });
      expect(result).toBe(cardInitialState);
    });

    it('idle ignores RELEASE', () => {
      const result = cardReducer(cardInitialState, { type: 'RELEASE' });
      expect(result).toBe(cardInitialState);
    });

    it('idle ignores ACTIVATE', () => {
      const result = cardReducer(cardInitialState, { type: 'ACTIVATE' });
      expect(result).toBe(cardInitialState);
    });

    // From hovered
    it('hovered -> idle on UNHOVER', () => {
      const hovered: CardState = { current: 'hovered' };
      const result = cardReducer(hovered, { type: 'UNHOVER' });
      expect(result.current).toBe('idle');
    });

    it('hovered -> pressed on PRESS', () => {
      const hovered: CardState = { current: 'hovered' };
      const result = cardReducer(hovered, { type: 'PRESS' });
      expect(result.current).toBe('pressed');
    });

    it('hovered -> focused on FOCUS', () => {
      const hovered: CardState = { current: 'hovered' };
      const result = cardReducer(hovered, { type: 'FOCUS' });
      expect(result.current).toBe('focused');
    });

    it('hovered ignores BLUR', () => {
      const hovered: CardState = { current: 'hovered' };
      const result = cardReducer(hovered, { type: 'BLUR' });
      expect(result).toBe(hovered);
    });

    // From focused
    it('focused -> idle on BLUR', () => {
      const focused: CardState = { current: 'focused' };
      const result = cardReducer(focused, { type: 'BLUR' });
      expect(result.current).toBe('idle');
    });

    it('focused -> pressed on PRESS', () => {
      const focused: CardState = { current: 'focused' };
      const result = cardReducer(focused, { type: 'PRESS' });
      expect(result.current).toBe('pressed');
    });

    it('focused ignores HOVER', () => {
      const focused: CardState = { current: 'focused' };
      const result = cardReducer(focused, { type: 'HOVER' });
      expect(result).toBe(focused);
    });

    // From pressed
    it('pressed -> idle on RELEASE', () => {
      const pressed: CardState = { current: 'pressed' };
      const result = cardReducer(pressed, { type: 'RELEASE' });
      expect(result.current).toBe('idle');
    });

    it('pressed -> idle on ACTIVATE', () => {
      const pressed: CardState = { current: 'pressed' };
      const result = cardReducer(pressed, { type: 'ACTIVATE' });
      expect(result.current).toBe('idle');
    });

    it('pressed ignores HOVER', () => {
      const pressed: CardState = { current: 'pressed' };
      const result = cardReducer(pressed, { type: 'HOVER' });
      expect(result).toBe(pressed);
    });

    it('pressed ignores FOCUS', () => {
      const pressed: CardState = { current: 'pressed' };
      const result = cardReducer(pressed, { type: 'FOCUS' });
      expect(result).toBe(pressed);
    });
  });
});

// ---------------------------------------------------------------------------
// CardGrid
// ---------------------------------------------------------------------------
describe('CardGrid', () => {
  describe('cardGridReducer', () => {
    it('starts in static state', () => {
      expect(cardGridInitialState.current).toBe('static');
    });

    // From static
    it('static -> loading on LOAD', () => {
      const result = cardGridReducer(cardGridInitialState, { type: 'LOAD' });
      expect(result.current).toBe('loading');
    });

    it('static -> empty on DATA_EMPTY', () => {
      const result = cardGridReducer(cardGridInitialState, { type: 'DATA_EMPTY' });
      expect(result.current).toBe('empty');
    });

    it('static ignores LOAD_COMPLETE', () => {
      const result = cardGridReducer(cardGridInitialState, { type: 'LOAD_COMPLETE' });
      expect(result).toBe(cardGridInitialState);
    });

    it('static ignores DATA_AVAILABLE', () => {
      const result = cardGridReducer(cardGridInitialState, { type: 'DATA_AVAILABLE' });
      expect(result).toBe(cardGridInitialState);
    });

    // From loading
    it('loading -> static on LOAD_COMPLETE', () => {
      const loading: CardGridState = { current: 'loading' };
      const result = cardGridReducer(loading, { type: 'LOAD_COMPLETE' });
      expect(result.current).toBe('static');
    });

    it('loading -> empty on LOAD_COMPLETE_EMPTY', () => {
      const loading: CardGridState = { current: 'loading' };
      const result = cardGridReducer(loading, { type: 'LOAD_COMPLETE_EMPTY' });
      expect(result.current).toBe('empty');
    });

    it('loading ignores DATA_EMPTY', () => {
      const loading: CardGridState = { current: 'loading' };
      const result = cardGridReducer(loading, { type: 'DATA_EMPTY' });
      expect(result).toBe(loading);
    });

    // From empty
    it('empty -> loading on LOAD', () => {
      const empty: CardGridState = { current: 'empty' };
      const result = cardGridReducer(empty, { type: 'LOAD' });
      expect(result.current).toBe('loading');
    });

    it('empty -> static on DATA_AVAILABLE', () => {
      const empty: CardGridState = { current: 'empty' };
      const result = cardGridReducer(empty, { type: 'DATA_AVAILABLE' });
      expect(result.current).toBe('static');
    });

    it('empty ignores LOAD_COMPLETE', () => {
      const empty: CardGridState = { current: 'empty' };
      const result = cardGridReducer(empty, { type: 'LOAD_COMPLETE' });
      expect(result).toBe(empty);
    });
  });
});

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
describe('Chart', () => {
  describe('chartReducer', () => {
    it('starts in rendered state with no highlight', () => {
      expect(chartInitialState.current).toBe('rendered');
      expect(chartInitialState.highlightedSeries).toBeNull();
      expect(chartInitialState.highlightedIndex).toBe(-1);
    });

    it('RENDER_COMPLETE transitions to rendered', () => {
      const loading: ChartState = { current: 'loading', highlightedSeries: null, highlightedIndex: -1 };
      const result = chartReducer(loading, { type: 'RENDER_COMPLETE' });
      expect(result.current).toBe('rendered');
    });

    it('RELOAD transitions to loading and clears highlight', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 2 };
      const result = chartReducer(highlighted, { type: 'RELOAD' });
      expect(result.current).toBe('loading');
      expect(result.highlightedSeries).toBeNull();
      expect(result.highlightedIndex).toBe(-1);
    });

    it('HOVER_SEGMENT sets highlighted state', () => {
      const result = chartReducer(chartInitialState, { type: 'HOVER_SEGMENT', series: 'Revenue', index: 3 });
      expect(result.current).toBe('highlighted');
      expect(result.highlightedSeries).toBe('Revenue');
      expect(result.highlightedIndex).toBe(3);
    });

    it('FOCUS_SEGMENT sets highlighted state', () => {
      const result = chartReducer(chartInitialState, { type: 'FOCUS_SEGMENT', series: 'Costs', index: 0 });
      expect(result.current).toBe('highlighted');
      expect(result.highlightedSeries).toBe('Costs');
      expect(result.highlightedIndex).toBe(0);
    });

    it('UNHOVER_SEGMENT returns to rendered and clears highlight', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 1 };
      const result = chartReducer(highlighted, { type: 'UNHOVER_SEGMENT' });
      expect(result.current).toBe('rendered');
      expect(result.highlightedSeries).toBeNull();
      expect(result.highlightedIndex).toBe(-1);
    });

    it('BLUR_SEGMENT returns to rendered and clears highlight', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 1 };
      const result = chartReducer(highlighted, { type: 'BLUR_SEGMENT' });
      expect(result.current).toBe('rendered');
      expect(result.highlightedSeries).toBeNull();
    });

    it('NAVIGATE_SEGMENT_PREV decrements highlightedIndex (min 0)', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 2 };
      const result = chartReducer(highlighted, { type: 'NAVIGATE_SEGMENT_PREV' });
      expect(result.highlightedIndex).toBe(1);
    });

    it('NAVIGATE_SEGMENT_PREV does not go below 0', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 0 };
      const result = chartReducer(highlighted, { type: 'NAVIGATE_SEGMENT_PREV' });
      expect(result.highlightedIndex).toBe(0);
    });

    it('NAVIGATE_SEGMENT_NEXT increments highlightedIndex', () => {
      const highlighted: ChartState = { current: 'highlighted', highlightedSeries: 'Sales', highlightedIndex: 2 };
      const result = chartReducer(highlighted, { type: 'NAVIGATE_SEGMENT_NEXT' });
      expect(result.highlightedIndex).toBe(3);
    });

    it('unknown action returns same state', () => {
      const result = chartReducer(chartInitialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(chartInitialState);
    });
  });
});

// ---------------------------------------------------------------------------
// DataList
// ---------------------------------------------------------------------------
describe('DataList', () => {
  describe('dataListReducer', () => {
    it('starts in static state', () => {
      expect(dataListInitialState.current).toBe('static');
    });

    it('NOOP returns the same state', () => {
      const result = dataListReducer(dataListInitialState, { type: 'NOOP' });
      expect(result).toBe(dataListInitialState);
    });
  });
});

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------
describe('DataTable', () => {
  describe('dataTableReducer', () => {
    const base: DataTableState = {
      current: 'idle',
      sortColumn: null,
      sortDirection: 'none',
      selectedRows: new Set(),
    };

    // SORT
    it('SORT sets sorting state, column, and ascending direction on first sort', () => {
      const result = dataTableReducer(base, { type: 'SORT', column: 'name' });
      expect(result.current).toBe('sorting');
      expect(result.sortColumn).toBe('name');
      expect(result.sortDirection).toBe('ascending');
    });

    it('SORT toggles to descending when sorting same column already ascending', () => {
      const ascState: DataTableState = {
        ...base,
        sortColumn: 'name',
        sortDirection: 'ascending',
      };
      const result = dataTableReducer(ascState, { type: 'SORT', column: 'name' });
      expect(result.sortDirection).toBe('descending');
    });

    it('SORT resets to ascending when sorting a different column', () => {
      const ascState: DataTableState = {
        ...base,
        sortColumn: 'name',
        sortDirection: 'ascending',
      };
      const result = dataTableReducer(ascState, { type: 'SORT', column: 'email' });
      expect(result.sortColumn).toBe('email');
      expect(result.sortDirection).toBe('ascending');
    });

    it('SORT resets to ascending when current direction is descending', () => {
      const descState: DataTableState = {
        ...base,
        sortColumn: 'name',
        sortDirection: 'descending',
      };
      const result = dataTableReducer(descState, { type: 'SORT', column: 'name' });
      expect(result.sortDirection).toBe('ascending');
    });

    // SORT_COMPLETE
    it('SORT_COMPLETE returns to idle', () => {
      const sorting: DataTableState = { ...base, current: 'sorting' };
      const result = dataTableReducer(sorting, { type: 'SORT_COMPLETE' });
      expect(result.current).toBe('idle');
    });

    // LOAD / LOAD_COMPLETE
    it('LOAD sets loading state', () => {
      const result = dataTableReducer(base, { type: 'LOAD' });
      expect(result.current).toBe('loading');
    });

    it('LOAD_COMPLETE returns to idle', () => {
      const loading: DataTableState = { ...base, current: 'loading' };
      const result = dataTableReducer(loading, { type: 'LOAD_COMPLETE' });
      expect(result.current).toBe('idle');
    });

    // DATA_EMPTY / DATA_AVAILABLE
    it('DATA_EMPTY sets empty state', () => {
      const result = dataTableReducer(base, { type: 'DATA_EMPTY' });
      expect(result.current).toBe('empty');
    });

    it('DATA_AVAILABLE returns to idle', () => {
      const empty: DataTableState = { ...base, current: 'empty' };
      const result = dataTableReducer(empty, { type: 'DATA_AVAILABLE' });
      expect(result.current).toBe('idle');
    });

    // SELECT_ROW / DESELECT_ROW
    it('SELECT_ROW adds row index to selectedRows', () => {
      const result = dataTableReducer(base, { type: 'SELECT_ROW', index: 2 });
      expect(result.selectedRows.has(2)).toBe(true);
    });

    it('SELECT_ROW can accumulate multiple selections', () => {
      let state = dataTableReducer(base, { type: 'SELECT_ROW', index: 0 });
      state = dataTableReducer(state, { type: 'SELECT_ROW', index: 3 });
      expect(state.selectedRows.has(0)).toBe(true);
      expect(state.selectedRows.has(3)).toBe(true);
      expect(state.selectedRows.size).toBe(2);
    });

    it('DESELECT_ROW removes row index from selectedRows', () => {
      const withSelection: DataTableState = { ...base, selectedRows: new Set([1, 2, 3]) };
      const result = dataTableReducer(withSelection, { type: 'DESELECT_ROW', index: 2 });
      expect(result.selectedRows.has(2)).toBe(false);
      expect(result.selectedRows.has(1)).toBe(true);
      expect(result.selectedRows.has(3)).toBe(true);
    });

    it('DESELECT_ROW on non-existent row is a no-op on the set', () => {
      const result = dataTableReducer(base, { type: 'DESELECT_ROW', index: 99 });
      expect(result.selectedRows.size).toBe(0);
    });

    it('unknown action returns same state', () => {
      const result = dataTableReducer(base, { type: 'UNKNOWN' } as any);
      expect(result).toBe(base);
    });
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  describe('emptyStateReducer', () => {
    it('starts in static state', () => {
      expect(emptyStateInitialState.current).toBe('static');
    });

    it('NOOP returns the same state', () => {
      const result = emptyStateReducer(emptyStateInitialState, { type: 'NOOP' });
      expect(result).toBe(emptyStateInitialState);
    });
  });
});

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------
describe('Gauge', () => {
  describe('gaugeReducer', () => {
    it('starts in static state', () => {
      expect(gaugeInitialState.current).toBe('static');
    });

    it('THRESHOLD_WARNING transitions to warning', () => {
      const result = gaugeReducer(gaugeInitialState, { type: 'THRESHOLD_WARNING' });
      expect(result.current).toBe('warning');
    });

    it('THRESHOLD_CRITICAL transitions to critical', () => {
      const result = gaugeReducer(gaugeInitialState, { type: 'THRESHOLD_CRITICAL' });
      expect(result.current).toBe('critical');
    });

    it('THRESHOLD_NORMAL transitions to normal', () => {
      const result = gaugeReducer(gaugeInitialState, { type: 'THRESHOLD_NORMAL' });
      expect(result.current).toBe('normal');
    });

    it('VALUE_CHANGE returns same state', () => {
      const result = gaugeReducer(gaugeInitialState, { type: 'VALUE_CHANGE' });
      expect(result).toBe(gaugeInitialState);
    });

    it('unknown action returns same state', () => {
      const result = gaugeReducer(gaugeInitialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(gaugeInitialState);
    });
  });

  describe('getThresholdLevel', () => {
    const thresholds = { warning: 60, critical: 90 };

    it('returns none when no thresholds provided', () => {
      expect(getThresholdLevel(50)).toBe('none');
    });

    it('returns normal when below warning', () => {
      expect(getThresholdLevel(30, thresholds)).toBe('normal');
    });

    it('returns warning at warning boundary', () => {
      expect(getThresholdLevel(60, thresholds)).toBe('warning');
    });

    it('returns warning between warning and critical', () => {
      expect(getThresholdLevel(75, thresholds)).toBe('warning');
    });

    it('returns critical at critical boundary', () => {
      expect(getThresholdLevel(90, thresholds)).toBe('critical');
    });

    it('returns critical above critical', () => {
      expect(getThresholdLevel(100, thresholds)).toBe('critical');
    });
  });

  describe('getThresholdColor', () => {
    it('returns red for critical', () => {
      expect(getThresholdColor('critical')).toBe('#ef4444');
    });

    it('returns amber for warning', () => {
      expect(getThresholdColor('warning')).toBe('#f59e0b');
    });

    it('returns green for normal', () => {
      expect(getThresholdColor('normal')).toBe('#22c55e');
    });

    it('returns indigo for none', () => {
      expect(getThresholdColor('none')).toBe('#6366f1');
    });
  });
});

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------
describe('KanbanBoard', () => {
  describe('kanbanBoardReducer', () => {
    it('starts in idle state with null drag fields', () => {
      expect(kanbanBoardInitialState.current).toBe('idle');
      expect(kanbanBoardInitialState.draggedCardId).toBeNull();
      expect(kanbanBoardInitialState.dragSourceColumn).toBeNull();
      expect(kanbanBoardInitialState.dropTargetColumn).toBeNull();
    });

    // DRAG_START
    it('DRAG_START sets dragging state with card and column info', () => {
      const result = kanbanBoardReducer(kanbanBoardInitialState, {
        type: 'DRAG_START',
        cardId: 'card-1',
        columnId: 'col-a',
      });
      expect(result.current).toBe('dragging');
      expect(result.draggedCardId).toBe('card-1');
      expect(result.dragSourceColumn).toBe('col-a');
    });

    // DRAG_ENTER_COLUMN
    it('DRAG_ENTER_COLUMN transitions to draggingBetween', () => {
      const dragging: KanbanBoardState = {
        current: 'dragging',
        draggedCardId: 'card-1',
        dragSourceColumn: 'col-a',
        dropTargetColumn: null,
      };
      const result = kanbanBoardReducer(dragging, { type: 'DRAG_ENTER_COLUMN', columnId: 'col-b' });
      expect(result.current).toBe('draggingBetween');
      expect(result.dropTargetColumn).toBe('col-b');
    });

    // DROP
    it('DROP resets to idle and clears all drag fields', () => {
      const draggingBetween: KanbanBoardState = {
        current: 'draggingBetween',
        draggedCardId: 'card-1',
        dragSourceColumn: 'col-a',
        dropTargetColumn: 'col-b',
      };
      const result = kanbanBoardReducer(draggingBetween, { type: 'DROP' });
      expect(result.current).toBe('idle');
      expect(result.draggedCardId).toBeNull();
      expect(result.dragSourceColumn).toBeNull();
      expect(result.dropTargetColumn).toBeNull();
    });

    // DRAG_CANCEL
    it('DRAG_CANCEL resets to idle and clears all drag fields', () => {
      const dragging: KanbanBoardState = {
        current: 'dragging',
        draggedCardId: 'card-1',
        dragSourceColumn: 'col-a',
        dropTargetColumn: null,
      };
      const result = kanbanBoardReducer(dragging, { type: 'DRAG_CANCEL' });
      expect(result.current).toBe('idle');
      expect(result.draggedCardId).toBeNull();
    });

    // FOCUS_COLUMN / FOCUS_CARD / BLUR
    it('FOCUS_COLUMN transitions to columnFocused', () => {
      const result = kanbanBoardReducer(kanbanBoardInitialState, { type: 'FOCUS_COLUMN' });
      expect(result.current).toBe('columnFocused');
    });

    it('FOCUS_CARD transitions to cardFocused', () => {
      const result = kanbanBoardReducer(kanbanBoardInitialState, { type: 'FOCUS_CARD' });
      expect(result.current).toBe('cardFocused');
    });

    it('BLUR transitions to idle', () => {
      const focused: KanbanBoardState = { ...kanbanBoardInitialState, current: 'cardFocused' };
      const result = kanbanBoardReducer(focused, { type: 'BLUR' });
      expect(result.current).toBe('idle');
    });

    it('unknown action returns same state', () => {
      const result = kanbanBoardReducer(kanbanBoardInitialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(kanbanBoardInitialState);
    });
  });
});

// ---------------------------------------------------------------------------
// List (factory reducer)
// ---------------------------------------------------------------------------
describe('List', () => {
  describe('createListReducer', () => {
    it('creates a reducer function', () => {
      const reducer = createListReducer(5, false);
      expect(typeof reducer).toBe('function');
    });

    describe('single-select mode (3 items)', () => {
      const reducer = createListReducer(3, false);
      const initial: ListState = { focusedIndex: 0, selectedIds: new Set() };

      it('NAVIGATE_NEXT increments focusedIndex', () => {
        const result = reducer(initial, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(1);
      });

      it('NAVIGATE_NEXT does not exceed itemCount - 1', () => {
        const atEnd: ListState = { focusedIndex: 2, selectedIds: new Set() };
        const result = reducer(atEnd, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(2);
      });

      it('NAVIGATE_PREV decrements focusedIndex', () => {
        const mid: ListState = { focusedIndex: 1, selectedIds: new Set() };
        const result = reducer(mid, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_PREV does not go below 0', () => {
        const result = reducer(initial, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_FIRST sets focusedIndex to 0', () => {
        const mid: ListState = { focusedIndex: 2, selectedIds: new Set() };
        const result = reducer(mid, { type: 'NAVIGATE_FIRST' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_LAST sets focusedIndex to itemCount - 1', () => {
        const result = reducer(initial, { type: 'NAVIGATE_LAST' });
        expect(result.focusedIndex).toBe(2);
      });

      it('SELECT adds an id to selectedIds', () => {
        const result = reducer(initial, { type: 'SELECT', id: 'item-a' });
        expect(result.selectedIds.has('item-a')).toBe(true);
      });

      it('SELECT in single-select clears previous selection', () => {
        const withSelection: ListState = { focusedIndex: 0, selectedIds: new Set(['item-a']) };
        const result = reducer(withSelection, { type: 'SELECT', id: 'item-b' });
        expect(result.selectedIds.has('item-a')).toBe(false);
        expect(result.selectedIds.has('item-b')).toBe(true);
        expect(result.selectedIds.size).toBe(1);
      });

      it('SELECT toggles off already-selected id', () => {
        const withSelection: ListState = { focusedIndex: 0, selectedIds: new Set(['item-a']) };
        const result = reducer(withSelection, { type: 'SELECT', id: 'item-a' });
        expect(result.selectedIds.has('item-a')).toBe(false);
        expect(result.selectedIds.size).toBe(0);
      });

      it('FOCUS sets focusedIndex', () => {
        const result = reducer(initial, { type: 'FOCUS', index: 2 });
        expect(result.focusedIndex).toBe(2);
      });

      it('BLUR returns same state', () => {
        const result = reducer(initial, { type: 'BLUR' });
        expect(result).toBe(initial);
      });

      it('unknown action returns same state', () => {
        const result = reducer(initial, { type: 'UNKNOWN' } as any);
        expect(result).toBe(initial);
      });
    });

    describe('multi-select mode (5 items)', () => {
      const reducer = createListReducer(5, true);
      const initial: ListState = { focusedIndex: 0, selectedIds: new Set() };

      it('SELECT in multi-select accumulates selections', () => {
        let state = reducer(initial, { type: 'SELECT', id: 'a' });
        state = reducer(state, { type: 'SELECT', id: 'b' });
        state = reducer(state, { type: 'SELECT', id: 'c' });
        expect(state.selectedIds.size).toBe(3);
        expect(state.selectedIds.has('a')).toBe(true);
        expect(state.selectedIds.has('b')).toBe(true);
        expect(state.selectedIds.has('c')).toBe(true);
      });

      it('SELECT toggles off in multi-select without clearing others', () => {
        const withSelection: ListState = { focusedIndex: 0, selectedIds: new Set(['a', 'b', 'c']) };
        const result = reducer(withSelection, { type: 'SELECT', id: 'b' });
        expect(result.selectedIds.has('b')).toBe(false);
        expect(result.selectedIds.has('a')).toBe(true);
        expect(result.selectedIds.has('c')).toBe(true);
      });

      it('NAVIGATE_LAST goes to index 4', () => {
        const result = reducer(initial, { type: 'NAVIGATE_LAST' });
        expect(result.focusedIndex).toBe(4);
      });

      it('NAVIGATE_NEXT clamps at 4', () => {
        const atEnd: ListState = { focusedIndex: 4, selectedIds: new Set() };
        const result = reducer(atEnd, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(4);
      });
    });

    describe('different item counts', () => {
      it('works with 1 item', () => {
        const reducer = createListReducer(1, false);
        const initial: ListState = { focusedIndex: 0, selectedIds: new Set() };
        expect(reducer(initial, { type: 'NAVIGATE_NEXT' }).focusedIndex).toBe(0);
        expect(reducer(initial, { type: 'NAVIGATE_PREV' }).focusedIndex).toBe(0);
        expect(reducer(initial, { type: 'NAVIGATE_LAST' }).focusedIndex).toBe(0);
      });

      it('works with 10 items', () => {
        const reducer = createListReducer(10, false);
        const initial: ListState = { focusedIndex: 0, selectedIds: new Set() };
        expect(reducer(initial, { type: 'NAVIGATE_LAST' }).focusedIndex).toBe(9);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// NotificationItem
// ---------------------------------------------------------------------------
describe('NotificationItem', () => {
  describe('notificationItemReducer', () => {
    // From unread
    it('unread -> read on MARK_READ', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'MARK_READ' });
      expect(result.current).toBe('read');
    });

    it('unread -> hoveredUnread on HOVER', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'HOVER' });
      expect(result.current).toBe('hoveredUnread');
    });

    it('unread ignores UNHOVER', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'UNHOVER' });
      expect(result).toBe(state);
    });

    it('unread ignores MARK_UNREAD', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'MARK_UNREAD' });
      expect(result).toBe(state);
    });

    it('unread ignores FOCUS', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'FOCUS' });
      expect(result).toBe(state);
    });

    it('unread ignores BLUR', () => {
      const state: NotificationItemState = { current: 'unread' };
      const result = notificationItemReducer(state, { type: 'BLUR' });
      expect(result).toBe(state);
    });

    // From read
    it('read -> unread on MARK_UNREAD', () => {
      const state: NotificationItemState = { current: 'read' };
      const result = notificationItemReducer(state, { type: 'MARK_UNREAD' });
      expect(result.current).toBe('unread');
    });

    it('read -> hoveredRead on HOVER', () => {
      const state: NotificationItemState = { current: 'read' };
      const result = notificationItemReducer(state, { type: 'HOVER' });
      expect(result.current).toBe('hoveredRead');
    });

    it('read ignores MARK_READ', () => {
      const state: NotificationItemState = { current: 'read' };
      const result = notificationItemReducer(state, { type: 'MARK_READ' });
      expect(result).toBe(state);
    });

    it('read ignores UNHOVER', () => {
      const state: NotificationItemState = { current: 'read' };
      const result = notificationItemReducer(state, { type: 'UNHOVER' });
      expect(result).toBe(state);
    });

    // From hoveredUnread
    it('hoveredUnread -> unread on UNHOVER', () => {
      const state: NotificationItemState = { current: 'hoveredUnread' };
      const result = notificationItemReducer(state, { type: 'UNHOVER' });
      expect(result.current).toBe('unread');
    });

    it('hoveredUnread -> hoveredRead on MARK_READ', () => {
      const state: NotificationItemState = { current: 'hoveredUnread' };
      const result = notificationItemReducer(state, { type: 'MARK_READ' });
      expect(result.current).toBe('hoveredRead');
    });

    it('hoveredUnread ignores HOVER', () => {
      const state: NotificationItemState = { current: 'hoveredUnread' };
      const result = notificationItemReducer(state, { type: 'HOVER' });
      expect(result).toBe(state);
    });

    it('hoveredUnread ignores MARK_UNREAD', () => {
      const state: NotificationItemState = { current: 'hoveredUnread' };
      const result = notificationItemReducer(state, { type: 'MARK_UNREAD' });
      expect(result).toBe(state);
    });

    // From hoveredRead
    it('hoveredRead -> read on UNHOVER', () => {
      const state: NotificationItemState = { current: 'hoveredRead' };
      const result = notificationItemReducer(state, { type: 'UNHOVER' });
      expect(result.current).toBe('read');
    });

    it('hoveredRead -> hoveredUnread on MARK_UNREAD', () => {
      const state: NotificationItemState = { current: 'hoveredRead' };
      const result = notificationItemReducer(state, { type: 'MARK_UNREAD' });
      expect(result.current).toBe('hoveredUnread');
    });

    it('hoveredRead ignores MARK_READ', () => {
      const state: NotificationItemState = { current: 'hoveredRead' };
      const result = notificationItemReducer(state, { type: 'MARK_READ' });
      expect(result).toBe(state);
    });

    it('hoveredRead ignores HOVER', () => {
      const state: NotificationItemState = { current: 'hoveredRead' };
      const result = notificationItemReducer(state, { type: 'HOVER' });
      expect(result).toBe(state);
    });
  });
});

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
describe('Skeleton', () => {
  describe('skeletonReducer', () => {
    it('starts in loading state', () => {
      expect(skeletonInitialState.current).toBe('loading');
    });

    // From loading
    it('loading -> hidden on CONTENT_READY', () => {
      const result = skeletonReducer(skeletonInitialState, { type: 'CONTENT_READY' });
      expect(result.current).toBe('hidden');
    });

    it('loading ignores CONTENT_LOADING', () => {
      const result = skeletonReducer(skeletonInitialState, { type: 'CONTENT_LOADING' });
      expect(result).toBe(skeletonInitialState);
    });

    // From hidden
    it('hidden -> loading on CONTENT_LOADING', () => {
      const hidden: SkeletonState = { current: 'hidden' };
      const result = skeletonReducer(hidden, { type: 'CONTENT_LOADING' });
      expect(result.current).toBe('loading');
    });

    it('hidden ignores CONTENT_READY', () => {
      const hidden: SkeletonState = { current: 'hidden' };
      const result = skeletonReducer(hidden, { type: 'CONTENT_READY' });
      expect(result).toBe(hidden);
    });
  });
});

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
describe('StatCard', () => {
  describe('statCardReducer', () => {
    it('starts in static state', () => {
      expect(statCardInitialState.current).toBe('static');
    });

    it('TREND_UP transitions to up', () => {
      const result = statCardReducer(statCardInitialState, { type: 'TREND_UP' });
      expect(result.current).toBe('up');
    });

    it('TREND_DOWN transitions to down', () => {
      const result = statCardReducer(statCardInitialState, { type: 'TREND_DOWN' });
      expect(result.current).toBe('down');
    });

    it('TREND_NEUTRAL transitions to neutral', () => {
      const result = statCardReducer(statCardInitialState, { type: 'TREND_NEUTRAL' });
      expect(result.current).toBe('neutral');
    });

    it('TREND_CLEAR transitions to static', () => {
      const upState: StatCardState = { current: 'up' };
      const result = statCardReducer(upState, { type: 'TREND_CLEAR' });
      expect(result.current).toBe('static');
    });

    it('TREND_CLEAR from static stays static', () => {
      const result = statCardReducer(statCardInitialState, { type: 'TREND_CLEAR' });
      expect(result.current).toBe('static');
    });

    it('unknown action returns same state', () => {
      const result = statCardReducer(statCardInitialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(statCardInitialState);
    });

    it('can cycle between trend states', () => {
      let state: StatCardState = statCardInitialState;
      state = statCardReducer(state, { type: 'TREND_UP' });
      expect(state.current).toBe('up');
      state = statCardReducer(state, { type: 'TREND_DOWN' });
      expect(state.current).toBe('down');
      state = statCardReducer(state, { type: 'TREND_NEUTRAL' });
      expect(state.current).toBe('neutral');
      state = statCardReducer(state, { type: 'TREND_CLEAR' });
      expect(state.current).toBe('static');
    });
  });
});

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
describe('Timeline', () => {
  describe('timelineReducer', () => {
    it('starts in idle state with null ids', () => {
      expect(timelineInitialState.current).toBe('idle');
      expect(timelineInitialState.selectedId).toBeNull();
      expect(timelineInitialState.hoveredId).toBeNull();
    });

    // SCROLL / SCROLL_END
    it('SCROLL transitions to scrolling', () => {
      const result = timelineReducer(timelineInitialState, { type: 'SCROLL' });
      expect(result.current).toBe('scrolling');
    });

    it('SCROLL_END transitions to idle', () => {
      const scrolling: TimelineState = { ...timelineInitialState, current: 'scrolling' };
      const result = timelineReducer(scrolling, { type: 'SCROLL_END' });
      expect(result.current).toBe('idle');
    });

    // RESIZE_BAR / RESIZE_END / RESIZE_CANCEL
    it('RESIZE_BAR transitions to resizing', () => {
      const result = timelineReducer(timelineInitialState, { type: 'RESIZE_BAR' });
      expect(result.current).toBe('resizing');
    });

    it('RESIZE_END transitions to idle', () => {
      const resizing: TimelineState = { ...timelineInitialState, current: 'resizing' };
      const result = timelineReducer(resizing, { type: 'RESIZE_END' });
      expect(result.current).toBe('idle');
    });

    it('RESIZE_CANCEL transitions to idle', () => {
      const resizing: TimelineState = { ...timelineInitialState, current: 'resizing' };
      const result = timelineReducer(resizing, { type: 'RESIZE_CANCEL' });
      expect(result.current).toBe('idle');
    });

    // SELECT_BAR / DESELECT_BAR
    it('SELECT_BAR transitions to barSelected and sets selectedId', () => {
      const result = timelineReducer(timelineInitialState, { type: 'SELECT_BAR', id: 'task-1' });
      expect(result.current).toBe('barSelected');
      expect(result.selectedId).toBe('task-1');
    });

    it('DESELECT_BAR transitions to idle and clears selectedId', () => {
      const selected: TimelineState = { ...timelineInitialState, current: 'barSelected', selectedId: 'task-1' };
      const result = timelineReducer(selected, { type: 'DESELECT_BAR' });
      expect(result.current).toBe('idle');
      expect(result.selectedId).toBeNull();
    });

    // HOVER_BAR / UNHOVER_BAR
    it('HOVER_BAR transitions to barHovered and sets hoveredId', () => {
      const result = timelineReducer(timelineInitialState, { type: 'HOVER_BAR', id: 'task-2' });
      expect(result.current).toBe('barHovered');
      expect(result.hoveredId).toBe('task-2');
    });

    it('UNHOVER_BAR returns to idle when nothing selected', () => {
      const hovered: TimelineState = { ...timelineInitialState, current: 'barHovered', hoveredId: 'task-2' };
      const result = timelineReducer(hovered, { type: 'UNHOVER_BAR' });
      expect(result.current).toBe('idle');
      expect(result.hoveredId).toBeNull();
    });

    it('UNHOVER_BAR returns to barSelected when a bar is selected', () => {
      const hoveredWithSelection: TimelineState = {
        current: 'barHovered',
        selectedId: 'task-1',
        hoveredId: 'task-2',
      };
      const result = timelineReducer(hoveredWithSelection, { type: 'UNHOVER_BAR' });
      expect(result.current).toBe('barSelected');
      expect(result.hoveredId).toBeNull();
      expect(result.selectedId).toBe('task-1');
    });

    it('unknown action returns same state', () => {
      const result = timelineReducer(timelineInitialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(timelineInitialState);
    });
  });
});

// ---------------------------------------------------------------------------
// ViewToggle (factory reducer)
// ---------------------------------------------------------------------------
describe('ViewToggle', () => {
  describe('createViewToggleReducer', () => {
    it('creates a reducer function', () => {
      const reducer = createViewToggleReducer(3);
      expect(typeof reducer).toBe('function');
    });

    describe('with 3 options', () => {
      const reducer = createViewToggleReducer(3);
      const initial: ViewToggleState = { activeValue: 'grid', focusedIndex: 0 };

      it('SELECT updates activeValue and focusedIndex', () => {
        const result = reducer(initial, { type: 'SELECT', value: 'list', index: 1 });
        expect(result.activeValue).toBe('list');
        expect(result.focusedIndex).toBe(1);
      });

      it('NAVIGATE_NEXT wraps around', () => {
        const atEnd: ViewToggleState = { activeValue: 'grid', focusedIndex: 2 };
        const result = reducer(atEnd, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_NEXT increments normally', () => {
        const result = reducer(initial, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(1);
      });

      it('NAVIGATE_PREV wraps around', () => {
        const result = reducer(initial, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(2);
      });

      it('NAVIGATE_PREV decrements normally', () => {
        const mid: ViewToggleState = { activeValue: 'grid', focusedIndex: 1 };
        const result = reducer(mid, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_FIRST sets focusedIndex to 0', () => {
        const mid: ViewToggleState = { activeValue: 'grid', focusedIndex: 2 };
        const result = reducer(mid, { type: 'NAVIGATE_FIRST' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_LAST sets focusedIndex to optionCount - 1', () => {
        const result = reducer(initial, { type: 'NAVIGATE_LAST' });
        expect(result.focusedIndex).toBe(2);
      });

      it('FOCUS sets focusedIndex', () => {
        const result = reducer(initial, { type: 'FOCUS', index: 2 });
        expect(result.focusedIndex).toBe(2);
      });

      it('BLUR returns same state', () => {
        const result = reducer(initial, { type: 'BLUR' });
        expect(result).toBe(initial);
      });

      it('unknown action returns same state', () => {
        const result = reducer(initial, { type: 'UNKNOWN' } as any);
        expect(result).toBe(initial);
      });
    });

    describe('with 2 options', () => {
      const reducer = createViewToggleReducer(2);
      const initial: ViewToggleState = { activeValue: 'a', focusedIndex: 0 };

      it('NAVIGATE_NEXT wraps from 1 to 0', () => {
        const atEnd: ViewToggleState = { activeValue: 'a', focusedIndex: 1 };
        const result = reducer(atEnd, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_PREV wraps from 0 to 1', () => {
        const result = reducer(initial, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(1);
      });

      it('NAVIGATE_LAST sets to 1', () => {
        const result = reducer(initial, { type: 'NAVIGATE_LAST' });
        expect(result.focusedIndex).toBe(1);
      });
    });

    describe('with 5 options', () => {
      const reducer = createViewToggleReducer(5);
      const initial: ViewToggleState = { activeValue: 'first', focusedIndex: 0 };

      it('NAVIGATE_LAST sets to 4', () => {
        const result = reducer(initial, { type: 'NAVIGATE_LAST' });
        expect(result.focusedIndex).toBe(4);
      });

      it('NAVIGATE_NEXT from 4 wraps to 0', () => {
        const atEnd: ViewToggleState = { activeValue: 'first', focusedIndex: 4 };
        const result = reducer(atEnd, { type: 'NAVIGATE_NEXT' });
        expect(result.focusedIndex).toBe(0);
      });

      it('NAVIGATE_PREV from 0 wraps to 4', () => {
        const result = reducer(initial, { type: 'NAVIGATE_PREV' });
        expect(result.focusedIndex).toBe(4);
      });

      it('SELECT preserves activeValue through subsequent navigations', () => {
        let state = reducer(initial, { type: 'SELECT', value: 'third', index: 2 });
        expect(state.activeValue).toBe('third');
        state = reducer(state, { type: 'NAVIGATE_NEXT' });
        expect(state.activeValue).toBe('third');
        expect(state.focusedIndex).toBe(3);
      });
    });
  });
});
