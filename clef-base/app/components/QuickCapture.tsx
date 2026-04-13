'use client';

/**
 * QuickCapture — Floating action button + minimal overlay form
 * for rapid content creation from anywhere in the app.
 *
 * Trigger: FAB at bottom-right, or Ctrl+N / Cmd+N keyboard shortcut.
 * Creates a ContentNode with the provided title and body, then
 * navigates to the new entity detail page.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useKernelInvoke } from '../../lib/clef-provider';
import { KeybindingHint } from './widgets/KeybindingHint';

export const QuickCapture: React.FC = () => {
  const invoke = useKernelInvoke();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<string | null>(null);
  // TODO KB-16+: seed actionBindingId "quick-capture-open" in KeyBinding seeds
  const [fabChordText, setFabChordText] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const openForm = useCallback(() => {
    setOpen(true);
    setTitle('');
    setBody('');
    setError(null);
  }, []);

  const closeForm = useCallback(() => {
    if (!submitting) setOpen(false);
  }, [submitting]);

  // Keyboard shortcut: Ctrl+N / Cmd+N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        // Don't hijack if user is in an input/textarea already
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        openForm();
      }
      // Escape to close
      if (e.key === 'Escape' && open) {
        closeForm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openForm, closeForm, open]);

  // Auto-focus title field when form opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);
    setErrorVariant(null);

    const nodeId = `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await invoke('ContentNode', 'create', {
        node: nodeId,
        title: title.trim(),
        content: body.trim() || title.trim(),
        createdBy: 'quick-capture',
      });

      if (result.variant === 'ok') {
        setOpen(false);
        setTitle('');
        setBody('');
        router.push(`/admin/content/${encodeURIComponent(nodeId)}`);
      } else {
        setErrorVariant(result.variant as string);
        setError((result.message as string) ?? `Action returned: ${result.variant}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [invoke, title, body, router]);

  return (
    <>
      {/* Floating Action Button */}
      {/* KeybindingHint tooltip variant — supplies chord text via onChordText */}
      <KeybindingHint
        actionBindingId="quick-capture-open"
        variant="tooltip"
        onChordText={setFabChordText}
      />
      <button
        type="button"
        aria-label={fabChordText ? `Quick capture (${fabChordText})` : 'Quick capture'}
        title={fabChordText ? `Quick capture (${fabChordText})` : 'Quick capture'}
        onClick={openForm}
        style={{
          position: 'fixed',
          bottom: 'var(--spacing-xl, 24px)',
          right: 'var(--spacing-xl, 24px)',
          zIndex: 900,
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-full, 50%)',
          border: 'none',
          background: 'var(--palette-primary, #6750a4)',
          color: 'var(--palette-on-primary, #fff)',
          fontSize: 28,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--elevation-3, 0 4px 12px rgba(0,0,0,0.25))',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = 'var(--elevation-4, 0 6px 16px rgba(0,0,0,0.3))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'var(--elevation-3, 0 4px 12px rgba(0,0,0,0.25))';
        }}
      >
        +
      </button>

      {/* Overlay form */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div
            style={{
              background: 'var(--palette-surface, #fff)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: 'var(--spacing-xl, 24px)',
              minWidth: 380,
              maxWidth: 480,
              width: '100%',
              boxShadow: 'var(--elevation-3, 0 4px 12px rgba(0,0,0,0.25))',
            }}
          >
            <h3 style={{
              marginTop: 0,
              marginBottom: 'var(--spacing-md, 16px)',
              fontSize: 'var(--typography-heading-sm-size, 1.125rem)',
              fontWeight: 'var(--typography-heading-sm-weight, 600)',
            }}>
              Quick Capture
            </h3>

            {error && (
              <div style={{
                padding: 'var(--spacing-sm, 8px) var(--spacing-md, 16px)',
                background: 'var(--palette-error-container, #fce4ec)',
                color: 'var(--palette-on-error-container, #b71c1c)',
                borderRadius: 'var(--radius-sm, 6px)',
                marginBottom: 'var(--spacing-md, 16px)',
                fontSize: 'var(--typography-body-sm-size, 0.875rem)',
              }}>
                {errorVariant && errorVariant !== 'error' && (
                  <span style={{ fontWeight: 600, marginRight: 4 }}>[{errorVariant}]</span>
                )}
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-md, 16px)' }}>
                <label
                  htmlFor="qc-title"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs, 4px)',
                    fontSize: 'var(--typography-label-md-size, 0.875rem)',
                    fontWeight: 'var(--typography-label-md-weight, 500)',
                  }}
                >
                  Title <span style={{ color: 'var(--palette-error, #d32f2f)' }}>*</span>
                </label>
                <input
                  ref={titleRef}
                  id="qc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you capturing?"
                  required
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm, 8px)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--palette-outline, #ccc)',
                    background: 'var(--palette-surface-variant, #f5f5f5)',
                    color: 'var(--palette-on-surface, #1a1a1a)',
                    fontSize: 'var(--typography-body-md-size, 1rem)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 'var(--spacing-md, 16px)' }}>
                <label
                  htmlFor="qc-body"
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs, 4px)',
                    fontSize: 'var(--typography-label-md-size, 0.875rem)',
                    fontWeight: 'var(--typography-label-md-weight, 500)',
                  }}
                >
                  Notes
                </label>
                <textarea
                  id="qc-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Optional details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm, 8px)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--palette-outline, #ccc)',
                    background: 'var(--palette-surface-variant, #f5f5f5)',
                    color: 'var(--palette-on-surface, #1a1a1a)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--typography-body-md-size, 1rem)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-sm, 8px)',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  data-part="button"
                  data-variant="outlined"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-part="button"
                  data-variant="filled"
                  disabled={submitting || !title.trim()}
                >
                  {submitting ? 'Saving...' : 'Capture'}
                </button>
              </div>

              <div style={{
                marginTop: 'var(--spacing-sm, 8px)',
                fontSize: 'var(--typography-body-sm-size, 0.75rem)',
                opacity: 0.5,
                textAlign: 'right',
              }}>
                {/* TODO KB-16+: "quick-capture-open" binding seed needed */}
                Tip: press{' '}
                <KeybindingHint actionBindingId="quick-capture-open" variant="keycap-only" />
                {' '}from anywhere
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickCapture;
