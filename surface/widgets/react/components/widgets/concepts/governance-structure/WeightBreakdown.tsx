/* ---------------------------------------------------------------------------
 * WeightBreakdown state machine
 * States: idle (initial), segmentHovered
 * ------------------------------------------------------------------------- */

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT'; source: string }
  | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
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
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource {
  /** Human-readable label for this weight source. */
  label: string;
  /** Numeric weight contributed by this source. */
  weight: number;
  /** Category of weight source. */
  type: WeightSourceType;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Default color mapping for weight source types. */
const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: 'var(--weight-token, #3b82f6)',
  delegation: 'var(--weight-delegation, #8b5cf6)',
  reputation: 'var(--weight-reputation, #10b981)',
  manual: 'var(--weight-manual, #f59e0b)',
};

/** Sort sources by weight descending and compute percentages. */
function prepareSegments(sources: WeightSource[], totalWeight: number) {
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  return sorted.map((source) => ({
    ...source,
    percent: totalWeight > 0 ? (source.weight / totalWeight) * 100 : 0,
  }));
}

/** Format a number for display (up to 2 decimal places, no trailing zeros). */
function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface WeightBreakdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of weight sources contributing to total weight. */
  sources: WeightSource[];
  /** Total effective weight (may differ from sum of sources due to modifiers). */
  totalWeight: number;
  /** Participant name for accessibility labeling. */
  participant: string;
  /** Visual variant: stacked bar or donut chart. */
  variant?: 'bar' | 'donut';
  /** Whether to show the color-coded legend. */
  showLegend?: boolean;
  /** Whether to display the total weight prominently. */
  showTotal?: boolean;
  /** Optional slot content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const WeightBreakdown = forwardRef<HTMLDivElement, WeightBreakdownProps>(function WeightBreakdown(
  {
    sources,
    totalWeight,
    participant,
    variant = 'bar',
    showLegend = true,
    showTotal = true,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(weightBreakdownReducer, 'idle');
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const segments = useMemo(
    () => prepareSegments(sources, totalWeight),
    [sources, totalWeight],
  );

  /** Handle segment hover start. */
  const handleSegmentEnter = useCallback(
    (label: string) => {
      setHoveredSource(label);
      send({ type: 'HOVER_SEGMENT', source: label });
    },
    [],
  );

  /** Handle segment hover end. */
  const handleSegmentLeave = useCallback(() => {
    setHoveredSource(null);
    send({ type: 'LEAVE' });
  }, []);

  /** Arrow key navigation between segments. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (segments.length === 0) return;

      let nextIndex = focusedIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
      }

      if (nextIndex !== focusedIndex) {
        setFocusedIndex(nextIndex);
        setHoveredSource(segments[nextIndex].label);
        send({ type: 'HOVER_SEGMENT', source: segments[nextIndex].label });
        segmentRefs.current[nextIndex]?.focus();
      }
    },
    [focusedIndex, segments],
  );

  /** Compute the donut segment SVG path (for donut variant). */
  const donutSegments = useMemo(() => {
    if (variant !== 'donut') return [];
    let cumulativeAngle = -90; // start at top
    return segments.map((seg) => {
      const angle = (seg.percent / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const r = 40;
      const cx = 50;
      const cy = 50;
      const largeArc = angle > 180 ? 1 : 0;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const d =
        angle >= 360
          ? `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy}`
          : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

      return { ...seg, d };
    });
  }, [variant, segments]);

  /* Tooltip data for the currently hovered segment. */
  const tooltipSegment = useMemo(
    () => (hoveredSource ? segments.find((s) => s.label === hoveredSource) : null),
    [hoveredSource, segments],
  );

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Weight breakdown for ${participant}: ${formatWeight(totalWeight)} total`}
      data-surface-widget=""
      data-widget-name="weight-breakdown"
      data-part="root"
      data-state={state}
      data-variant={variant}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Total weight display */}
      {showTotal && (
        <span
          data-part="total"
          data-visible="true"
          aria-label={`Total weight: ${formatWeight(totalWeight)}`}
        >
          {formatWeight(totalWeight)}
        </span>
      )}

      {/* Chart area */}
      <div data-part="chart">
        {variant === 'bar' ? (
          /* Stacked bar chart */
          segments.map((seg, i) => (
            <div
              key={seg.label}
              ref={(el) => { segmentRefs.current[i] = el; }}
              data-part="segment"
              data-source={seg.type}
              data-highlighted={hoveredSource === seg.label ? 'true' : 'false'}
              role="img"
              aria-label={`${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`}
              tabIndex={-1}
              style={{
                width: `${seg.percent}%`,
                backgroundColor: SOURCE_COLORS[seg.type],
                display: 'inline-block',
                height: '100%',
                opacity: hoveredSource && hoveredSource !== seg.label ? 0.5 : 1,
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={() => handleSegmentEnter(seg.label)}
              onMouseLeave={handleSegmentLeave}
              onFocus={() => {
                setFocusedIndex(i);
                handleSegmentEnter(seg.label);
              }}
              onBlur={() => {
                handleSegmentLeave();
              }}
            />
          ))
        ) : (
          /* Donut chart */
          <svg
            viewBox="0 0 100 100"
            role="presentation"
            style={{ width: '100%', height: '100%' }}
          >
            {donutSegments.map((seg, i) => (
              <path
                key={seg.label}
                d={seg.d}
                fill={SOURCE_COLORS[seg.type]}
                data-part="segment"
                data-source={seg.type}
                data-highlighted={hoveredSource === seg.label ? 'true' : 'false'}
                role="img"
                aria-label={`${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`}
                tabIndex={-1}
                opacity={hoveredSource && hoveredSource !== seg.label ? 0.5 : 1}
                style={{ transition: 'opacity 150ms ease', cursor: 'pointer' }}
                onMouseEnter={() => handleSegmentEnter(seg.label)}
                onMouseLeave={handleSegmentLeave}
                onFocus={() => {
                  setFocusedIndex(i);
                  handleSegmentEnter(seg.label);
                }}
                onBlur={() => handleSegmentLeave()}
              />
            ))}
            {/* Center text for donut showing total */}
            {showTotal && (
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                data-part="donut-center"
                style={{ fontSize: '8px', fontWeight: 'bold' }}
              >
                {formatWeight(totalWeight)}
              </text>
            )}
          </svg>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div data-part="legend" data-visible="true">
          {segments.map((seg) => (
            <div
              key={seg.label}
              data-part="legend-item"
              data-source={seg.type}
              aria-label={`${seg.label}: ${formatWeight(seg.percent)}%`}
            >
              <span
                data-part="legend-swatch"
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: SOURCE_COLORS[seg.type],
                  marginRight: '4px',
                }}
              />
              <span data-part="legend-label">{seg.label}</span>
              <span data-part="legend-percent"> {formatWeight(seg.percent)}%</span>
              <span data-part="legend-value"> ({formatWeight(seg.weight)})</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip (visible only when hovering a segment) */}
      <div
        data-part="tooltip"
        role="tooltip"
        data-visible={state === 'segmentHovered' ? 'true' : 'false'}
        aria-hidden={state !== 'segmentHovered'}
        style={{
          visibility: state === 'segmentHovered' ? 'visible' : 'hidden',
          position: 'absolute',
        }}
      >
        {tooltipSegment && (
          <>
            <span data-part="tooltip-label">{tooltipSegment.label}</span>
            <span data-part="tooltip-type">{tooltipSegment.type}</span>
            <span data-part="tooltip-value">{formatWeight(tooltipSegment.weight)}</span>
            <span data-part="tooltip-percent">{formatWeight(tooltipSegment.percent)}%</span>
          </>
        )}
      </div>

      {/* Slot content */}
      {children}
    </div>
  );
});

WeightBreakdown.displayName = 'WeightBreakdown';
export { WeightBreakdown };
export default WeightBreakdown;
