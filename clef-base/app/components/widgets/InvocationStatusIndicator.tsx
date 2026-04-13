'use client';

/**
 * InvocationStatusIndicator — React adapter for surface/invocation-status.widget.
 *
 * Renders the 4-state FSM (idle, pending, ok, error) per the widget spec.
 * All anatomy parts carry `data-part` attributes matching the spec's anatomy
 * names exactly so automated tests can select them with
 * `[data-part="retry-button"]` etc.
 *
 * Widget spec: surface/invocation-status.widget
 * Hook:        clef-base/lib/useInvocation.ts
 * PRD:         docs/plans/invocation-lifecycle-prd.md §4.4, INV-04
 *
 * ## Accessibility
 *
 * - root carries `role="status"` and `aria-live="polite"` in every FSM state,
 *   satisfying the invariant "root carries role=status and aria-live=polite
 *   in every state".
 * - status is communicated via both an icon label and a colour token, never
 *   colour alone, satisfying WCAG 1.4.1 (invariant §6).
 * - retryButton and dismissButton carry explicit `aria-label` values and are
 *   hidden via both CSS (display:none) and `aria-hidden="true"` when
 *   not applicable to the current state.
 * - Keyboard: Enter on retryButton fires retry(); Escape anywhere fires
 *   dismiss() when available.
 *
 * ## Auto-dismiss
 *
 * When status transitions to 'ok', a timer fires `dismiss()` after
 * `autoDismissMs` milliseconds (default 3000). An error state does NOT
 * auto-dismiss — the user must click retry or dismiss explicitly.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useInvocation, type InvocationStatus } from '../../../lib/useInvocation';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface InvocationStatusIndicatorProps {
  /** The Invocation id to observe. Pass null to render idle state. */
  invocationId: string | null;
  /** Show expanded error message and timestamp in error panel. Default false. */
  verbose?: boolean;
  /**
   * Milliseconds to wait before auto-dismissing a successful invocation.
   * Pass 0 to disable auto-dismiss. Default 3000.
   */
  autoDismissMs?: number;
  /** Override the default state label. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Design tokens (CSS custom properties from the active theme)
// ---------------------------------------------------------------------------

const TOKEN = {
  // surface colours
  surfaceVariant: 'var(--palette-surface-variant, #f3f4f6)',
  onSurface: 'var(--palette-on-surface, #1f2937)',
  onSurfaceMuted: 'var(--palette-on-surface-variant, #6b7280)',
  // status colours — always paired with an icon label so colour is not sole signal
  pendingFg: 'var(--palette-primary, #3b82f6)',
  okFg: 'var(--palette-success, #22c55e)',
  errorFg: 'var(--palette-error, #ef4444)',
  errorContainerBg: 'var(--palette-error-container, #fee2e2)',
  onErrorContainer: 'var(--palette-on-error-container, #7f1d1d)',
  outline: 'var(--palette-outline, #d1d5db)',
  // motion
  transition: 'var(--motion-easing-standard, 120ms ease)',
} as const;

// ---------------------------------------------------------------------------
// Icon labels — convey meaning without relying on colour alone (WCAG 1.4.1)
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: InvocationStatus }) {
  if (status === 'pending') {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: `2px solid ${TOKEN.pendingFg}`,
          borderTopColor: 'transparent',
          animation: 'clef-spin 700ms linear infinite',
        }}
      />
    );
  }
  if (status === 'ok') {
    return (
      <span
        aria-hidden="true"
        style={{ color: TOKEN.okFg, fontWeight: 'bold', fontSize: '13px', lineHeight: 1 }}
      >
        {/* Check mark — not colour alone */}
        &#10003;
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        aria-hidden="true"
        style={{ color: TOKEN.errorFg, fontWeight: 'bold', fontSize: '13px', lineHeight: 1 }}
      >
        {/* X mark — not colour alone */}
        &#215;
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InvocationStatusIndicator: React.FC<InvocationStatusIndicatorProps> = ({
  invocationId,
  verbose = false,
  autoDismissMs = 3000,
  label,
}) => {
  const { status, error, startedAt, completedAt, retry, dismiss } =
    useInvocation(invocationId);

  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------------
  // Auto-dismiss on ok
  // ------------------------------------------------------------------
  useEffect(() => {
    if (status === 'ok' && autoDismissMs > 0) {
      // Entry action: scheduleAutoDismiss (per widget spec)
      autoDismissTimer.current = setTimeout(() => {
        dismiss();
      }, autoDismissMs);
    }
    return () => {
      // Exit action: cancelAutoDismiss (per widget spec)
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
    };
  }, [status, autoDismissMs, dismiss]);

  // ------------------------------------------------------------------
  // Keyboard: Escape → dismiss, Enter on retryButton is handled by the
  // button itself (native keyboard activation).
  // The widget spec maps Escape -> DISMISS and Enter -> RETRY.
  // ------------------------------------------------------------------
  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && (status === 'ok' || status === 'error')) {
        e.preventDefault();
        dismiss();
      }
    },
    [status, dismiss],
  );

  // ------------------------------------------------------------------
  // Derived label
  // ------------------------------------------------------------------
  const derivedLabel: string = (() => {
    if (label) return label;
    if (status === 'pending') return 'Working\u2026';
    if (status === 'ok') return 'Done';
    if (status === 'error') return 'Failed';
    return '';
  })();

  // ------------------------------------------------------------------
  // Visibility helpers (per connect block in the widget spec)
  // ------------------------------------------------------------------
  const hidden = (cond: boolean): React.CSSProperties =>
    cond ? { display: 'none' } : {};

  // ------------------------------------------------------------------
  // Render — idle: nothing visible
  // ------------------------------------------------------------------
  if (status === 'idle') {
    return (
      <div
        data-part="root"
        data-widget="invocation-status"
        data-state="idle"
        data-invocation-id={invocationId ?? undefined}
        data-status="idle"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Invocation status"
        onKeyDown={handleRootKeyDown}
        style={{ display: 'contents' }}
      />
    );
  }

  // ------------------------------------------------------------------
  // Render — pending / ok / error
  // ------------------------------------------------------------------
  const rootStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm, 6px)',
    border: `1px solid ${TOKEN.outline}`,
    background: TOKEN.surfaceVariant,
    fontSize: 'var(--typography-body-sm-size, 13px)',
    color: TOKEN.onSurface,
    position: 'relative',
    transition: TOKEN.transition,
    flexDirection: 'column',
    alignSelf: 'flex-start',
  };

  return (
    <>
      {/*
        Keyframe for the pending spinner.  Inserted once per component
        instance — browsers deduplicate identical @keyframes in the same
        document so this is safe without a singleton guard for v1.
      */}
      <style>{`
        @keyframes clef-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        data-part="root"
        data-widget="invocation-status"
        data-state={status}
        data-invocation-id={invocationId ?? undefined}
        data-status={status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Invocation status"
        onKeyDown={handleRootKeyDown}
        style={rootStyle}
      >
        {/* Row 1: indicator + label + dismiss button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>

          {/* indicator — spinner / check / X */}
          <span
            data-part="indicator"
            data-state={status}
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              flexShrink: 0,
            }}
          >
            <StatusIcon status={status} />
          </span>

          {/* label */}
          <span
            data-part="label"
            style={{
              flex: 1,
              color:
                status === 'error'
                  ? TOKEN.errorFg
                  : status === 'ok'
                    ? TOKEN.okFg
                    : TOKEN.onSurface,
              fontWeight: status !== 'pending' ? '500' : 'normal',
            }}
          >
            {derivedLabel}
          </span>

          {/* timestamp — visible in all non-idle states */}
          <span
            data-part="timestamp"
            style={{
              fontSize: '11px',
              color: TOKEN.onSurfaceMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {status === 'pending' && startedAt
              ? new Date(startedAt).toLocaleTimeString()
              : completedAt
                ? new Date(completedAt).toLocaleTimeString()
                : null}
          </span>

          {/* dismissButton — visible in ok and error states */}
          <button
            data-part="dismiss-button"
            type="button"
            aria-label="Dismiss notification"
            aria-hidden={
              status === 'ok' || status === 'error' ? 'false' : 'true'
            }
            onClick={dismiss}
            style={{
              ...hidden(status !== 'ok' && status !== 'error'),
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              color: TOKEN.onSurfaceMuted,
              fontSize: '14px',
              lineHeight: 1,
              borderRadius: '3px',
              flexShrink: 0,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dismiss();
              }
            }}
          >
            {/* X icon — text fallback satisfies WCAG 1.4.1 alongside aria-label */}
            &#215;
          </button>
        </div>

        {/* progress bar — visible only in pending state */}
        <div
          data-part="progress"
          role="progressbar"
          aria-label="Operation in progress"
          aria-hidden={status === 'pending' ? 'false' : 'true'}
          style={{
            ...hidden(status !== 'pending'),
            width: '100%',
            height: '2px',
            background: TOKEN.outline,
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '40%',
              background: TOKEN.pendingFg,
              borderRadius: '1px',
              animation: 'clef-progress-slide 1.2s ease-in-out infinite',
            }}
          />
        </div>

        {/* errorPanel — visible only in error state */}
        <div
          data-part="error-panel"
          role="region"
          aria-label="Error details"
          aria-expanded={status === 'error' ? 'true' : 'false'}
          style={{
            ...hidden(status !== 'error'),
            width: '100%',
            padding: '6px 8px',
            background: TOKEN.errorContainerBg,
            borderRadius: 'var(--radius-sm, 4px)',
            border: `1px solid ${TOKEN.errorFg}`,
          }}
        >
          {verbose && error ? (
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: TOKEN.onErrorContainer,
                wordBreak: 'break-word',
              }}
            >
              {error}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '12px', color: TOKEN.onErrorContainer }}>
              {error ?? 'An error occurred.'}
            </p>
          )}

          {/* retryButton — inside errorPanel, visible only in error state */}
          <button
            data-part="retry-button"
            type="button"
            aria-label="Retry failed operation"
            aria-hidden={status === 'error' ? 'false' : 'true'}
            onClick={retry}
            onKeyDown={(e) => {
              // Enter key — native button activation handles this; guard for
              // widget spec keyboard invariant: Enter -> RETRY
              if (e.key === 'Enter') {
                e.preventDefault();
                retry();
              }
            }}
            style={{
              ...hidden(status !== 'error'),
              marginTop: '6px',
              padding: '4px 10px',
              background: TOKEN.errorFg,
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm, 4px)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            Retry
          </button>
        </div>
      </div>

      {/* progress-slide keyframe — separate from spin */}
      <style>{`
        @keyframes clef-progress-slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </>
  );
};
