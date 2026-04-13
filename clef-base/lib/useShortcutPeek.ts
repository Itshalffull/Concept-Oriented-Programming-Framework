'use client';

/**
 * useShortcutPeek — ephemeral shortcut hint shown near a button after click.
 *
 * PRD:  docs/plans/keybinding-prd.md Phase G, KB-15
 *
 * When the user clicks a button that has a registered KeyBinding, this hook
 * renders a fixed-position keycap hint near the anchor element for 600 ms,
 * then fades it out. Mimics the Linear-style shortcut discovery pattern.
 *
 * ## Usage
 *
 * ```tsx
 * const { peek } = useShortcutPeek();
 *
 * // In a click handler:
 * peek('create-node', buttonRef.current);
 * ```
 *
 * ## Implementation notes
 *
 * The hint element is created imperatively and appended to document.body to
 * avoid z-index and overflow clipping issues. It is removed after the 600 ms
 * display window + 150 ms fade-out animation completes.
 *
 * The hook is intentionally lightweight: it does not subscribe to the kernel
 * or poll for binding data. The caller is responsible for knowing which
 * actionBindingId corresponds to the button. In practice, ActionButton already
 * receives `binding` as a prop — that same value is passed here.
 *
 * Only one hint is shown at a time: if peek() is called while a previous hint
 * is still animating, the existing one is removed immediately and a new one is
 * created.
 */

import { useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyStroke {
  mod: string[];
  key: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Platform helpers (duplicated from KeybindingHint to avoid circular deps)
// ---------------------------------------------------------------------------

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

function renderStrokeText(stroke: KeyStroke, mac: boolean): string {
  const MAC_SYMBOLS: Record<string, string> = {
    mod: '⌘', shift: '⇧', ctrl: '⌃', alt: '⌥',
    meta: '⌘', command: '⌘', option: '⌥', control: '⌃',
  };
  const WIN_LABELS: Record<string, string> = {
    mod: 'Ctrl', shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt',
    meta: 'Win', command: 'Ctrl', option: 'Alt', control: 'Ctrl',
  };

  const mods = stroke.mod ?? [];
  const keyLabel = stroke.key.length === 1 ? stroke.key.toUpperCase() : stroke.key;

  if (mac) {
    return mods.map((m) => MAC_SYMBOLS[m.toLowerCase()] ?? m).join('') + keyLabel;
  }
  return [...mods.map((m) => WIN_LABELS[m.toLowerCase()] ?? m), keyLabel].join('+');
}

function renderChordText(chord: KeyStroke[], mac: boolean): string {
  return chord.map((s) => renderStrokeText(s, mac)).join('\u00A0');
}

// ---------------------------------------------------------------------------
// Kernel call helper
// ---------------------------------------------------------------------------

async function fetchBindingChord(actionBindingId: string): Promise<KeyStroke[] | null> {
  try {
    const res = await fetch('/api/invoke/KeyBinding/listByScope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'app' }),
    });
    const result = (await res.json()) as Record<string, unknown>;
    if (result.variant !== 'ok') return null;

    const raw = result.bindings;
    const items: unknown[] = (() => {
      if (typeof raw === 'string') {
        try { return JSON.parse(raw) as unknown[]; } catch { return []; }
      }
      return Array.isArray(raw) ? raw : [];
    })();

    for (const item of items) {
      if (item && typeof item === 'object') {
        const rec = item as { actionBinding?: string; chord?: KeyStroke[] };
        if (rec.actionBinding === actionBindingId && Array.isArray(rec.chord)) {
          return rec.chord;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM hint creation
// ---------------------------------------------------------------------------

const DISPLAY_DURATION_MS = 600;
const FADE_DURATION_MS = 150;

function createHintElement(chordText: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-part', 'shortcut-peek');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', `Keyboard shortcut: ${chordText}`);

  // Render each stroke as a keycap chip
  const strokes = chordText.split('\u00A0');
  strokes.forEach((stroke, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.setAttribute('aria-hidden', 'true');
      sep.style.cssText = 'display:inline-block;width:4px';
      el.appendChild(sep);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = stroke;
    kbd.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'font-family:var(--font-mono,monospace)',
      'font-size:0.75em',
      'line-height:1',
      'padding:2px 6px',
      'border:1px solid var(--color-border,rgba(0,0,0,0.2))',
      'border-radius:4px',
      'background:var(--color-surface-raised,#fff)',
      'color:var(--color-text,inherit)',
      'box-shadow:0 1px 0 var(--color-border,rgba(0,0,0,0.15))',
      'white-space:nowrap',
    ].join(';');
    el.appendChild(kbd);
  });

  el.style.cssText = [
    'position:fixed',
    'z-index:99998',
    'display:inline-flex',
    'align-items:center',
    'gap:2px',
    'padding:4px 8px',
    'border-radius:6px',
    'background:var(--color-surface-overlay,rgba(255,255,255,0.95))',
    'box-shadow:0 2px 8px rgba(0,0,0,0.12)',
    'pointer-events:none',
    'opacity:0',
    `transition:opacity ${FADE_DURATION_MS}ms ease,transform ${FADE_DURATION_MS}ms ease`,
    'transform:translateY(-4px)',
  ].join(';');

  return el;
}

function positionHint(el: HTMLElement, anchor: Element): void {
  const rect = anchor.getBoundingClientRect();
  // Place it below the anchor button, centered
  const top = rect.bottom + 6;
  const centerX = rect.left + rect.width / 2;

  el.style.top = `${top}px`;
  el.style.left = `${centerX}px`;
  el.style.transform = 'translateX(-50%) translateY(-4px)';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseShortcutPeekResult {
  /**
   * Show the shortcut keycap hint near the given anchor element for 600 ms.
   * If the actionBindingId has no registered chord, does nothing.
   *
   * Safe to call from an event handler — the kernel fetch is fire-and-forget.
   */
  peek: (actionBindingId: string, anchor: Element | null) => void;
}

export function useShortcutPeek(): UseShortcutPeekResult {
  // Track the currently-displayed hint so we can remove it early if peek()
  // is called again before the previous one expires.
  const activeHintRef = useRef<{
    el: HTMLElement;
    timers: ReturnType<typeof setTimeout>[];
  } | null>(null);

  const clearActiveHint = useCallback(() => {
    if (!activeHintRef.current) return;
    const { el, timers } = activeHintRef.current;
    timers.forEach(clearTimeout);
    el.remove();
    activeHintRef.current = null;
  }, []);

  const peek = useCallback(
    (actionBindingId: string, anchor: Element | null) => {
      if (typeof document === 'undefined' || !anchor) return;

      // Kick off an async chord lookup; show the hint when resolved.
      void (async () => {
        const chord = await fetchBindingChord(actionBindingId);
        if (!chord || chord.length === 0) return;

        // Clear any previous hint before showing a new one.
        clearActiveHint();

        const mac = isMacPlatform();
        const chordText = renderChordText(chord, mac);
        const el = createHintElement(chordText);

        // Position relative to anchor (re-read rect after potential layout)
        positionHint(el, anchor);
        document.body.appendChild(el);

        // Animate in: fade + slide-down
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateX(-50%) translateY(0)';
          });
        });

        const timers: ReturnType<typeof setTimeout>[] = [];

        // Animate out after display duration
        const fadeTimer = setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translateX(-50%) translateY(-4px)';
        }, DISPLAY_DURATION_MS);
        timers.push(fadeTimer);

        // Remove from DOM after fade completes
        const removeTimer = setTimeout(() => {
          el.remove();
          if (activeHintRef.current?.el === el) {
            activeHintRef.current = null;
          }
        }, DISPLAY_DURATION_MS + FADE_DURATION_MS);
        timers.push(removeTimer);

        activeHintRef.current = { el, timers };
      })();
    },
    [clearActiveHint],
  );

  return { peek };
}
