'use client';

/**
 * useFirstRunToast — one-time keybinding onboarding banner.
 *
 * PRD:  docs/plans/keybinding-prd.md Phase G, KB-15
 *
 * ## Behavior
 *
 * On first mount, checks `Property/get("user", "kb-onboarding-dismissed")`.
 * If the property is not set (null / notfound), mounts a top-banner toast
 * with the message:
 *   "Keybindings are now editable — press ? for help, open Settings to customize."
 *
 * The banner has a dismiss button. On dismiss, calls
 * `Property/set("user", "kb-onboarding-dismissed", "true")` so the check
 * returns a value on subsequent sessions and the toast does not reappear.
 *
 * ## Integration
 *
 * Call `useFirstRunToast()` once in AppShell. The hook returns a React element
 * (or null) to be rendered in the shell tree:
 *
 * ```tsx
 * const firstRunBanner = useFirstRunToast();
 * return <div className="app-shell">
 *   {firstRunBanner}
 *   ...
 * </div>;
 * ```
 *
 * ## Property storage
 *
 * Property is a content-native key/value store used throughout clef-base for
 * per-user configuration. The "user" entity is a well-known synthetic identifier
 * for the current session's user-level preferences. Key: "kb-onboarding-dismissed".
 */

import { useState, useEffect, useCallback } from 'react';
import React from 'react';

// ---------------------------------------------------------------------------
// Kernel call helper
// ---------------------------------------------------------------------------

async function kernelInvoke(
  concept: string,
  action: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/invoke/${concept}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPERTY_ENTITY = 'user';
const PROPERTY_KEY = 'kb-onboarding-dismissed';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns a React element for the first-run keybinding onboarding toast,
 * or null when the user has already dismissed it (or while loading).
 *
 * Mount the returned element once at app root (e.g., AppShell).
 */
export function useFirstRunToast(): React.ReactElement | null {
  // null = loading / unknown, false = not dismissed (show), true = dismissed
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Check whether the user has already dismissed the toast.
  useEffect(() => {
    let cancelled = false;

    async function checkDismissed() {
      try {
        const result = await kernelInvoke('Property', 'get', {
          entity: PROPERTY_ENTITY,
          key: PROPERTY_KEY,
        });

        if (cancelled) return;

        // If Property/get returns ok with a value, the user dismissed previously.
        // If it returns notfound (or any non-ok variant), show the toast.
        if (result.variant === 'ok' && result.value) {
          setDismissed(true);
        } else {
          setDismissed(false);
        }
      } catch {
        // On network error, default to not showing the toast (fail safe —
        // we do not want to bombard users with banners on every error).
        setDismissed(true);
      }
    }

    void checkDismissed();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);

    // Persist the dismissal — fire-and-forget.
    kernelInvoke('Property', 'set', {
      entity: PROPERTY_ENTITY,
      key: PROPERTY_KEY,
      value: 'true',
    }).catch(() => {
      // Non-fatal: the banner will be hidden for this session but may
      // reappear next session if persistence fails. Acceptable edge case.
    });
  }, []);

  // Still loading or already dismissed — render nothing.
  if (dismissed !== false) return null;

  return React.createElement(FirstRunToastBanner, { onDismiss: handleDismiss });
}

// ---------------------------------------------------------------------------
// Banner component
// ---------------------------------------------------------------------------

interface FirstRunToastBannerProps {
  onDismiss: () => void;
}

function FirstRunToastBanner({ onDismiss }: FirstRunToastBannerProps): React.ReactElement {
  return React.createElement(
    'div',
    {
      'data-part': 'kb-onboarding-toast',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99997,
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 12px',
        pointerEvents: 'none',
      },
    },
    React.createElement(
      'div',
      {
        'data-part': 'kb-onboarding-toast__card',
        style: {
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 16px',
          width: 'min(720px, 100%)',
          maxWidth: '100%',
          background: 'var(--color-surface-overlay, rgba(255,255,255,0.97))',
          borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.1))',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: '0.875em',
          color: 'var(--color-text, inherit)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      },
      React.createElement(
        'span',
        {
          'data-part': 'kb-onboarding-toast__message',
          style: {
            minWidth: 0,
            flex: '1 1 auto',
          },
        },
        'Keybindings are now editable \u2014 press ',
        React.createElement(
          'kbd',
          {
            style: {
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.85em',
              padding: '1px 4px',
              border: '1px solid var(--color-border, rgba(0,0,0,0.2))',
              borderRadius: '3px',
              background: 'var(--color-surface-raised, #f5f5f5)',
              boxShadow: '0 1px 0 var(--color-border, rgba(0,0,0,0.15))',
            },
          },
          '?',
        ),
        ' for help, open Settings to customize.',
      ),
      React.createElement(
        'button',
        {
          'data-part': 'kb-onboarding-toast__dismiss',
          onClick: onDismiss,
          'aria-label': 'Dismiss keybinding onboarding notice',
          style: {
            flexShrink: 0,
            padding: '4px 10px',
            border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
            borderRadius: '4px',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.8125em',
            color: 'var(--color-text-muted, inherit)',
          },
        },
        'Dismiss',
      ),
    ),
  );
}
