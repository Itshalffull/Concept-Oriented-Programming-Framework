'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { chartReducer, chartInitialState } from './Chart.reducer.js';

// Props from chart.widget spec
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'donut';
  data: ChartSeries[];
  width?: string;
  height?: string;
  ariaLabel?: string;
  showLegend?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentClick?: (series: string, index: number) => void;
  className?: string;
  children?: ReactNode;
}

// SVG chart rendering helpers
function renderBarChart(series: ChartSeries[], svgWidth: number, svgHeight: number): ReactNode {
  if (series.length === 0) return null;
  const allPoints = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allPoints.map((p) => p.value), 1);
  const barWidth = svgWidth / Math.max(allPoints.length, 1);
  const padding = barWidth * 0.1;

  let idx = 0;
  return series.map((s) =>
    s.data.map((point) => {
      const barHeight = (point.value / maxVal) * (svgHeight - 20);
      const x = idx * barWidth + padding;
      const y = svgHeight - barHeight;
      idx++;
      return (
        <rect
          key={`${s.name}-${point.label}`}
          x={x}
          y={y}
          width={barWidth - padding * 2}
          height={barHeight}
          fill={point.color || s.color || '#6366f1'}
          data-series={s.name}
          data-label={point.label}
          data-value={point.value}
        />
      );
    })
  );
}

function renderLineChart(series: ChartSeries[], svgWidth: number, svgHeight: number): ReactNode {
  if (series.length === 0) return null;
  const allValues = series.flatMap((s) => s.data.map((p) => p.value));
  const maxVal = Math.max(...allValues, 1);

  return series.map((s) => {
    const points = s.data.map((point, i) => {
      const x = (i / Math.max(s.data.length - 1, 1)) * svgWidth;
      const y = svgHeight - (point.value / maxVal) * (svgHeight - 20);
      return `${x},${y}`;
    });
    return (
      <polyline
        key={s.name}
        points={points.join(' ')}
        fill="none"
        stroke={s.color || '#6366f1'}
        strokeWidth="2"
        data-series={s.name}
      />
    );
  });
}

function renderPieChart(series: ChartSeries[], cx: number, cy: number, radius: number, donut: boolean): ReactNode {
  if (series.length === 0) return null;
  const data = series[0]?.data ?? [];
  const total = data.reduce((sum, p) => sum + p.value, 0) || 1;
  const innerRadius = donut ? radius * 0.6 : 0;
  let cumAngle = -Math.PI / 2;

  return data.map((point) => {
    const angle = (point.value / total) * 2 * Math.PI;
    const x1 = cx + radius * Math.cos(cumAngle);
    const y1 = cy + radius * Math.sin(cumAngle);
    const x2 = cx + radius * Math.cos(cumAngle + angle);
    const y2 = cy + radius * Math.sin(cumAngle + angle);
    const ix1 = cx + innerRadius * Math.cos(cumAngle);
    const iy1 = cy + innerRadius * Math.sin(cumAngle);
    const ix2 = cx + innerRadius * Math.cos(cumAngle + angle);
    const iy2 = cy + innerRadius * Math.sin(cumAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = donut
      ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    cumAngle += angle;

    return (
      <path
        key={point.label}
        d={d}
        fill={point.color || '#6366f1'}
        data-label={point.label}
        data-value={point.value}
      />
    );
  });
}

export const Chart = forwardRef<HTMLDivElement, ChartProps>(
  function Chart(
    {
      type,
      data,
      width,
      height,
      ariaLabel = 'Chart',
      showLegend = true,
      animate = true,
      size = 'md',
      onSegmentClick,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(chartReducer, chartInitialState);
    const fallbackId = useId();

    const svgWidth = 400;
    const svgHeight = 300;

    const chartContent = useMemo(() => {
      switch (type) {
        case 'bar':
          return renderBarChart(data, svgWidth, svgHeight);
        case 'line':
          return renderLineChart(data, svgWidth, svgHeight);
        case 'pie':
          return renderPieChart(data, svgWidth / 2, svgHeight / 2, Math.min(svgWidth, svgHeight) / 2 - 10, false);
        case 'donut':
          return renderPieChart(data, svgWidth / 2, svgHeight / 2, Math.min(svgWidth, svgHeight) / 2 - 10, true);
        default:
          return null;
      }
    }, [type, data]);

    const allSeries = useMemo(
      () => data.map((s) => ({ name: s.name, color: s.color || '#6366f1' })),
      [data]
    );

    const handleChartKeyDown = useCallback(
      (e: KeyboardEvent<SVGSVGElement>) => {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_SEGMENT_PREV' });
            break;
          case 'ArrowRight':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_SEGMENT_NEXT' });
            break;
          case 'Enter':
            e.preventDefault();
            if (state.highlightedSeries !== null) {
              onSegmentClick?.(state.highlightedSeries, state.highlightedIndex);
            }
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'BLUR_SEGMENT' });
            break;
        }
      },
      [state.highlightedSeries, state.highlightedIndex, onSegmentClick]
    );

    return (
      <div
        ref={ref}
        className={className}
        role="figure"
        aria-label={ariaLabel}
        aria-describedby={fallbackId}
        data-surface-widget=""
        data-widget-name="chart"
        data-part="root"
        data-type={type}
        data-state={state.current}
        data-animate={animate ? 'true' : 'false'}
        data-size={size}
      >
        <svg
          role="img"
          aria-label={ariaLabel}
          data-part="chart"
          data-type={type}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: width || '100%', height: height || 'auto' }}
          aria-busy={state.current === 'loading' ? 'true' : 'false'}
          tabIndex={0}
          onFocus={() => {
            if (data.length > 0 && data[0].data.length > 0) {
              dispatch({
                type: 'FOCUS_SEGMENT',
                series: data[0].name,
                index: 0,
              });
            }
          }}
          onBlur={() => dispatch({ type: 'BLUR_SEGMENT' })}
          onKeyDown={handleChartKeyDown}
        >
          {chartContent}
        </svg>
        {showLegend && allSeries.length > 0 && (
          <div
            role="list"
            aria-label="Chart legend"
            data-part="legend"
            data-visible="true"
          >
            {allSeries.map((series) => (
              <div
                key={series.name}
                role="listitem"
                data-part="legend-item"
                data-series={series.name}
                onMouseEnter={() =>
                  dispatch({
                    type: 'HOVER_SEGMENT',
                    series: series.name,
                    index: 0,
                  })
                }
                onMouseLeave={() => dispatch({ type: 'UNHOVER_SEGMENT' })}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    backgroundColor: series.color,
                    borderRadius: '2px',
                  }}
                />
                {series.name}
              </div>
            ))}
          </div>
        )}
        <div
          data-part="tooltip"
          data-visible={state.current === 'highlighted' ? 'true' : 'false'}
        />
        {/* Screen reader accessible data table fallback */}
        <table
          id={fallbackId}
          role="table"
          aria-label={`${ariaLabel} data`}
          data-part="data-table-fallback"
          data-sr-only="true"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          <thead>
            <tr>
              <th>Label</th>
              {data.map((s) => (
                <th key={s.name}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data[0]?.data ?? []).map((point, i) => (
              <tr key={point.label}>
                <td>{point.label}</td>
                {data.map((s) => (
                  <td key={s.name}>{s.data[i]?.value ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {children}
      </div>
    );
  }
);

Chart.displayName = 'Chart';
export default Chart;
