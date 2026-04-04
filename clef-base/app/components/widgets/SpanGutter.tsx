'use client';

/**
 * SpanGutter — renders span indicators in the left margin of each block.
 *
 * Shows:
 *   - Colored bars for highlights (with the highlight color)
 *   - Comment bubble icons for comment-target spans
 *   - Quote marks for citation spans
 *   - Link icons for excerpt spans
 *   - "Referenced N times" badge when a span has been embedded as a
 *     snippet-embed or inline reference in other entities (§8.6)
 *   - Version freshness indicators: dashed border + ↻ for outdated spans,
 *     ⚠ icon + faded opacity for orphaned spans (§4.5)
 *
 * Uses the SpanFragment data from useEntitySpans (§4.5).
 * Reference counts are fetched via Reference/getRefs per span (§8.6).
 *
 * This component is narrow (16px wide) and sits to the left of the block
 * content area. Each icon/bar is clickable and calls onSpanClick.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SpanFragment } from '../../../lib/use-entity-spans';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SpanGutterProps {
  /** TextSpan fragments for this block */
  fragments: SpanFragment[];
  /** Called when the user clicks a gutter indicator */
  onSpanClick?: (spanId: string) => void;
}

// ─── Kind → gutter indicator config ─────────────────────────────────────────

interface IndicatorConfig {
  icon: string;
  color: string;
  title: string;
}

const KIND_CONFIG: Record<string, IndicatorConfig> = {
  highlight: {
    icon: '',       // Renders as a colored bar (no icon text)
    color: 'var(--span-color-highlight, rgba(253,224,71,0.7))',
    title: 'Highlight',
  },
  'comment-target': {
    icon: '💬',
    color: 'var(--span-color-comment-target, rgba(251,146,60,0.8))',
    title: 'Comment',
  },
  citation: {
    icon: '"',
    color: 'var(--span-color-citation, rgba(96,165,250,0.8))',
    title: 'Citation',
  },
  excerpt: {
    icon: '↗',
    color: 'var(--span-color-excerpt, rgba(52,211,153,0.8))',
    title: 'Excerpt',
  },
  redaction: {
    icon: '▓',
    color: 'var(--span-color-redaction, rgba(100,100,100,0.7))',
    title: 'Redaction',
  },
  'ai-suggestion': {
    icon: '✦',
    color: 'var(--span-color-ai-suggestion, rgba(167,139,250,0.8))',
    title: 'AI Suggestion',
  },
  'search-result': {
    icon: '⬤',
    color: 'var(--span-color-search-result, rgba(250,204,21,0.8))',
    title: 'Search Result',
  },
};

/** Map a highlight color name to the actual CSS background color. */
const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(253,224,71,0.7)',
  green:  'rgba(52,211,153,0.6)',
  blue:   'rgba(96,165,250,0.6)',
  pink:   'rgba(249,168,212,0.7)',
  purple: 'rgba(196,181,253,0.7)',
};

function resolveHighlightColor(fragment: SpanFragment): string {
  if (fragment.color) {
    return HIGHLIGHT_COLOR_MAP[fragment.color] ?? fragment.color;
  }
  return KIND_CONFIG.highlight.color;
}

// ─── Version freshness styles ──────────────────────────────────────────────

/** Compute additional style properties based on span version freshness (§4.5). */
function freshnessStyles(fragment: SpanFragment): React.CSSProperties {
  switch (fragment.freshness) {
    case 'outdated':
      return {
        border: '1px dashed var(--palette-warning, rgba(234,179,8,0.8))',
        borderRadius: 3,
      };
    case 'orphaned':
      return {
        opacity: 0.5,
      };
    default:
      return {};
  }
}

/** Compute data attributes for version state (for future popover integration). */
function freshnessDataAttrs(fragment: SpanFragment): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (fragment.freshness !== 'current') {
    attrs['data-span-freshness'] = fragment.freshness;
    attrs['data-span-versions-behind'] = String(fragment.versionsBehind);
    attrs['data-span-version-policy'] = fragment.versionPolicy;
  }
  return attrs;
}

// ─── useSpanReferences — fetch referencing entities for each span ───────────
//
// Per §8.6: the citation sync creates Reference entries with source=spanId.
// Reference/getRefs returns { targets: "entityA,entityB" } (comma-joined IDs).

function useSpanReferences(spanIds: string[]): Map<string, string[]> {
  const invoke = useKernelInvoke();
  const [refsBySpan, setRefsBySpan] = useState<Map<string, string[]>>(() => new Map());

  const idsKey = spanIds.slice().sort().join(',');

  useEffect(() => {
    if (spanIds.length === 0) return;

    let cancelled = false;

    async function fetchAll() {
      const entries: Array<[string, string[]]> = await Promise.all(
        spanIds.map(async (spanId) => {
          try {
            const result = await invoke('Reference', 'getRefs', { source: spanId });
            if (result.variant === 'ok' && typeof result.targets === 'string' && (result.targets as string).length > 0) {
              return [spanId, (result.targets as string).split(',').filter(Boolean)] as [string, string[]];
            }
          } catch {
            // Non-fatal — span may simply have no references
          }
          return [spanId, []] as [string, string[]];
        }),
      );
      if (!cancelled) {
        setRefsBySpan(new Map(entries));
      }
    }

    void fetchAll();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, invoke]);

  return refsBySpan;
}

// ─── ReferenceCountBadge — shows "referenced N times" with popover ──────────

interface ReferenceCountBadgeProps {
  spanId: string;
  referencingEntities: string[];
}

const ReferenceCountBadge: React.FC<ReferenceCountBadgeProps> = ({
  spanId,
  referencingEntities,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const count = referencingEntities.length;
  if (count === 0) return null;

  return (
    <div
      ref={ref}
      data-part="span-reference-count"
      style={{ position: 'relative' }}
    >
      <button
        title={`Referenced ${count} time${count !== 1 ? 's' : ''} — click to see where`}
        aria-label={`Span ${spanId} referenced ${count} time${count !== 1 ? 's' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggle}
        style={{
          background: 'none',
          border: '1px solid var(--palette-outline-variant, rgba(120,120,120,0.3))',
          borderRadius: '6px',
          padding: '1px 3px',
          cursor: 'pointer',
          fontSize: '9px',
          lineHeight: 1.2,
          color: 'var(--palette-primary, #6366f1)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {count}x
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Entities referencing this span"
          style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            marginLeft: '4px',
            background: 'var(--palette-surface, #fff)',
            border: '1px solid var(--palette-outline-variant, rgba(120,120,120,0.3))',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '180px',
            maxWidth: '280px',
            zIndex: 200,
            padding: '6px 0',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--palette-on-surface-variant, #666)',
              padding: '4px 10px 6px',
              borderBottom: '1px solid var(--palette-outline-variant, rgba(120,120,120,0.2))',
            }}
          >
            Referenced in {count} {count !== 1 ? 'entities' : 'entity'}
          </div>
          {referencingEntities.map((entityId) => (
            <div
              key={entityId}
              role="option"
              aria-selected={false}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                color: 'var(--palette-on-surface, #111)',
                cursor: 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={entityId}
            >
              {entityId}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SpanGutter Component ───────────────────────────────────────────────────

export const SpanGutter: React.FC<SpanGutterProps> = ({ fragments, onSpanClick }) => {
  if (!fragments || fragments.length === 0) return null;

  // Deduplicate: show at most one indicator per span (a span may produce
  // multiple fragments for this block if it spans sub-block ranges, but we
  // only need one gutter indicator per span).
  const seen = new Set<string>();
  const deduped = fragments.filter((f) => {
    if (seen.has(f.spanId)) return false;
    seen.add(f.spanId);
    return true;
  });

  const spanIds = deduped.map((f) => f.spanId);
  // Reference counts hook — fetches Reference/getRefs for each span (§8.6)
  const refsBySpan = useSpanReferences(spanIds);

  return (
    <div
      data-part="span-gutter"
      aria-label="Span indicators"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        width: 16,
        flexShrink: 0,
        paddingTop: 2,
      }}
    >
      {deduped.map((fragment) => {
        const config = KIND_CONFIG[fragment.kind] ?? KIND_CONFIG.highlight;
        const isHighlight = fragment.kind === 'highlight';
        const color = isHighlight ? resolveHighlightColor(fragment) : config.color;
        const referencingEntities = refsBySpan.get(fragment.spanId) ?? [];

        const freshness = fragment.freshness ?? 'current';
        const fStyles = freshnessStyles(fragment);
        const fAttrs = freshnessDataAttrs(fragment);
        const freshnessTitle =
          freshness === 'outdated'
            ? ` — outdated (${fragment.versionsBehind} version${fragment.versionsBehind !== 1 ? 's' : ''} behind)`
            : freshness === 'orphaned'
              ? ' — orphaned (source deleted or unreachable)'
              : '';

        return (
          <div
            key={fragment.spanId}
            data-part="span-gutter-item"
            {...fAttrs}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative' }}
          >
            <button
              title={`${config.title}${fragment.color ? ` (${fragment.color})` : ''}${freshnessTitle}`}
              onClick={() => onSpanClick?.(fragment.spanId)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: onSpanClick ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 12,
                height: 12,
                ...fStyles,
              }}
            >
              {isHighlight ? (
                // Colored bar for highlight
                <span
                  style={{
                    display: 'block',
                    width: 4,
                    height: 14,
                    borderRadius: 2,
                    background: color,
                    opacity: freshness === 'orphaned' ? 0.5 : 0.9,
                  }}
                />
              ) : (
                // Icon for other kinds
                <span
                  style={{
                    fontSize: '10px',
                    lineHeight: 1,
                    color,
                    opacity: freshness === 'orphaned' ? 0.5 : 0.85,
                    userSelect: 'none',
                  }}
                >
                  {config.icon}
                </span>
              )}
            </button>

            {/* Version freshness overlay icons */}
            {freshness === 'outdated' && (
              <span
                data-part="span-freshness-outdated"
                title="Outdated — click to refresh"
                style={{
                  fontSize: '8px',
                  lineHeight: 1,
                  color: 'var(--palette-warning, rgba(234,179,8,0.9))',
                  userSelect: 'none',
                  position: 'absolute',
                  top: -3,
                  right: -3,
                }}
              >
                ↻
              </span>
            )}
            {freshness === 'orphaned' && (
              <span
                data-part="span-freshness-orphaned"
                title="Orphaned — source no longer available"
                style={{
                  fontSize: '8px',
                  lineHeight: 1,
                  color: 'var(--palette-error, rgba(239,68,68,0.9))',
                  userSelect: 'none',
                  position: 'absolute',
                  top: -3,
                  right: -3,
                }}
              >
                ⚠
              </span>
            )}

            {/* Reference count badge — shows when span is embedded elsewhere (§8.6) */}
            {referencingEntities.length > 0 && (
              <ReferenceCountBadge
                spanId={fragment.spanId}
                referencingEntities={referencingEntities}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SpanGutter;
