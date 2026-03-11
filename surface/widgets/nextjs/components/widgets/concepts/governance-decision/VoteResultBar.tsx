import type { HTMLAttributes, ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const DEFAULT_COLORS = [
  '#4caf50', '#f44336', '#ff9800', '#2196f3',
  '#9c27b0', '#00bcd4', '#795548', '#607d8b',
];

function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 36 };

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VoteResultBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  segments: VoteSegment[];
  total?: number;
  variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean;
  showQuorum?: boolean;
  quorumThreshold?: number;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component (Server Component)
 * ------------------------------------------------------------------------- */

export default function VoteResultBar({
  segments,
  total: totalProp,
  variant = 'binary',
  showLabels = true,
  showQuorum = false,
  quorumThreshold = 0,
  size = 'md',
  children,
  style,
  ...rest
}: VoteResultBarProps) {
  const total =
    totalProp != null && totalProp > 0
      ? totalProp
      : segments.reduce((sum, seg) => sum + seg.count, 0);

  const computedSegments = segments.map((seg, i) => ({
    ...seg,
    percent: toPercent(seg.count, total),
    resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const ariaDescription = (() => {
    const parts = computedSegments.map(
      (seg) => `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`,
    );
    return `Vote results: ${parts.join(', ')}. Total: ${total} votes.`;
  })();

  const barHeight = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <div
      role="img"
      aria-label="Vote results"
      aria-roledescription="vote result bar"
      aria-description={ariaDescription}
      data-surface-widget=""
      data-widget-name="vote-result-bar"
      data-part="root"
      data-state="idle"
      data-variant={variant}
      data-size={size}
      tabIndex={0}
      style={{ position: 'relative', ...style }}
      {...rest}
    >
      {/* Bar */}
      <div
        data-part="bar"
        data-state="idle"
        data-total={total}
        style={{
          display: 'flex',
          width: '100%',
          height: `${barHeight}px`,
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#e0e0e0',
        }}
      >
        {computedSegments.map((seg, i) => {
          const minWidth = seg.count === 0 && total > 0 ? '2px' : undefined;

          return (
            <div
              key={`${seg.label}-${i}`}
              data-part="segment"
              data-state="idle"
              data-choice={seg.label}
              data-percent={formatPercent(seg.percent)}
              data-color={seg.resolvedColor}
              role="img"
              aria-label={`${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`}
              tabIndex={-1}
              style={{
                width: minWidth ?? `${seg.percent}%`,
                minWidth: minWidth,
                backgroundColor: seg.resolvedColor,
                position: 'relative',
              }}
            />
          );
        })}

        {/* Quorum threshold marker */}
        {showQuorum && quorumThreshold > 0 && (
          <div
            data-part="quorum-marker"
            data-state="idle"
            data-visible="true"
            role="img"
            aria-label={`Quorum threshold at ${quorumThreshold}%`}
            style={{
              position: 'absolute',
              left: `${quorumThreshold}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#000',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Segment labels */}
      {showLabels && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            flexWrap: 'wrap',
            gap: '4px 12px',
          }}
        >
          {computedSegments.map((seg, i) => (
            <span
              key={`label-${seg.label}-${i}`}
              data-part="segment-label"
              data-state="idle"
              data-visible="true"
              style={{
                fontSize: size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px',
                color: '#555',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: seg.resolvedColor,
                }}
              />
              {seg.label} {seg.count} ({formatPercent(seg.percent)}%)
            </span>
          ))}
        </div>
      )}

      {/* Total */}
      <span
        data-part="total-label"
        data-state="idle"
        aria-label={`Total votes: ${total}`}
        style={{
          display: 'block',
          marginTop: '4px',
          fontSize: size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px',
          color: '#777',
        }}
      >
        Total: {total}
      </span>

      {children}
    </div>
  );
}

export { VoteResultBar };
