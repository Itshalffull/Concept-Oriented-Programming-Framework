import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource {
  label: string;
  weight: number;
  type: WeightSourceType;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: 'var(--weight-token, #3b82f6)',
  delegation: 'var(--weight-delegation, #8b5cf6)',
  reputation: 'var(--weight-reputation, #10b981)',
  manual: 'var(--weight-manual, #f59e0b)',
};

function prepareSegments(sources: WeightSource[], totalWeight: number) {
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  return sorted.map((source) => ({
    ...source,
    percent: totalWeight > 0 ? (source.weight / totalWeight) * 100 : 0,
  }));
}

function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface WeightBreakdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  sources: WeightSource[];
  totalWeight: number;
  participant: string;
  variant?: 'bar' | 'donut';
  showLegend?: boolean;
  showTotal?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function WeightBreakdown({
  sources,
  totalWeight,
  participant,
  variant = 'bar',
  showLegend = true,
  showTotal = true,
  children,
  ...rest
}: WeightBreakdownProps) {
  const segments = prepareSegments(sources, totalWeight);

  // Compute donut SVG paths
  const donutSegments = (() => {
    if (variant !== 'donut') return [];
    let cumulativeAngle = -90;
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
  })();

  return (
    <div
      role="img"
      aria-label={`Weight breakdown for ${participant}: ${formatWeight(totalWeight)} total`}
      data-surface-widget=""
      data-widget-name="weight-breakdown"
      data-part="root"
      data-state="idle"
      data-variant={variant}
      tabIndex={0}
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
          segments.map((seg) => (
            <div
              key={seg.label}
              data-part="segment"
              data-source={seg.type}
              data-highlighted="false"
              role="img"
              aria-label={`${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`}
              tabIndex={-1}
              style={{
                width: `${seg.percent}%`,
                backgroundColor: SOURCE_COLORS[seg.type],
                display: 'inline-block',
                height: '100%',
              }}
            />
          ))
        ) : (
          <svg viewBox="0 0 100 100" role="presentation" style={{ width: '100%', height: '100%' }}>
            {donutSegments.map((seg) => (
              <path
                key={seg.label}
                d={seg.d}
                fill={SOURCE_COLORS[seg.type]}
                data-part="segment"
                data-source={seg.type}
                data-highlighted="false"
                role="img"
                aria-label={`${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`}
                tabIndex={-1}
              />
            ))}
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

      {/* Tooltip placeholder (visible state requires client interaction) */}
      <div
        data-part="tooltip"
        role="tooltip"
        data-visible="false"
        aria-hidden="true"
        style={{ visibility: 'hidden', position: 'absolute' }}
      />

      {children}
    </div>
  );
}

export { WeightBreakdown };
