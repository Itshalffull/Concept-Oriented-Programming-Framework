'use client';

/**
 * SpellCheckSuggestionsPopover
 *
 * Tiny popover rendered when the user right-clicks (contextmenu) on a span
 * that carries a spelling or grammar InlineAnnotation.
 *
 * Behaviour
 * ─────────
 * - Appears at cursor position (clientX / clientY from the contextmenu event).
 * - Shows up to 8 suggestions from the annotation's `scope` JSON payload.
 * - Clicking a suggestion:
 *     1. Updates the block's textContent via `ContentNode/update` (body field).
 *     2. Calls `resolveAnnotation()` in the dispatcher to accept the annotation.
 *     3. Closes itself.
 * - When `NEXT_PUBLIC_SPELL_CHECK_API_URL` is absent and there are no
 *   annotations, the popover renders a single "No suggestions available"
 *   item (graceful no-op — the browser's native context menu is unaffected
 *   because we call `preventDefault` only when annotations exist).
 * - Escape or click-outside closes the popover.
 *
 * Usage (wired in RecursiveBlockEditor's contextmenu handler):
 *   <SpellCheckSuggestionsPopover
 *     blockId={nodeId}
 *     annotationId={ann.annotationId}
 *     suggestions={ann.scope.suggestions}
 *     kind={ann.scope.kind}
 *     anchorX={clientX}
 *     anchorY={clientY}
 *     currentText={blockText}
 *     matchStart={ann.scope.start}
 *     matchEnd={ann.scope.end}
 *     onClose={close}
 *   />
 *
 * PRD: docs/plans/block-editor-parity-prd.md (PP-spell-check)
 * Card: PP-spell-check (28c8236f-bf94-4fba-9028-bb7e5485fd25)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { resolveAnnotation } from '../../services/spell-check-dispatcher';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SpellCheckSuggestionsPopoverProps {
  /** ContentNode id of the block that owns the annotated text. */
  blockId: string;
  /** InlineAnnotation id, used for resolving after suggestion is applied. */
  annotationId: string;
  /** Replacement suggestions (may be empty). */
  suggestions: string[];
  /** Kind of issue — affects label colour. */
  kind: 'spelling' | 'grammar';
  /** Viewport X coordinate for popover position (from contextmenu event). */
  anchorX: number;
  /** Viewport Y coordinate for popover position (from contextmenu event). */
  anchorY: number;
  /** Full current plain text of the block. */
  currentText: string;
  /** Start character offset of the flagged range within currentText. */
  matchStart: number;
  /** End character offset (exclusive) of the flagged range. */
  matchEnd: number;
  /** Called when the popover should close (suggestion applied or dismissed). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SpellCheckSuggestionsPopover: React.FC<SpellCheckSuggestionsPopoverProps> = ({
  blockId,
  annotationId,
  suggestions,
  kind,
  anchorX,
  anchorY,
  currentText,
  matchStart,
  matchEnd,
  onClose,
}) => {
  const invoke = useKernelInvoke();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    function handlePointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  // Apply a suggestion: patch block text + resolve the annotation.
  const applySuggestion = useCallback(async (replacement: string) => {
    const newText =
      currentText.slice(0, matchStart) + replacement + currentText.slice(matchEnd);

    try {
      await invoke('ContentNode', 'update', {
        node: blockId,
        body: newText,
      });
    } catch (err) {
      console.warn('[SpellCheckSuggestionsPopover] ContentNode/update failed:', err);
    }

    try {
      await resolveAnnotation(blockId, annotationId, invoke);
    } catch (err) {
      console.warn('[SpellCheckSuggestionsPopover] resolveAnnotation failed:', err);
    }

    onClose();
  }, [blockId, annotationId, currentText, matchStart, matchEnd, invoke, onClose]);

  // Prevent the popover itself from triggering pointer-outside handler.
  const stopPropagation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const kindColor =
    kind === 'spelling'
      ? 'var(--palette-annotation-spelling, #e53935)'
      : 'var(--palette-annotation-grammar, #fb8c00)';

  const popoverContent = (
    <div
      ref={popoverRef}
      data-part="spell-check-popover"
      data-kind={kind}
      role="menu"
      aria-label={`${kind === 'spelling' ? 'Spelling' : 'Grammar'} suggestions`}
      onPointerDown={stopPropagation}
      style={{
        position: 'fixed',
        left: anchorX,
        top: anchorY,
        zIndex: 9999,
        background: 'var(--palette-surface, #ffffff)',
        border: '1px solid var(--palette-outline, #e0e0e0)',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        minWidth: '160px',
        maxWidth: '280px',
        overflow: 'hidden',
        fontFamily: 'var(--typography-family-sans, sans-serif)',
        fontSize: '13px',
      }}
    >
      {/* Kind badge */}
      <div
        data-part="spell-check-kind"
        style={{
          padding: '6px 12px 4px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: kindColor,
          borderBottom: `1px solid var(--palette-outline, #e0e0e0)`,
        }}
      >
        {kind === 'spelling' ? 'Spelling' : 'Grammar'}
      </div>

      {/* Suggestion list */}
      {suggestions.length === 0 ? (
        <div
          data-part="spell-check-no-suggestions"
          style={{
            padding: '8px 12px',
            color: 'var(--palette-on-surface-variant, #757575)',
            fontStyle: 'italic',
          }}
        >
          No suggestions available
        </div>
      ) : (
        <ul
          role="none"
          style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}
        >
          {suggestions.map((s, i) => (
            <li key={i} role="none">
              <button
                role="menuitem"
                data-part="spell-check-suggestion"
                onClick={() => { void applySuggestion(s); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  color: 'var(--palette-on-surface, #212121)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'var(--palette-surface-container, #f5f5f5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'none';
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Render into document.body via portal so it escapes all scroll/overflow containers.
  if (typeof document === 'undefined') return null;
  return createPortal(popoverContent, document.body);
};

export default SpellCheckSuggestionsPopover;
