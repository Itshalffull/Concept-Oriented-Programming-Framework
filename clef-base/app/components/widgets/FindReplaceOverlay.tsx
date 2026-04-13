'use client';

/**
 * FindReplaceOverlay — React adapter for find-replace-overlay.widget.
 *
 * Walks the current page's Outline block children, collects their text
 * content from [data-part="block-content"] DOM nodes, and computes match
 * ranges for the current query string. Matching highlight spans are injected
 * as absolutely-positioned decoration marks inside the decoration-layer
 * mounted in RecursiveBlockEditor. Navigation (prev/next) scrolls the
 * active match into view. Replace dispatches Patch via the burst-tracker
 * ActionBinding so each replacement lands in UndoStack and can be reversed
 * with Cmd+Z.
 *
 * Widget spec: surface/widgets/find-replace-overlay.widget
 * PRD card: PP-find-replace
 *
 * Mount point: RecursiveBlockEditor mounts this when Cmd+F fires via
 * ModalStackProvider, passing rootNodeId as a prop. The overlay is
 * registered as a decoration-layer plugin so the SlotMount infrastructure
 * can auto-mount it, but the keyboard shortcut approach is also supported.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindReplaceOverlayProps {
  /** Root page node id — used to scope Outline/children and Patch targets. */
  rootNodeId: string;
  /** Called when the overlay should close (Escape or close button). */
  onClose: () => void;
  /** Whether the editor is in writable mode — disables Replace controls when false. */
  canEdit: boolean;
}

// A single match location within a block's text.
interface MatchRange {
  /** ContentNode id of the block containing the match. */
  blockId: string;
  /** Character offset of the match start within the block text. */
  start: number;
  /** Character offset of the match end (exclusive) within the block text. */
  end: number;
  /** Full text of the block — needed for Patch content assembly. */
  blockText: string;
}

// FSM state — mirrors find-replace-overlay.widget phase machine.
type OverlayPhase = 'idle' | 'searching' | 'replacing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * computeMatches — walk all [data-part="block-content"] elements that are
 * descendants of [data-part="center-pane"] and collect ranges matching query.
 * Case-insensitive literal match (not regex) for predictable UX.
 */
function computeMatches(query: string): MatchRange[] {
  if (!query) return [];
  const lower = query.toLowerCase();

  const centerPane = document.querySelector('[data-part="center-pane"]');
  if (!centerPane) return [];

  const blockEls = Array.from(
    centerPane.querySelectorAll<HTMLElement>('[data-part="block-content"]'),
  );

  const matches: MatchRange[] = [];

  for (const el of blockEls) {
    const blockSlot = el.closest<HTMLElement>('[data-part="block-slot"]');
    const blockId = blockSlot?.dataset.nodeId ?? '';
    if (!blockId) continue;

    const text = el.textContent ?? '';
    const lowerText = text.toLowerCase();
    let idx = 0;

    while (true) {
      const pos = lowerText.indexOf(lower, idx);
      if (pos === -1) break;
      matches.push({ blockId, start: pos, end: pos + query.length, blockText: text });
      idx = pos + query.length;
    }
  }

  return matches;
}

/**
 * scrollMatchIntoView — scrolls the DOM element for a given blockId match
 * into view and applies a transient focus-outline style.
 */
function scrollMatchIntoView(blockId: string): void {
  const el = document.querySelector<HTMLElement>(
    `[data-part="block-slot"][data-node-id="${blockId}"]`,
  );
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Briefly highlight the container so the user can orient their eye
    const prev = el.style.outline;
    el.style.outline = '2px solid var(--palette-primary, #1a73e8)';
    setTimeout(() => { el.style.outline = prev; }, 800);
  }
}

/**
 * buildReplaceContent — given a block's full text and a single match range,
 * produce the new full block text after replacing that one occurrence.
 */
function buildReplaceContent(blockText: string, match: MatchRange, replacement: string): string {
  return blockText.slice(0, match.start) + replacement + blockText.slice(match.end);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FindReplaceOverlay: React.FC<FindReplaceOverlayProps> = ({
  rootNodeId,
  onClose,
  canEdit,
}) => {
  const invoke = useKernelInvoke();

  // ── FSM ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<OverlayPhase>('idle');

  // ── Query & replace state ─────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');

  // ── Match state ───────────────────────────────────────────────────────────
  const [matches, setMatches] = useState<MatchRange[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // ── Match computation ─────────────────────────────────────────────────────
  // Re-run whenever query changes.
  useEffect(() => {
    const found = computeMatches(query);
    setMatches(found);
    setActiveIndex(0);

    if (!query) {
      setPhase('idle');
    } else {
      setPhase((prev) => prev === 'replacing' ? 'replacing' : 'searching');
    }
  }, [query]);

  // ── Derived values ────────────────────────────────────────────────────────
  const hasMatches = matches.length > 0;
  const activeMatch = hasMatches ? matches[activeIndex] : null;

  const counterLabel = useMemo(() => {
    if (!query) return '';
    if (!hasMatches) return 'No matches';
    return `${activeIndex + 1} of ${matches.length}`;
  }, [query, hasMatches, activeIndex, matches.length]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!hasMatches) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    scrollMatchIntoView(matches[next].blockId);
  }, [hasMatches, activeIndex, matches]);

  const goPrev = useCallback(() => {
    if (!hasMatches) return;
    const prev = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prev);
    scrollMatchIntoView(matches[prev].blockId);
  }, [hasMatches, activeIndex, matches]);

  // ── Replace one ───────────────────────────────────────────────────────────
  const replaceOne = useCallback(async () => {
    if (!activeMatch || !canEdit) return;

    const newContent = buildReplaceContent(activeMatch.blockText, activeMatch, replacement);

    try {
      // Dispatch through the burst-tracker binding so UndoStack gets the patch.
      // The burst-tracker binding wraps Patch/create + UndoStack/push.
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'update-block-content',
        context: JSON.stringify({
          nodeId: activeMatch.blockId,
          rootNodeId,
          schema: '',            // schema resolved server-side by binding
          content: newContent,
        }),
      });
      if (result.variant !== 'ok') {
        console.warn('[FindReplaceOverlay] replace-one returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[FindReplaceOverlay] replace-one failed:', err);
    }

    // Refresh matches after replacement
    const refreshed = computeMatches(query);
    setMatches(refreshed);
    // Keep active index in bounds
    setActiveIndex((prev) => Math.min(prev, Math.max(refreshed.length - 1, 0)));
  }, [activeMatch, canEdit, replacement, rootNodeId, query, invoke]);

  // ── Replace all ───────────────────────────────────────────────────────────
  const replaceAll = useCallback(async () => {
    if (!hasMatches || !canEdit) return;

    // Group matches by block so we can apply one Patch per block, in reverse
    // order within each block to preserve character offsets.
    const byBlock = new Map<string, MatchRange[]>();
    for (const m of matches) {
      if (!byBlock.has(m.blockId)) byBlock.set(m.blockId, []);
      byBlock.get(m.blockId)!.push(m);
    }

    for (const [blockId, blockMatches] of byBlock.entries()) {
      // Sort descending by start so we replace from end-to-start within block.
      const sorted = [...blockMatches].sort((a, b) => b.start - a.start);
      let text = sorted[0].blockText;

      for (const m of sorted) {
        text = buildReplaceContent({ ...m, blockText: text }, m, replacement);
      }

      try {
        const result = await invoke('ActionBinding', 'invoke', {
          binding: 'update-block-content',
          context: JSON.stringify({
            nodeId: blockId,
            rootNodeId,
            schema: '',
            content: text,
          }),
        });
        if (result.variant !== 'ok') {
          console.warn('[FindReplaceOverlay] replace-all block returned non-ok:', result.variant, blockId);
        }
      } catch (err) {
        console.error('[FindReplaceOverlay] replace-all block failed:', err, blockId);
      }
    }

    // Refresh matches — all replaced, expect empty
    const refreshed = computeMatches(query);
    setMatches(refreshed);
    setActiveIndex(0);
  }, [hasMatches, canEdit, matches, replacement, rootNodeId, query, invoke]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      goNext();
    } else if (e.key === 'F3' && !e.shiftKey) {
      e.preventDefault();
      goNext();
    } else if (e.key === 'F3' && e.shiftKey) {
      e.preventDefault();
      goPrev();
    }
  }, [onClose, goNext, goPrev]);

  // ── Replace input change → FSM transition ─────────────────────────────────
  const handleReplaceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReplacement(val);
    if (query) {
      setPhase(val ? 'replacing' : 'searching');
    }
  }, [query]);

  // ── Render ────────────────────────────────────────────────────────────────

  const buttonBase: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: '1px solid var(--palette-outline)',
    background: 'var(--palette-surface-container)',
    color: 'var(--palette-on-surface)',
    lineHeight: 1.4,
  };

  const buttonDisabled: React.CSSProperties = {
    ...buttonBase,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '13px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--palette-outline)',
    background: 'var(--palette-surface)',
    color: 'var(--palette-on-surface)',
    outline: 'none',
    minWidth: 0,
  };

  return (
    <div
      data-part="root"
      data-state={phase}
      data-widget="find-replace-overlay"
      role="dialog"
      aria-label="Find and replace"
      aria-modal="false"
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 20,
        background: 'var(--palette-surface, #fff)',
        border: '1px solid var(--palette-outline)',
        borderRadius: '8px',
        boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.15))',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '340px',
        maxWidth: '420px',
        fontSize: '13px',
      }}
    >
      {/* ── Search row ── */}
      <div
        data-part="search-row"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <input
          ref={searchInputRef}
          data-part="search-input"
          type="text"
          value={query}
          placeholder="Find..."
          aria-label="Find"
          role="searchbox"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />

        <span
          data-part="match-counter"
          data-has-matches={hasMatches ? 'true' : 'false'}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontSize: '11px',
            color: 'var(--palette-on-surface-variant)',
            whiteSpace: 'nowrap',
            minWidth: '56px',
            textAlign: 'right',
          }}
        >
          {counterLabel}
        </span>

        <button
          data-part="prev-button"
          disabled={!hasMatches}
          onClick={goPrev}
          aria-label="Previous match"
          style={hasMatches ? buttonBase : buttonDisabled}
          title="Previous match (Shift+F3)"
        >
          ▲
        </button>

        <button
          data-part="next-button"
          disabled={!hasMatches}
          onClick={goNext}
          aria-label="Next match"
          style={hasMatches ? buttonBase : buttonDisabled}
          title="Next match (Enter / F3)"
        >
          ▼
        </button>

        <button
          data-part="close-button"
          onClick={onClose}
          aria-label="Close find and replace"
          style={{ ...buttonBase, padding: '2px 6px' }}
          title="Close (Escape)"
        >
          ✕
        </button>
      </div>

      {/* ── Replace row ── */}
      {canEdit && (
        <div
          data-part="replace-row"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <input
            ref={replaceInputRef}
            data-part="replace-input"
            type="text"
            value={replacement}
            placeholder="Replace..."
            aria-label="Replace with"
            onChange={handleReplaceChange}
            onKeyDown={handleKeyDown}
            style={inputStyle}
          />

          <button
            data-part="replace-one-button"
            disabled={!hasMatches}
            onClick={replaceOne}
            aria-label="Replace current match"
            style={hasMatches ? buttonBase : buttonDisabled}
            title="Replace"
          >
            Replace
          </button>

          <button
            data-part="replace-all-button"
            disabled={!hasMatches}
            onClick={replaceAll}
            aria-label="Replace all matches"
            style={hasMatches ? buttonBase : buttonDisabled}
            title="Replace all"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
};
