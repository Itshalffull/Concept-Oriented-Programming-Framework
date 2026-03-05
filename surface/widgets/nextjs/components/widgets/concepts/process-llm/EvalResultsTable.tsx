/* ---------------------------------------------------------------------------
 * EvalResultsTable — Server Component
 *
 * Evaluation results table for LLM evaluation runs. Shows test cases with
 * pass/fail status, model output, expected output, score, and per-metric
 * breakdowns. Supports sorting by score, filtering by pass/fail, and
 * detail expansion for individual test cases.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

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
  /** Optional per-metric breakdown. */
  metrics?: Record<string, number>;
}

export interface EvalResultsTableProps {
  /** List of test case results. */
  testCases: EvalTestCase[];
  /** Overall evaluation score (0-100). */
  overallScore: number;
  /** Number of passing test cases. */
  passCount: number;
  /** Number of failing test cases. */
  failCount: number;
  /** Column to sort by. */
  sortBy?: string;
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc';
  /** Filter by pass/fail status. */
  filterStatus?: string | undefined;
  /** Whether to show the expected output column. */
  showExpected?: boolean;
  /** ID of the selected test case for detail view. */
  selectedCaseId?: string | undefined;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

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

export default function EvalResultsTable({
  testCases,
  overallScore,
  passCount,
  failCount,
  sortBy = 'score',
  sortOrder = 'desc',
  filterStatus,
  showExpected = true,
  selectedCaseId,
  children,
}: EvalResultsTableProps) {
  const state = selectedCaseId ? 'rowSelected' : 'idle';

  // Filter
  const filteredCases = (() => {
    if (!filterStatus) return testCases;
    if (filterStatus === 'pass') return testCases.filter((tc) => tc.pass);
    if (filterStatus === 'fail') return testCases.filter((tc) => !tc.pass);
    return testCases;
  })();

  // Sort
  const sortedCases = [...filteredCases].sort((a, b) => compareCases(a, b, sortBy, sortOrder));

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return '';
    return sortOrder === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const totalCount = passCount + failCount;
  const passPercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
  const failPercent = totalCount > 0 ? 100 - passPercent : 0;

  const selectedCase = selectedCaseId ? sortedCases.find((tc) => tc.id === selectedCaseId) : null;

  return (
    <div
      role="region"
      aria-label="Evaluation results"
      data-surface-widget=""
      data-widget-name="eval-results-table"
      data-part="root"
      data-state={state}
      tabIndex={0}
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
          data-active={!filterStatus ? 'true' : 'false'}
          aria-pressed={!filterStatus}
        >
          All ({testCases.length})
        </button>
        <button
          type="button"
          data-part="filter-pass"
          data-active={filterStatus === 'pass' ? 'true' : 'false'}
          aria-pressed={filterStatus === 'pass'}
        >
          Pass ({passCount})
        </button>
        <button
          type="button"
          data-part="filter-fail"
          data-active={filterStatus === 'fail' ? 'true' : 'false'}
          aria-pressed={filterStatus === 'fail'}
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
              aria-sort={sortBy === 'status' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              tabIndex={0}
            >
              Status{sortIndicator('status')}
            </th>
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortBy === 'input' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              tabIndex={0}
            >
              Input{sortIndicator('input')}
            </th>
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortBy === 'actual' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              tabIndex={0}
            >
              Output{sortIndicator('actual')}
            </th>
            {showExpected && (
              <th
                data-part="header-cell"
                role="columnheader"
                aria-sort={sortBy === 'expected' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                tabIndex={0}
              >
                Expected{sortIndicator('expected')}
              </th>
            )}
            <th
              data-part="header-cell"
              role="columnheader"
              aria-sort={sortBy === 'score' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              tabIndex={0}
            >
              Score{sortIndicator('score')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCases.map((tc, index) => {
            const isSelected = selectedCaseId === tc.id;
            return (
              <tr
                key={tc.id}
                data-part="row"
                role="row"
                data-status={tc.pass ? 'pass' : 'fail'}
                aria-selected={isSelected}
                tabIndex={index === 0 ? 0 : -1}
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
}

export { EvalResultsTable };
