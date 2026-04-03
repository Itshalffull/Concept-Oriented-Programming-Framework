'use client';

/**
 * SpanGutter — renders span indicators in the left margin of each block.
 *
 * Shows:
 *   - Colored bars for highlights (with the highlight color)
 *   - Comment bubble icons for comment-target spans
 *   - Quote marks for citation spans
 *   - Link icons for excerpt spans
 *
 * Uses the SpanFragment data from useEntitySpans (§4.5).
 *
 * This component is narrow (16px wide) and sits to the left of the block
 * content area. Each icon/bar is clickable and calls onSpanClick.
 */

import React from 'react';
import type { SpanFragment } from '../../../lib/use-entity-spans';

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

        return (
          <button
            key={fragment.spanId}
            title={`${config.title}${fragment.color ? ` (${fragment.color})` : ''}`}
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
                  opacity: 0.9,
                }}
              />
            ) : (
              // Icon for other kinds
              <span
                style={{
                  fontSize: '10px',
                  lineHeight: 1,
                  color,
                  opacity: 0.85,
                  userSelect: 'none',
                }}
              >
                {config.icon}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default SpanGutter;
