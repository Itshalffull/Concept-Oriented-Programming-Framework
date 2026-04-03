'use client';

/**
 * SpanToolbar — floating toolbar that appears when text is selected inside a
 * BlockEditor, allowing users to create TextSpan records of various kinds.
 *
 * Implements §4.3 of text-span-addressing.md.
 *
 * Buttons:
 *   - Highlight (with color picker: yellow/green/blue/pink/purple)
 *   - Comment (creates comment-target span, future: opens comment panel)
 *   - Cite (creates citation span)
 *   - Excerpt (creates excerpt span)
 *   - Copy Snippet Reference — creates span, copies ((entityRef#span=spanId))
 *   - Copy Link — copies /content/{entityRef}#span={spanId}
 *
 * The toolbar positions itself near the active text selection using the
 * Selection API. It dismisses on click-outside or Escape.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TextSelectionState } from '../../../lib/use-text-selection';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SpanToolbarProps {
  /**
   * Current text selection state from useTextSelection.
   * Toolbar is only shown when selection.hasSelection is true.
   */
  selection: TextSelectionState;
  /**
   * ContentNode ID the spans will be created in.
   * Required to build reference strings.
   */
  entityRef: string;
  /**
   * Function returned by useTextSelection that creates TextAnchor + TextSpan
   * records and returns the new span ID.
   */
  createSpanFromSelection: (
    entityRef: string,
    kind: string,
    label?: string,
  ) => Promise<string | null>;
  /** Called when the toolbar should be dismissed (e.g. after an action) */
  onDismiss?: () => void;
}

// ─── Highlight Colors ───────────────────────────────────────────────────────

const HIGHLIGHT_COLORS: Array<{ label: string; value: string; bg: string }> = [
  { label: 'Yellow',  value: 'yellow',  bg: 'rgba(253,224,71,0.7)' },
  { label: 'Green',   value: 'green',   bg: 'rgba(52,211,153,0.6)' },
  { label: 'Blue',    value: 'blue',    bg: 'rgba(96,165,250,0.6)' },
  { label: 'Pink',    value: 'pink',    bg: 'rgba(249,168,212,0.7)' },
  { label: 'Purple',  value: 'purple',  bg: 'rgba(196,181,253,0.7)' },
];

// ─── Toast ──────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  key: number;
}

// ─── SpanToolbar Component ──────────────────────────────────────────────────

export const SpanToolbar: React.FC<SpanToolbarProps> = ({
  selection,
  entityRef,
  createSpanFromSelection,
  onDismiss,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position toolbar near the selection
  useEffect(() => {
    if (!selection.hasSelection) {
      setPosition(null);
      setShowColorPicker(false);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    // Position toolbar above the selection, centered horizontally
    const toolbarWidth = 300;
    const left = Math.max(8, Math.min(
      rect.left + rect.width / 2 - toolbarWidth / 2,
      window.innerWidth - toolbarWidth - 8,
    ));
    const top = rect.top - 48; // 48px above selection

    setPosition({ top, left });
  }, [selection]);

  // Dismiss on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Dismiss on click outside the toolbar
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onDismiss?.();
      }
    };
    // Use capture to run before other handlers
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onDismiss]);

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Action Handlers ────────────────────────────────────────────────────

  const handleHighlight = useCallback(async (color: string) => {
    if (loading) return;
    setLoading(true);
    setShowColorPicker(false);
    try {
      await createSpanFromSelection(entityRef, 'highlight', color);
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, onDismiss]);

  const handleComment = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await createSpanFromSelection(entityRef, 'comment-target');
      // Future: open comment panel
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, onDismiss]);

  const handleCite = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await createSpanFromSelection(entityRef, 'citation');
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, onDismiss]);

  const handleExcerpt = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await createSpanFromSelection(entityRef, 'excerpt');
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, onDismiss]);

  const handleCopySnippetRef = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const spanId = await createSpanFromSelection(entityRef, 'excerpt');
      if (spanId) {
        const ref = `((${entityRef}#span=${spanId}))`;
        await navigator.clipboard.writeText(ref);
        showToast('Snippet reference copied');
      }
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, showToast, onDismiss]);

  const handleCopyLink = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const spanId = await createSpanFromSelection(entityRef, 'excerpt');
      if (spanId) {
        const url = `/content/${entityRef}#span=${spanId}`;
        await navigator.clipboard.writeText(url);
        showToast('Link copied');
      }
    } finally {
      setLoading(false);
      onDismiss?.();
    }
  }, [loading, createSpanFromSelection, entityRef, showToast, onDismiss]);

  if (!position || !selection.hasSelection) return null;

  const btnStyle: React.CSSProperties = {
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

  return (
    <>
      <div
        ref={toolbarRef}
        data-part="span-toolbar"
        role="toolbar"
        aria-label="Text span actions"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
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
        {/* Highlight — with color picker dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            title="Highlight (choose color)"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker((v) => !v);
            }}
          >
            <span style={{ fontSize: '15px' }}>🖍</span>
          </button>
          {showColorPicker && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--palette-surface)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 'var(--radius-md)',
                padding: '4px',
                display: 'flex',
                gap: '4px',
                boxShadow: 'var(--elevation-2, 0 4px 12px rgba(0,0,0,0.15))',
                zIndex: 1201,
              }}
            >
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleHighlight(c.value);
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: c.bg,
                    border: '2px solid var(--palette-outline-variant)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Comment */}
        <button
          style={btnStyle}
          title="Comment"
          onMouseDown={(e) => { e.preventDefault(); void handleComment(); }}
        >
          <span style={{ fontSize: '14px' }}>💬</span>
        </button>

        {/* Cite */}
        <button
          style={btnStyle}
          title="Cite"
          onMouseDown={(e) => { e.preventDefault(); void handleCite(); }}
        >
          <span style={{ fontSize: '14px' }}>📎</span>
        </button>

        {/* Excerpt */}
        <button
          style={btnStyle}
          title="Excerpt"
          onMouseDown={(e) => { e.preventDefault(); void handleExcerpt(); }}
        >
          <span style={{ fontSize: '14px' }}>✂</span>
        </button>

        <Separator />

        {/* Copy Snippet Reference */}
        <button
          style={btnStyle}
          title="Copy Snippet Reference  ((entityRef#span=id))"
          onMouseDown={(e) => { e.preventDefault(); void handleCopySnippetRef(); }}
        >
          <span style={{ fontSize: '12px', fontFamily: 'var(--typography-font-family-mono)' }}>
            ((&hairsp;))
          </span>
        </button>

        {/* Copy Link */}
        <button
          style={btnStyle}
          title="Copy Link  /content/{id}#span=..."
          onMouseDown={(e) => { e.preventDefault(); void handleCopyLink(); }}
        >
          <span style={{ fontSize: '14px' }}>🔗</span>
        </button>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            background: 'var(--palette-inverse-surface, #1a1a2e)',
            color: 'var(--palette-inverse-on-surface, #fff)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.2))',
            pointerEvents: 'none',
          }}
        >
          {toast.message}
        </div>
      )}
    </>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const Separator: React.FC = () => (
  <div style={{
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.2)',
    margin: '0 2px',
    flexShrink: 0,
  }} />
);

export default SpanToolbar;
