'use client';

/**
 * LinkHoverPreview — React adapter for the link-hover-preview.widget spec.
 *
 * Renders a floating popover with the target ContentNode's title, a
 * first-paragraph text snippet, and a jump button that navigates to the
 * target page.
 *
 * Behaviour contract (from widget spec):
 *   - Appears after a 300 ms hover delay (enforced by the caller via
 *     hoverDelayMs, not internally — this component simply renders when open=true).
 *   - Fetches ContentNode/get(targetNodeId) on first open.
 *   - Dismisses when the caller sets open=false (100 ms grace is also
 *     enforced by the caller).
 *   - Focus is never trapped (role=tooltip, informational only).
 *   - Jump button invokes ActionBinding/invoke with binding "link-hover-jump".
 *   - Rendered via createPortal into document.body so it escapes all
 *     scroll/overflow containers.
 *
 * Widget spec: surface/widgets/link-hover-preview.widget
 * Card: PP-link-hover
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkHoverPreviewProps {
  /** ContentNode id of the link target. */
  targetNodeId: string;
  /** Bounding rect of the trigger element — used to position the popover. */
  anchorRect: DOMRect | null;
  /** Whether the popover is currently open. */
  open: boolean;
  /** Max characters for the body snippet. Default 240. */
  maxSnippetChars?: number;
  /** Called when the user requests dismissal (Escape, click-outside). */
  onDismiss: () => void;
}

interface NodePreview {
  title: string;
  snippet: string;
  icon: string;
}

type FsmState =
  | 'hidden'
  | 'loading'
  | 'visible'
  | 'navigating'
  | 'error'
  | 'dismissed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSnippet(body: unknown, maxChars: number): string {
  if (typeof body !== 'string' || body.trim() === '') return '';
  // Take the first non-empty paragraph (plain text, strip markdown tokens).
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstPara = lines[0] ?? '';
  // Strip leading Markdown heading/bullet sigils.
  const stripped = firstPara.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '');
  return stripped.length > maxChars
    ? stripped.slice(0, maxChars) + '\u2026'
    : stripped;
}

function computePosition(
  anchorRect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const GAP = 8;

  // Prefer below-left-aligned; flip up if insufficient space below.
  let left = anchorRect.left;
  let top = anchorRect.bottom + GAP;

  if (top + popoverHeight > vh - GAP) {
    top = anchorRect.top - popoverHeight - GAP;
  }
  if (top < GAP) top = GAP;

  if (left + popoverWidth > vw - GAP) {
    left = vw - popoverWidth - GAP;
  }
  if (left < GAP) left = GAP;

  return { left, top };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LinkHoverPreview: React.FC<LinkHoverPreviewProps> = ({
  targetNodeId,
  anchorRect,
  open,
  maxSnippetChars = 240,
  onDismiss,
}) => {
  const invoke = useKernelInvoke();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [fsmState, setFsmState] = useState<FsmState>('hidden');
  const [preview, setPreview] = useState<NodePreview | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // -------------------------------------------------------------------------
  // Fetch target node data on open
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      setFsmState('dismissed');
      return;
    }

    let cancelled = false;
    setFsmState('loading');

    async function fetchNode() {
      try {
        const result = await invoke('ContentNode', 'get', { node: targetNodeId });
        if (cancelled) return;

        if (result.variant === 'ok') {
          const title = typeof result.title === 'string' && result.title.trim()
            ? result.title
            : (typeof result.node === 'string' ? result.node : targetNodeId);
          const body = result.body ?? result.content ?? '';
          const snippet = extractSnippet(body, maxSnippetChars);
          const icon = typeof result.icon === 'string' ? result.icon : '';
          setPreview({ title, snippet, icon });
          setFsmState('visible');
        } else {
          setFsmState('error');
        }
      } catch {
        if (!cancelled) setFsmState('error');
      }
    }

    void fetchNode();
    return () => { cancelled = true; };
  }, [open, targetNodeId, maxSnippetChars, invoke]);

  // -------------------------------------------------------------------------
  // Position the popover relative to the anchor rect
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open || !anchorRect || !popoverRef.current) return;
    const el = popoverRef.current;
    const { left, top } = computePosition(anchorRect, el.offsetWidth || 320, el.offsetHeight || 140);
    setPosition({ left, top });
  }, [open, anchorRect, fsmState]);

  // -------------------------------------------------------------------------
  // Dismiss on Escape or click outside
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }

    function handlePointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open, onDismiss]);

  // -------------------------------------------------------------------------
  // Jump handler
  // -------------------------------------------------------------------------

  const handleJump = useCallback(async () => {
    if (fsmState !== 'visible') return;
    setFsmState('navigating');
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'link-hover-jump',
        context: JSON.stringify({ targetNodeId }),
      });
      if (result.variant === 'ok') {
        onDismiss();
      } else {
        console.warn('[LinkHoverPreview] link-hover-jump returned non-ok:', result.variant);
        setFsmState('visible');
      }
    } catch (err) {
      console.error('[LinkHoverPreview] navigation failed:', err);
      setFsmState('visible');
    }
  }, [fsmState, targetNodeId, invoke, onDismiss]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!open && fsmState === 'hidden') return null;
  if (typeof document === 'undefined') return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      data-part="root"
      data-state={fsmState}
      data-target-node-id={targetNodeId}
      role="tooltip"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 10000,
        background: 'var(--palette-surface, #ffffff)',
        border: '1px solid var(--palette-outline, #e0e0e0)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        width: '320px',
        maxWidth: '90vw',
        fontFamily: 'var(--typography-family-sans, sans-serif)',
        fontSize: '13px',
        overflow: 'hidden',
        // Allow pointer events so user can move into the popover without it closing.
        pointerEvents: 'auto',
      }}
      // Prevent the click-outside handler from firing when clicking inside the popover.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Loading state */}
      {fsmState === 'loading' && (
        <div
          data-part="loading-spinner"
          aria-hidden="false"
          aria-label="Loading preview"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--palette-on-surface-variant, #757575)',
          }}
        >
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid var(--palette-outline, #e0e0e0)',
              borderTopColor: 'var(--palette-primary, #1976d2)',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          Loading preview…
        </div>
      )}

      {/* Error state */}
      {fsmState === 'error' && (
        <div
          data-part="error-state"
          style={{
            padding: '16px',
            color: 'var(--palette-on-surface-variant, #757575)',
            fontStyle: 'italic',
          }}
        >
          Could not load preview.
        </div>
      )}

      {/* Visible / navigating states */}
      {(fsmState === 'visible' || fsmState === 'navigating') && preview && (
        <>
          {/* Header */}
          <div
            data-part="header"
            style={{
              padding: '10px 14px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: '1px solid var(--palette-outline-variant, #eeeeee)',
            }}
          >
            {preview.icon && (
              <span
                data-part="title-icon"
                aria-hidden="true"
                style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
              >
                {preview.icon}
              </span>
            )}
            <span
              data-part="title-text"
              style={{
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--palette-on-surface, #212121)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {preview.title}
            </span>
          </div>

          {/* Body snippet */}
          <div
            data-part="body"
            style={{ padding: '8px 14px', minHeight: '36px' }}
          >
            {preview.snippet ? (
              <p
                data-part="snippet"
                style={{
                  margin: 0,
                  color: 'var(--palette-on-surface-variant, #616161)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {preview.snippet}
              </p>
            ) : (
              <p
                data-part="empty-state"
                style={{
                  margin: 0,
                  color: 'var(--palette-on-surface-variant, #9e9e9e)',
                  fontStyle: 'italic',
                }}
              >
                No preview available
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            data-part="footer"
            style={{
              padding: '6px 14px 10px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              data-part="jump-button"
              aria-label="Open linked page"
              disabled={fsmState === 'navigating'}
              onClick={() => { void handleJump(); }}
              style={{
                background: 'var(--palette-primary-container, #e3f2fd)',
                color: 'var(--palette-on-primary-container, #0d47a1)',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: fsmState === 'navigating' ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: fsmState === 'navigating' ? 0.7 : 1,
              }}
            >
              {fsmState === 'navigating' ? 'Opening…' : 'Open'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(popoverContent, document.body);
};

export default LinkHoverPreview;
