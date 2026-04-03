'use client';

/**
 * SpanMergeSplit — toolbar buttons for TextSpan split and merge operations.
 *
 * Implements §2.3 of text-span-addressing.md (split/merge actions).
 *
 * SplitSpanButton:
 *   Shown when a single span is selected and the cursor is positioned inside it.
 *   Calls TextSpan/split with the span ID and a newly-created TextAnchor at the
 *   cursor position. On success, the original span is removed and two new spans
 *   take its place (before-half and after-half of the split point).
 *
 * MergeSpansButton:
 *   Shown when exactly two spans of the same kind are selected (adjacent or
 *   overlapping). Calls TextSpan/merge with both span IDs. On success, one
 *   combined span covers from spanA's start to spanB's end.
 *
 * Both components follow the same button style used in SpanToolbar and call
 * the kernel via useKernelInvoke.
 */

import React, { useState, useCallback } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ─── ID generator (mirrors use-text-selection.ts) ───────────────────────────

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Shared button style (matches SpanToolbar) ───────────────────────────────

function makeButtonStyle(loading: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: 'var(--palette-inverse-on-surface, #fff)',
    padding: '4px 8px',
    cursor: loading ? 'not-allowed' : 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    lineHeight: 1,
    opacity: loading ? 0.5 : 1,
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };
}

// ─── CursorPosition — describes where the cursor sits within a block ─────────

/**
 * CursorPosition describes the precise in-block cursor location that will
 * become the split anchor. Callers derive this from the Selection API when the
 * cursor is collapsed (no text selected) inside a span.
 */
export interface CursorPosition {
  /** BlockId of the block containing the cursor */
  blockId: string;
  /** Character offset within the block's plain text */
  offset: number;
  /** ~30 characters before the cursor (for anchor relocation) */
  prefix: string;
  /** ~30 characters after the cursor (for anchor relocation) */
  suffix: string;
}

// ─── SplitSpanButton ─────────────────────────────────────────────────────────

export interface SplitSpanButtonProps {
  /**
   * ID of the span to split.
   * The span must already exist in the TextSpan concept store.
   */
  spanId: string;
  /**
   * ContentNode ID that owns the span.
   * Used when creating the split-point TextAnchor.
   */
  entityRef: string;
  /**
   * Current cursor position inside the span.
   * The split operation divides the span at this point.
   */
  cursorPosition: CursorPosition;
  /**
   * Called after a successful split, with the two new span IDs.
   * Consumers should use this to refresh span lists and update UI state.
   */
  onSplit?: (beforeId: string, afterId: string) => void;
  /** Called on any error so the host can show a notification. */
  onError?: (message: string) => void;
}

/**
 * SplitSpanButton — scissors icon button that splits a span at the cursor.
 *
 * Flow:
 *   1. Create a TextAnchor at cursorPosition (blockId, offset, prefix, suffix)
 *   2. Call TextSpan/split with (spanId, anchorId)
 *   3. Report the two new span IDs via onSplit
 *
 * Shown in the span toolbar when:
 *   - Exactly one span is active at the cursor
 *   - The cursor is collapsed (no text selected) inside that span
 */
export const SplitSpanButton: React.FC<SplitSpanButtonProps> = ({
  spanId,
  entityRef,
  cursorPosition,
  onSplit,
  onError,
}) => {
  const invoke = useKernelInvoke();
  const [loading, setLoading] = useState(false);

  const handleSplit = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Step 1 — create a TextAnchor at the cursor position
      const anchorId = newId('anchor');
      const anchorResult = await invoke('TextAnchor', 'create', {
        anchor: anchorId,
        entityRef,
        blockId: cursorPosition.blockId,
        offset: cursorPosition.offset,
        prefix: cursorPosition.prefix,
        suffix: cursorPosition.suffix,
        contentHash: '',
      });

      if (anchorResult.variant !== 'ok') {
        onError?.('Could not create split anchor — TextAnchor/create failed');
        return;
      }

      // Step 2 — split the span at the new anchor
      const splitResult = await invoke('TextSpan', 'split', {
        span: spanId,
        splitAnchor: anchorId,
      });

      if (splitResult.variant === 'ok') {
        onSplit?.(splitResult.before as string, splitResult.after as string);
      } else if (splitResult.variant === 'notfound') {
        onError?.(`Span "${spanId}" was not found — it may have been deleted`);
      } else {
        onError?.(
          (splitResult.message as string | undefined) ?? 'Split failed — the cursor may be at a span boundary',
        );
      }
    } catch (err) {
      onError?.(`Split failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [invoke, loading, spanId, entityRef, cursorPosition, onSplit, onError]);

  return (
    <button
      data-part="split-span-button"
      aria-label="Split span at cursor"
      title="Split span at cursor position"
      disabled={loading}
      onMouseDown={(e) => {
        // preventDefault keeps the selection/cursor position intact
        e.preventDefault();
        void handleSplit();
      }}
      style={makeButtonStyle(loading)}
    >
      {/* Scissors icon — Unicode scissors U+2702 */}
      <span style={{ fontSize: '15px' }} aria-hidden="true">&#x2702;</span>
      {loading && (
        <span style={{ fontSize: '11px', opacity: 0.7 }}>…</span>
      )}
    </button>
  );
};

// ─── MergeSpansButton ─────────────────────────────────────────────────────────

export interface MergeSpansButtonProps {
  /**
   * The first span ID (should be the earlier span in document order).
   */
  spanIdA: string;
  /**
   * The second span ID (should be the later span in document order).
   */
  spanIdB: string;
  /**
   * Called after a successful merge, with the new merged span ID.
   * Consumers should use this to refresh span lists and update UI state.
   */
  onMerge?: (mergedId: string) => void;
  /** Called on any error so the host can show a notification. */
  onError?: (message: string) => void;
}

/**
 * MergeSpansButton — merge icon button that combines two spans into one.
 *
 * Flow:
 *   1. Call TextSpan/merge with (spanIdA, spanIdB)
 *   2. Report the new merged span ID via onMerge
 *
 * The merged span runs from spanA's startAnchor to spanB's endAnchor.
 * Both original spans are removed by the handler.
 *
 * Shown in the span toolbar when:
 *   - Exactly two spans are selected
 *   - Both spans belong to the same entity
 *   - Both spans are of the same kind (enforced by caller)
 */
export const MergeSpansButton: React.FC<MergeSpansButtonProps> = ({
  spanIdA,
  spanIdB,
  onMerge,
  onError,
}) => {
  const invoke = useKernelInvoke();
  const [loading, setLoading] = useState(false);

  const handleMerge = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const mergeResult = await invoke('TextSpan', 'merge', {
        spanA: spanIdA,
        spanB: spanIdB,
      });

      if (mergeResult.variant === 'ok') {
        onMerge?.(mergeResult.merged as string);
      } else {
        onError?.(
          (mergeResult.message as string | undefined) ??
            'Merge failed — spans may belong to different entities or one no longer exists',
        );
      }
    } catch (err) {
      onError?.(`Merge failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [invoke, loading, spanIdA, spanIdB, onMerge, onError]);

  return (
    <button
      data-part="merge-spans-button"
      aria-label={`Merge spans ${spanIdA} and ${spanIdB}`}
      title="Merge selected spans into one"
      disabled={loading}
      onMouseDown={(e) => {
        e.preventDefault();
        void handleMerge();
      }}
      style={makeButtonStyle(loading)}
    >
      {/* Merge icon — left-right double arrow U+21C6 */}
      <span style={{ fontSize: '14px' }} aria-hidden="true">&#x21C6;</span>
      {loading && (
        <span style={{ fontSize: '11px', opacity: 0.7 }}>…</span>
      )}
    </button>
  );
};

// ─── SpanOperationsToolbar — composed toolbar for split/merge context ─────────

/**
 * SpanOperationsToolbar is the assembled span-level toolbar that appears when
 * the user's interaction context switches from "text selection" (new spans) to
 * "span management" (operating on existing spans).
 *
 * It renders the appropriate button(s) based on which spans are active:
 *   - One span + collapsed cursor inside it → SplitSpanButton
 *   - Two spans of the same kind selected  → MergeSpansButton
 *   - Both conditions true simultaneously  → both buttons
 *
 * This component is positioned by the caller (typically SpanToolbar or the
 * BlockEditor host) using the same fixed-position pattern as SpanToolbar.
 */

export interface SpanOperationsToolbarProps {
  /**
   * Vertical position (fixed, from top of viewport) for the toolbar.
   */
  top: number;
  /**
   * Horizontal position (fixed, from left of viewport) for the toolbar.
   */
  left: number;
  /**
   * When provided and the cursor is inside a single span, SplitSpanButton
   * is shown. Requires cursorPosition to also be provided.
   */
  activeSingleSpan?: {
    spanId: string;
    entityRef: string;
  };
  /**
   * Cursor position within the active single span.
   * Required for SplitSpanButton to be rendered.
   */
  cursorPosition?: CursorPosition;
  /**
   * When provided with exactly two span entries of the same kind,
   * MergeSpansButton is shown.
   */
  adjacentSpanPair?: {
    spanIdA: string;
    spanIdB: string;
    kind: string;
  };
  onSplit?: (beforeId: string, afterId: string) => void;
  onMerge?: (mergedId: string) => void;
  onError?: (message: string) => void;
}

export const SpanOperationsToolbar: React.FC<SpanOperationsToolbarProps> = ({
  top,
  left,
  activeSingleSpan,
  cursorPosition,
  adjacentSpanPair,
  onSplit,
  onMerge,
  onError,
}) => {
  const showSplit = !!(activeSingleSpan && cursorPosition);
  const showMerge = !!adjacentSpanPair;

  if (!showSplit && !showMerge) return null;

  return (
    <div
      data-part="span-operations-toolbar"
      role="toolbar"
      aria-label="Span operations"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 1200,
        background: 'var(--palette-inverse-surface, #1a1a2e)',
        borderRadius: 'var(--radius-md)',
        padding: '2px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.2))',
        userSelect: 'none',
      }}
    >
      {showSplit && (
        <SplitSpanButton
          spanId={activeSingleSpan!.spanId}
          entityRef={activeSingleSpan!.entityRef}
          cursorPosition={cursorPosition!}
          onSplit={onSplit}
          onError={onError}
        />
      )}

      {showSplit && showMerge && (
        // Separator between split and merge buttons
        <div style={{
          width: 1,
          height: 20,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 2px',
          flexShrink: 0,
        }} />
      )}

      {showMerge && (
        <MergeSpansButton
          spanIdA={adjacentSpanPair!.spanIdA}
          spanIdB={adjacentSpanPair!.spanIdB}
          onMerge={onMerge}
          onError={onError}
        />
      )}
    </div>
  );
};

export default SpanOperationsToolbar;
