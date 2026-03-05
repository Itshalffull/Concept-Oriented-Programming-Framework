/* ---------------------------------------------------------------------------
 * EvalResultsTable — Evaluation results table for LLM evaluation runs
 *
 * Shows test cases with pass/fail status, model output, expected output,
 * score, and per-metric breakdowns. Supports sorting by score, filtering
 * by pass/fail, and detail expansion for individual test cases.
 * ------------------------------------------------------------------------- */

export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW'; id?: string }
  | { type: 'SORT'; column?: string }
  | { type: 'FILTER'; status?: string }
  | { type: 'DESELECT' };

export function evalResultsTableReducer(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface EvalTestCase {
  id: string;
  input: string;
  expected: string;
  actual: string;
  score: number;
  pass: boolean;
  /** Optional per-metric breakdown */
  metrics?: Record<string, number>;
}

export interface EvalResultsTableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** List of test case results */
  testCases: EvalTestCase[];
  /** Overall evaluation score (0-100) */
  overallScore: number;
  /** Number of passing test cases */
  passCount: number;
  /** Number of failing test cases */
  failCount: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Filter by pass/fail status */
  filterStatus?: string | undefined;
  /** Whether to show the expected output column */
  showExpected?: boolean;
  /** Called when a row is selected */
  onSelect?: (testCase: EvalTestCase) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

type SortableColumn = 'input' | 'actual' | 'expected' | 'score' | 'status';

function compareCases(a: EvalTestCase, b: EvalTestCase, key: string, order: 'asc' | 'desc'): number {
  let cmp = 0;
  switch (key) {
    case 'score':
      cmp = a.score - b.score;
      break;
    case 'status':
      cmp = (a.pass ? 1 : 0) - (b.pass ? 1 : 0);
      break;
    case 'input':
      cmp = a.input.localeCompare(b.input);
      break;
    case 'actual':
      cmp = a.actual.localeCompare(b.actual);
      break;
    case 'expected':
      cmp = a.expected.localeCompare(b.expected);
      break;
    default:
      cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const EvalResultsTable = forwardRef<HTMLDivElement, EvalResultsTableProps>(function EvalResultsTable(
  {
    testCases,
    overallScore,
    passCount,
    failCount,
    sortBy: initialSortBy = 'score',
    sortOrder: initialSortOrder = 'desc',
    filterStatus: initialFilterStatus,
    showExpected = true,
    onSelect,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(evalResultsTableReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortByCol, setSortByCol] = useState(initialSortBy);
  const [sortOrd, setSortOrd] = useState<'asc' | 'desc'>(initialSortOrder);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilterStatus);
  const [focusIndex, setFocusIndex] = useState(0);

  // Filter
  const filteredCases = useMemo(() => {
    if (!activeFilter) return testCases;
    if (activeFilter === 'pass') return testCases.filter((tc) => tc.pass);
    if (activeFilter === 'fail') return testCases.filter((tc) => !tc.pass);
    return testCases;
  }, [testCases, activeFilter]);

  // Sort
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => compareCases(a, b, sortByCol, sortOrd));
  }, [filteredCases, sortByCol, sortOrd]);

  const handleSort = useCallback((column: string) => {
    if (sortByCol === column) {
      setSortOrd((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortByCol(column);
      setSortOrd('desc');
    }
    send({ type: 'SORT', column });
  }, [sortByCol]);

  const handleFilter = useCallback((status: string | undefined) => {
    setActiveFilter(status);
    send({ type: 'FILTER', status });
  }, []);

  const handleSelectRow = useCallback((tc: EvalTestCase) => {
    if (selectedId === tc.id) {
      setSelectedId(null);
      send({ type: 'DESELECT' });
    } else {
      setSelectedId(tc.id);
      send({ type: 'SELECT_ROW', id: tc.id });
      onSelect?.(tc);
    }
  }, [selectedId, onSelect]);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    send({ type: 'DESELECT' });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, sortedCases.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const tc = sortedCases[focusIndex];
      if (tc) handleSelectRow(tc);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDeselect();
    }
  }, [sortedCases, focusIndex, handleSelectRow, handleDeselect]);

  const sortIndicator = (col: string) => {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const totalCount = passCount + failCount;
  const passPercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
  const failPercent = totalCount > 0 ? 100 - passPercent : 0;

  const selectedCase = selectedId ? sortedCases.find((tc) => tc.id === selectedId) : null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Evaluation results"
      data-surface-widget=""
      data-widget-name="eval-results-table"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Summary bar */}
      <div data-part="summary">
        <span
          data-part="score"
          role="status"
          aria-label={`Overall score: ${overallScore}%`}
        >
          {overallScore}%
        </span>

        <span data-part="pass-count" aria-label={`${passCount} passed`}>
          {passCount} passed
        </span>
        <span data-part="fail-count" aria-label={`${failCount} failed`}>
          {failCount} failed
        </span>

        {/* Pass/fail ratio bar */}
        <div
          data-part="pass-fail-bar"
          role="img"
          aria-label={`${passCount} passed, ${failCount} failed`}
        >
          <div
            data-part="pass-segment"
            data-status="pass"
            style={{ width: `${passPercent}%` }}
            aria-hidden="true"
          />
          <div
            data-part="fail-segment"
            data-status="fail"
            style={{ width: `${failPercent}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Filter buttons */}
      <div data-part="filter-bar" role="toolbar" aria-label="Filter results">
        <button
          type="button"
          data-part="filter-all"
          data-active={!activeFilter ? 'true' : 'false'}
          aria-pressed={!activeFilter}
          onClick={() => handleFilter(undefined)}
        >
          All ({testCases.length})
        </button>
        <button
          type="button"
          data-part="filter-pass"
          data-active={activeFilter === 'pass' ? 'true' : 'false'}
          aria-pressed={activeFilter === 'pass'}
          onClick={() => handleFilter(activeFilter === 'pass' ? undefined : 'pass')}
        >
          Pass ({passCount})
        </button>
        <button
          type="button"
          data-part="filter-fail"
          data-active={activeFilter === 'fail' ? 'true' : 'false'}
          aria-pressed={activeFilter === 'fail'}
          onClick={() => handleFilter(activeFilter === 'fail' ? undefined : 'fail')}
        >
          Fail ({failCount})
        </button>
      </div>

      {/* Results table */}
      <table
        data-part="table"
        role="table"
        aria-label={`Results: ${passCount} passed, ${failCount} failed`}
      >
        <thead>
          <tr data-part="header-row" role="row">
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortByCol === 'status' ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => handleSort('status')}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSort('status'); }}
            >
              Status{sortIndicator('status')}
            </th>
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortByCol === 'input' ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => handleSort('input')}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSort('input'); }}
            >
              Input{sortIndicator('input')}
            </th>
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortByCol === 'actual' ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => handleSort('actual')}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSort('actual'); }}
            >
              Output{sortIndicator('actual')}
            </th>
            {showExpected && (
              <th
                data-part="header-cell"
                role="columnheader"
                aria-sort={sortByCol === 'expected' ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => handleSort('expected')}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSort('expected'); }}
              >
                Expected{sortIndicator('expected')}
              </th>
            )}
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortByCol === 'score' ? (sortOrd === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => handleSort('score')}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSort('score'); }}
            >
              Score{sortIndicator('score')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCases.map((tc, index) => {
            const isSelected = selectedId === tc.id;
            const isFocused = focusIndex === index;
            return (
              <tr
                key={tc.id}
                data-part="row"
                role="row"
                data-status={tc.pass ? 'pass' : 'fail'}
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => handleSelectRow(tc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectRow(tc);
                  }
                }}
              >
                <td data-part="status" role="cell" data-pass={tc.pass ? 'true' : 'false'}>
                  <span
                    data-part="pass-fail-badge"
                    aria-label={tc.pass ? 'Passed' : 'Failed'}
                  >
                    {tc.pass ? '\u2713 Pass' : '\u2717 Fail'}
                  </span>
                </td>
                <td data-part="input" role="cell" title={tc.input}>
                  {truncate(tc.input, 80)}
                </td>
                <td data-part="output" role="cell" title={tc.actual}>
                  {truncate(tc.actual, 80)}
                </td>
                {showExpected && (
                  <td data-part="expected" role="cell" title={tc.expected}>
                    {truncate(tc.expected, 80)}
                  </td>
                )}
                <td data-part="score-cell" role="cell">
                  <span data-part="score-value">{tc.score}</span>
                  <div
                    data-part="score-bar"
                    role="progressbar"
                    aria-valuenow={tc.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Score: ${tc.score}`}
                  >
                    <div
                      data-part="score-bar-fill"
                      data-pass={tc.pass ? 'true' : 'false'}
                      style={{ width: `${Math.min(100, tc.score)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </td>
              </tr>
            );
          })}
          {sortedCases.length === 0 && (
            <tr data-part="empty-row">
              <td colSpan={showExpected ? 5 : 4} data-part="empty-cell" role="cell">
                No test cases match the current filter
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Detail panel (expanded row) */}
      <div
        data-part="detail"
        data-visible={state === 'rowSelected' && selectedCase ? 'true' : 'false'}
        aria-hidden={!(state === 'rowSelected' && selectedCase)}
      >
        {selectedCase && (
          <div data-part="detail-content">
            <div data-part="detail-header">
              <span data-part="detail-status" data-pass={selectedCase.pass ? 'true' : 'false'}>
                {selectedCase.pass ? '\u2713 Passed' : '\u2717 Failed'}
              </span>
              <span data-part="detail-score">Score: {selectedCase.score}</span>
              <button
                type="button"
                data-part="close-detail"
                onClick={handleDeselect}
                aria-label="Close detail panel"
              >
                {'\u2715'}
              </button>
            </div>

            <div data-part="detail-section">
              <h4 data-part="detail-label">Input</h4>
              <pre data-part="detail-input">{selectedCase.input}</pre>
            </div>

            <div data-part="detail-section">
              <h4 data-part="detail-label">Model Output</h4>
              <pre data-part="detail-output">{selectedCase.actual}</pre>
            </div>

            <div data-part="detail-section">
              <h4 data-part="detail-label">Expected Output</h4>
              <pre data-part="detail-expected">{selectedCase.expected}</pre>
            </div>

            {/* Diff view */}
            {selectedCase.actual !== selectedCase.expected && (
              <div data-part="detail-section">
                <h4 data-part="detail-label">Diff</h4>
                <div data-part="detail-diff">
                  <div data-part="diff-expected" aria-label="Expected">
                    <span data-part="diff-prefix">-</span> {selectedCase.expected}
                  </div>
                  <div data-part="diff-actual" aria-label="Actual">
                    <span data-part="diff-prefix">+</span> {selectedCase.actual}
                  </div>
                </div>
              </div>
            )}

            {/* Per-metric breakdown */}
            {selectedCase.metrics && Object.keys(selectedCase.metrics).length > 0 && (
              <div data-part="detail-section">
                <h4 data-part="detail-label">Metrics</h4>
                <div data-part="metrics-list">
                  {Object.entries(selectedCase.metrics).map(([metric, value]) => (
                    <div key={metric} data-part="metric-item">
                      <span data-part="metric-name">{metric}</span>
                      <span data-part="metric-value">{value}</span>
                      <div
                        data-part="metric-bar"
                        role="progressbar"
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          data-part="metric-bar-fill"
                          style={{ width: `${Math.min(100, value)}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
});

EvalResultsTable.displayName = 'EvalResultsTable';
export { EvalResultsTable };
export default EvalResultsTable;
