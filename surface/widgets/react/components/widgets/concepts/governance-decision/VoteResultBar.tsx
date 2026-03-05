/* ---------------------------------------------------------------------------
 * VoteResultBar state machine
 * States: idle (initial), animating, segmentHovered
 * See widget spec: repertoire/concepts/governance-decision/widgets/vote-result-bar.widget
 * ------------------------------------------------------------------------- */

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT'; index: number }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS_NEXT_SEGMENT' }
  | { type: 'FOCUS_PREV_SEGMENT' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/** A single segment in the vote result bar. */
export interface VoteSegment {
  /** Display label for this choice (e.g. "For", "Against", "Abstain"). */
  label: string;
  /** Number of votes for this choice. */
  count: number;
  /** CSS color for this segment. Falls back to a default palette if omitted. */
  color?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Default color palette when segments do not provide their own color. */
const DEFAULT_COLORS = [
  '#4caf50', // green
  '#f44336', // red
  '#ff9800', // orange
  '#2196f3', // blue
  '#9c27b0', // purple
  '#00bcd4', // cyan
  '#795548', // brown
  '#607d8b', // blue-grey
];

/** Compute the percentage a count represents of a total, clamped to [0, 100]. */
function toPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}

/** Format a percentage for display (1 decimal place, no trailing zero). */
function formatPercent(value: number): string {
  const formatted = value.toFixed(1);
  // Strip ".0" for whole numbers
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

/** Size presets mapping size prop to bar height in pixels. */
const SIZE_MAP: Record<string, number> = {
  sm: 16,
  md: 24,
  lg: 36,
};

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface VoteResultBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of vote segments, each with a label, count, and optional color. */
  segments: VoteSegment[];
  /** Total vote count. When omitted, derived as the sum of all segment counts. */
  total?: number;
  /** Display variant: binary (for/against), multi (multiple choices), weighted. */
  variant?: 'binary' | 'multi' | 'weighted';
  /** Whether to display segment labels beneath the bar. */
  showLabels?: boolean;
  /** Whether to render the quorum threshold marker. */
  showQuorum?: boolean;
  /** Quorum threshold as a percentage (0-100). */
  quorumThreshold?: number;
  /** Whether to animate segment widths on mount. */
  animate?: boolean;
  /** Bar height preset. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback fired when a segment is hovered. */
  onSegmentHover?: (index: number | null, segment: VoteSegment | null) => void;
  /** Optional children rendered after the bar (slot content). */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const VoteResultBar = forwardRef<HTMLDivElement, VoteResultBarProps>(function VoteResultBar(
  {
    segments,
    total: totalProp,
    variant = 'binary',
    showLabels = true,
    showQuorum = false,
    quorumThreshold = 0,
    animate = true,
    size = 'md',
    onSegmentHover,
    children,
    style,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(voteResultBarReducer, 'idle');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [animated, setAnimated] = useState(!animate);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Derived: compute total from segments if not provided */
  const total = useMemo(() => {
    if (totalProp != null && totalProp > 0) return totalProp;
    return segments.reduce((sum, seg) => sum + seg.count, 0);
  }, [totalProp, segments]);

  /* Derived: segment percentages and colors */
  const computedSegments = useMemo(() => {
    return segments.map((seg, i) => ({
      ...seg,
      percent: toPercent(seg.count, total),
      resolvedColor: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));
  }, [segments, total]);

  /* Derived: ARIA description summarizing all segments */
  const ariaDescription = useMemo(() => {
    const parts = computedSegments.map(
      (seg) => `${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`,
    );
    return `Vote results: ${parts.join(', ')}. Total: ${total} votes.`;
  }, [computedSegments, total]);

  /* Animation on mount: start with zero widths, then expand after a frame */
  useEffect(() => {
    if (!animate) {
      setAnimated(true);
      return;
    }

    // Check prefers-reduced-motion
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setAnimated(true);
      return;
    }

    send({ type: 'ANIMATE_IN' });

    // Start animation after a frame so the browser can paint zero-width first
    const frameId = requestAnimationFrame(() => {
      setAnimated(true);
      animationTimerRef.current = setTimeout(() => {
        send({ type: 'ANIMATION_END' });
      }, 400);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [animate]);

  /* Segment hover handler */
  const handleSegmentMouseEnter = useCallback(
    (index: number) => {
      setHoveredIndex(index);
      send({ type: 'HOVER_SEGMENT', index });
      onSegmentHover?.(index, segments[index] ?? null);
    },
    [segments, onSegmentHover],
  );

  const handleSegmentMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    send({ type: 'UNHOVER' });
    onSegmentHover?.(null, null);
  }, [onSegmentHover]);

  /* Keyboard navigation: ArrowLeft/ArrowRight to move focus between segments */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (segments.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = focusedIndex < segments.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(next);
        setHoveredIndex(next);
        send({ type: 'HOVER_SEGMENT', index: next });
        onSegmentHover?.(next, segments[next] ?? null);
        segmentRefs.current[next]?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = focusedIndex > 0 ? focusedIndex - 1 : segments.length - 1;
        setFocusedIndex(prev);
        setHoveredIndex(prev);
        send({ type: 'HOVER_SEGMENT', index: prev });
        onSegmentHover?.(prev, segments[prev] ?? null);
        segmentRefs.current[prev]?.focus();
      } else if (e.key === 'Escape') {
        setHoveredIndex(null);
        setFocusedIndex(-1);
        send({ type: 'UNHOVER' });
        onSegmentHover?.(null, null);
      }
    },
    [focusedIndex, segments, onSegmentHover],
  );

  const barHeight = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Vote results"
      aria-roledescription="vote result bar"
      aria-description={ariaDescription}
      data-surface-widget=""
      data-widget-name="vote-result-bar"
      data-part="root"
      data-state={state}
      data-variant={variant}
      data-size={size}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        ...style,
      }}
      {...rest}
    >
      {/* Horizontal bar with proportional segments */}
      <div
        data-part="bar"
        data-state={state}
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
          const isHovered = hoveredIndex === i;
          const isFocused = focusedIndex === i;
          const widthPercent = animated ? seg.percent : 0;
          // Zero-vote segments render as a thin 2px line per invariant
          const minWidth = seg.count === 0 && total > 0 ? '2px' : undefined;

          const segmentStyle: CSSProperties = {
            width: minWidth ?? `${widthPercent}%`,
            minWidth: minWidth,
            backgroundColor: seg.resolvedColor,
            transition: animate ? 'width 0.4s ease-out, opacity 0.2s ease' : undefined,
            opacity: hoveredIndex !== null && !isHovered ? 0.5 : 1,
            position: 'relative',
            cursor: 'pointer',
            outline: isFocused ? '2px solid #1a73e8' : undefined,
            outlineOffset: isFocused ? '-2px' : undefined,
          };

          return (
            <div
              key={`${seg.label}-${i}`}
              ref={(el) => { segmentRefs.current[i] = el; }}
              data-part="segment"
              data-state={state}
              data-choice={seg.label}
              data-percent={formatPercent(seg.percent)}
              data-color={seg.resolvedColor}
              data-hovered={isHovered ? 'true' : undefined}
              role="img"
              aria-label={`${seg.label}: ${seg.count} votes (${formatPercent(seg.percent)}%)`}
              tabIndex={-1}
              style={segmentStyle}
              onMouseEnter={() => handleSegmentMouseEnter(i)}
              onMouseLeave={handleSegmentMouseLeave}
              onFocus={() => {
                setFocusedIndex(i);
                handleSegmentMouseEnter(i);
              }}
              onBlur={() => {
                setFocusedIndex(-1);
                handleSegmentMouseLeave();
              }}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '4px',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    color: '#fff',
                    fontSize: '12px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  {seg.label}: {seg.count} votes ({formatPercent(seg.percent)}%)
                </div>
              )}
            </div>
          );
        })}

        {/* Quorum threshold marker */}
        {showQuorum && quorumThreshold > 0 && (
          <div
            data-part="quorum-marker"
            data-state={state}
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

      {/* Segment labels beneath the bar */}
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
              data-state={state}
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

      {/* Total vote count */}
      <span
        data-part="total-label"
        data-state={state}
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
});

VoteResultBar.displayName = 'VoteResultBar';
export { VoteResultBar };
export default VoteResultBar;
