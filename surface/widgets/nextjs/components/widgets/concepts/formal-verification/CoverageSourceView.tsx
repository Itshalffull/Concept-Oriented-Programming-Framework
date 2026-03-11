import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type CoverageStatus = 'covered' | 'uncovered' | 'partial' | null;
export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'partial';

export interface CoverageLine {
  number: number;
  text: string;
  coverage: CoverageStatus;
  coveredBy?: string;
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e',
  uncovered: '#ef4444',
  partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CoverageSourceViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  lines: CoverageLine[];
  summary: CoverageSummary;
  language?: string;
  showLineNumbers?: boolean;
  filterStatus?: CoverageFilter;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function CoverageSourceView({
  lines,
  summary,
  language = 'typescript',
  showLineNumbers = true,
  filterStatus = 'all',
  children: _children,
  ...restProps
}: CoverageSourceViewProps) {
  const filteredLines = filterStatus === 'all'
    ? lines
    : lines.filter((l) => l.coverage === filterStatus);

  return (
    <div
      role="document"
      aria-label="Coverage source view"
      data-surface-widget=""
      data-widget-name="coverage-source-view"
      data-part="root"
      data-state="idle"
      tabIndex={0}
      {...restProps}
    >
      {/* Summary header */}
      <div
        data-part="summary"
        data-state="idle"
        role="status"
        aria-live="polite"
        style={{
          padding: '8px 12px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        Coverage: {summary.percentage}% ({summary.coveredLines}/{summary.totalLines} lines)
      </div>

      {/* Filter bar */}
      <div
        data-part="filter-bar"
        data-state="idle"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '6px 12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter}
            type="button"
            data-active={filterStatus === filter ? 'true' : 'false'}
            aria-pressed={filterStatus === filter}
            style={{
              padding: '2px 10px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              background: filterStatus === filter ? '#e0e7ff' : 'transparent',
              fontWeight: filterStatus === filter ? 600 : 400,
            }}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Scrollable code area */}
      <div
        role="code"
        style={{
          overflow: 'auto',
          fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
          fontSize: '13px',
          lineHeight: '20px',
          position: 'relative',
        }}
      >
        {filteredLines.map((line) => (
          <div
            key={line.number}
            role="row"
            aria-selected={false}
            data-line-number={line.number}
            data-coverage={line.coverage ?? 'none'}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              cursor: 'pointer',
            }}
          >
            {/* Coverage gutter */}
            <div
              data-part="coverage-gutter"
              data-state="idle"
              role="presentation"
              style={{
                width: '4px',
                flexShrink: 0,
                background: line.coverage ? (GUTTER_COLORS[line.coverage] ?? 'transparent') : 'transparent',
              }}
              aria-hidden="true"
            />

            {/* Line number */}
            {showLineNumbers && (
              <div
                data-part="line-numbers"
                data-state="idle"
                data-visible="true"
                role="rowheader"
                aria-label={`Line ${line.number}`}
                style={{
                  width: '48px',
                  flexShrink: 0,
                  textAlign: 'right',
                  paddingRight: '12px',
                  color: '#9ca3af',
                  userSelect: 'none',
                }}
              >
                {line.number}
              </div>
            )}

            {/* Source text */}
            <div
              data-part="source-text"
              data-state="idle"
              data-language={language}
              style={{
                flex: 1,
                whiteSpace: 'pre',
                paddingRight: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {line.text}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip placeholder (requires client interactivity) */}
      <div
        data-part="tooltip"
        data-state="idle"
        data-visible="false"
        role="tooltip"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export { CoverageSourceView };
