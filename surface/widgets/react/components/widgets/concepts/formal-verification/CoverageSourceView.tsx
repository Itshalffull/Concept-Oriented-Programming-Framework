export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' };

export function coverageSourceViewReducer(state: CoverageSourceViewState, event: CoverageSourceViewEvent): CoverageSourceViewState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_LINE') return 'lineHovered';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'JUMP_UNCOVERED') return 'idle';
      return state;
    case 'lineHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

// --- Public types ---

export type CoverageStatus = 'covered' | 'uncovered' | 'partial' | null;
export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'partial';

export interface CoverageLine {
  number: number;
  text: string;
  coverage: CoverageStatus;
  /** Optional property / contract that covers this line */
  coveredBy?: string;
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
}

export interface CoverageSourceViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Source lines with coverage annotations */
  lines: CoverageLine[];
  /** Aggregate coverage summary */
  summary: CoverageSummary;
  /** Source language for data-language attribute */
  language?: string;
  /** Whether to show line numbers gutter */
  showLineNumbers?: boolean;
  /** Active coverage filter */
  filterStatus?: CoverageFilter;
  /** Callback when a line is selected */
  onLineSelect?: (line: CoverageLine) => void;
  /** Callback when filter changes */
  onFilterChange?: (filter: CoverageFilter) => void;
  children?: ReactNode;
}

// --- Style constants ---

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e',
  uncovered: '#ef4444',
  partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

// --- Component ---

const CoverageSourceView = forwardRef<HTMLDivElement, CoverageSourceViewProps>(function CoverageSourceView(
  {
    lines,
    summary,
    language = 'typescript',
    showLineNumbers = true,
    filterStatus = 'all',
    onLineSelect,
    onFilterChange,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(coverageSourceViewReducer, 'idle');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [focusedLineIndex, setFocusedLineIndex] = useState<number>(0);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<CoverageFilter>(filterStatus);
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Sync external filterStatus prop
  useEffect(() => {
    setActiveFilter(filterStatus);
  }, [filterStatus]);

  // Filtered lines based on active filter
  const filteredLines = useMemo(() => {
    if (activeFilter === 'all') return lines;
    return lines.filter((l) => l.coverage === activeFilter);
  }, [lines, activeFilter]);

  // Ensure lineRefs array stays in sync
  useEffect(() => {
    lineRefs.current = lineRefs.current.slice(0, filteredLines.length);
  }, [filteredLines.length]);

  // Scroll focused line into view
  useEffect(() => {
    const el = lineRefs.current[focusedLineIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedLineIndex]);

  const handleFilterChange = useCallback(
    (filter: CoverageFilter) => {
      setActiveFilter(filter);
      setFocusedLineIndex(0);
      setSelectedLineIndex(null);
      send({ type: 'FILTER', status: filter });
      onFilterChange?.(filter);
    },
    [onFilterChange],
  );

  const handleLineSelect = useCallback(
    (index: number) => {
      setSelectedLineIndex(index);
      const line = filteredLines[index];
      if (line) onLineSelect?.(line);
    },
    [filteredLines, onLineSelect],
  );

  const jumpToNextUncovered = useCallback(() => {
    const startIdx = focusedLineIndex + 1;
    for (let i = 0; i < filteredLines.length; i++) {
      const idx = (startIdx + i) % filteredLines.length;
      if (filteredLines[idx].coverage === 'uncovered') {
        setFocusedLineIndex(idx);
        send({ type: 'JUMP_UNCOVERED' });
        return;
      }
    }
  }, [focusedLineIndex, filteredLines]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        jumpToNextUncovered();
        return;
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Focus filter bar — handled via DOM
        const filterBar = (e.currentTarget as HTMLElement).querySelector('[data-part="filter-bar"] button');
        if (filterBar instanceof HTMLElement) filterBar.focus();
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedLineIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedLineIndex((prev) => Math.min(filteredLines.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          handleLineSelect(focusedLineIndex);
          break;
      }
    },
    [filteredLines.length, focusedLineIndex, handleLineSelect, jumpToNextUncovered],
  );

  const handleLineHover = useCallback(
    (index: number) => {
      setHoveredLineIndex(index);
      send({ type: 'HOVER_LINE', lineIndex: index });
    },
    [],
  );

  const handleLineLeave = useCallback(() => {
    setHoveredLineIndex(null);
    send({ type: 'LEAVE' });
  }, []);

  const hoveredLine = hoveredLineIndex !== null ? filteredLines[hoveredLineIndex] : null;

  return (
    <div
      ref={ref}
      role="document"
      aria-label="Coverage source view"
      data-surface-widget=""
      data-widget-name="coverage-source-view"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...restProps}
    >
      {/* Summary header */}
      <div
        data-part="summary"
        data-state={state}
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
        data-state={state}
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
            data-active={activeFilter === filter ? 'true' : 'false'}
            aria-pressed={activeFilter === filter}
            onClick={() => handleFilterChange(filter)}
            style={{
              padding: '2px 10px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              background: activeFilter === filter ? '#e0e7ff' : 'transparent',
              fontWeight: activeFilter === filter ? 600 : 400,
            }}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Scrollable code area */}
      <div
        ref={codeAreaRef}
        role="code"
        style={{
          overflow: 'auto',
          fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
          fontSize: '13px',
          lineHeight: '20px',
          position: 'relative',
        }}
      >
        {filteredLines.map((line, index) => {
          const isSelected = selectedLineIndex === index;
          const isFocused = focusedLineIndex === index;
          const isHovered = hoveredLineIndex === index;

          return (
            <div
              key={line.number}
              ref={(el) => { lineRefs.current[index] = el; }}
              role="row"
              aria-selected={isSelected}
              aria-current={isFocused ? 'true' : undefined}
              data-line-number={line.number}
              data-coverage={line.coverage ?? 'none'}
              onClick={() => handleLineSelect(index)}
              onMouseEnter={() => handleLineHover(index)}
              onMouseLeave={handleLineLeave}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                background: isSelected
                  ? '#dbeafe'
                  : isFocused
                    ? '#f1f5f9'
                    : isHovered
                      ? '#f8fafc'
                      : 'transparent',
                cursor: 'pointer',
                outline: isFocused ? '2px solid #6366f1' : 'none',
                outlineOffset: '-2px',
              }}
            >
              {/* Coverage gutter */}
              <div
                data-part="coverage-gutter"
                data-state={state}
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
                  data-state={state}
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
                data-state={state}
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
          );
        })}
      </div>

      {/* Hover tooltip */}
      {state === 'lineHovered' && hoveredLine && hoveredLine.coveredBy && (
        <div
          data-part="tooltip"
          data-state={state}
          data-visible="true"
          role="tooltip"
          style={{
            position: 'absolute',
            padding: '4px 8px',
            fontSize: '12px',
            background: '#1f2937',
            color: '#f9fafb',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          Covered by: {hoveredLine.coveredBy}
        </div>
      )}

      {/* Selected line details */}
      {selectedLineIndex !== null && filteredLines[selectedLineIndex] && (
        <div
          data-part="line-detail"
          data-state={state}
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <strong>Line {filteredLines[selectedLineIndex].number}</strong>
          {' — '}
          {filteredLines[selectedLineIndex].coverage
            ? filteredLines[selectedLineIndex].coverage!.charAt(0).toUpperCase() +
              filteredLines[selectedLineIndex].coverage!.slice(1)
            : 'Not executable'}
          {filteredLines[selectedLineIndex].coveredBy && (
            <span> (covered by: {filteredLines[selectedLineIndex].coveredBy})</span>
          )}
        </div>
      )}
    </div>
  );
});

CoverageSourceView.displayName = 'CoverageSourceView';
export { CoverageSourceView };
export default CoverageSourceView;
