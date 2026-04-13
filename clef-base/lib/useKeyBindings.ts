'use client';

/**
 * useKeyBindings — React hook providing the global key-event dispatcher.
 *
 * PRD:   docs/plans/keybinding-prd.md §3.3
 * Card:  KB-03
 * Concept: specs/app/key-binding.concept
 *
 * ## State machine
 *
 *   idle ──keydown──> resolveKey(event, currentScope, chordState=null)
 *                      │
 *                      ├── match → ActionBinding/invoke → idle
 *                      ├── partial(prefix) → chordState=prefix,
 *                      │      show overlay, start 2 s timeout
 *                      │        ├── match within timeout → invoke → idle
 *                      │        ├── no-match within timeout → idle (cancel)
 *                      │        └── Escape → idle (cancel)
 *                      └── none → fall through (default browser behaviour)
 *
 * ## Scope resolution
 *
 * `currentScope` is resolved by walking `event.target` upward through
 * `data-keybinding-scope` attributes. Each ancestor that carries the
 * attribute contributes a path segment. The innermost (closest to the
 * event target) wins; parent segments are appended to form the full path
 * (e.g., "app.editor.code-block"). If no ancestor carries the attribute
 * the scope defaults to "app".
 *
 * ## contentEditable handling
 *
 * If the event target is inside a contentEditable region and the key
 * produces a printable character without a modifier (meta / ctrl / alt),
 * the dispatcher skips entirely — we do not intercept normal typing.
 * Modifier combos (Cmd+B, Ctrl+S, etc.) still dispatch even inside
 * contentEditable.
 *
 * ## Phase handling (v1 pragmatic)
 *
 * The listener is registered at document level in the capture phase so it
 * sees all events before any element-level handlers. For bindings whose
 * `phase` field is "bubble", the handler skips them when
 * `event.defaultPrevented` is already set, letting the browser's natural
 * bubble propagation handle those cases.
 *
 * ## Recorder coordination
 *
 * The exported `recorderActive` ref can be set to `true` by the
 * KeybindingEditor recorder UI. While true the dispatcher returns early,
 * letting the recorder capture keystrokes itself.
 */

import { useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/** Type returned by KeyBinding/resolveKey. */
type ResolveResult =
  | { variant: 'match'; actionBinding: string; params: string }
  | { variant: 'partial'; prefix: Array<{ mod: string[]; key: string; code: string }> }
  | { variant: 'none' };

/**
 * KernelConnection — a thin interface matching what ClefProvider exposes via
 * `useKernelInvoke()`. Typed here to keep the hook independent of the provider.
 */
export type KernelConnection = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Global recorder ref
// ---------------------------------------------------------------------------

/**
 * Set `recorderActive.current = true` from the KeybindingEditor recorder UI
 * to suppress the global dispatcher while a key combination is being recorded.
 * The dispatcher returns early when this is true.
 */
export const recorderActive: { current: boolean } = { current: false };

// ---------------------------------------------------------------------------
// Chord-state timeout
// ---------------------------------------------------------------------------

const CHORD_TIMEOUT_MS = 2_000;

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

/**
 * Walk `target` upward collecting `data-keybinding-scope` attribute values.
 * The innermost value (closest to the target) forms the leaf of the scope
 * path. Ancestors' values are prepended — so DOM order maps to scope nesting.
 *
 * Example DOM:
 *   <div data-keybinding-scope="app">
 *     <div data-keybinding-scope="app.editor">
 *       <div data-keybinding-scope="app.editor.code-block"> ← target
 *
 * Collected (leaf first): ["app.editor.code-block", "app.editor", "app"]
 * The innermost full path wins; return it as-is.
 */
export function resolveScope(target: EventTarget | null): string {
  // Use duck-typing instead of `instanceof Element` so this function works in
  // Node.js test environments where the DOM globals are not defined.
  if (
    target == null ||
    typeof (target as Record<string, unknown>).getAttribute !== 'function'
  ) {
    return 'app';
  }

  // Cast to a minimal Element-like type for traversal.
  interface ElementLike {
    getAttribute(name: string): string | null;
    parentElement: ElementLike | null;
  }

  let node: ElementLike | null = target as unknown as ElementLike;
  while (node) {
    const scope = node.getAttribute('data-keybinding-scope');
    if (scope && scope.trim()) return scope.trim();
    node = node.parentElement;
  }

  return 'app';
}

// ---------------------------------------------------------------------------
// Modifier normalisation
// ---------------------------------------------------------------------------

function extractModifiers(event: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (event.metaKey) mods.push('meta');
  if (event.ctrlKey) mods.push('ctrl');
  if (event.altKey) mods.push('alt');
  if (event.shiftKey) mods.push('shift');

  // Normalise platform-specific meta/ctrl to the "mod" virtual modifier.
  // "mod" = Cmd on Mac, Ctrl elsewhere (VS Code / keyboard-shortcuts convention).
  const isMac =
    typeof navigator !== 'undefined' &&
    /mac/i.test(navigator.platform || navigator.userAgent);

  if (isMac && mods.includes('meta') && !mods.includes('ctrl')) {
    return mods.map((m) => (m === 'meta' ? 'mod' : m));
  }
  if (!isMac && mods.includes('ctrl') && !mods.includes('meta')) {
    return mods.map((m) => (m === 'ctrl' ? 'mod' : m));
  }
  return mods;
}

// ---------------------------------------------------------------------------
// contentEditable guard
// ---------------------------------------------------------------------------

function isTypingInContentEditable(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (!target.isContentEditable) return false;

  // Modifier combos always dispatch — only skip bare character keys.
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  // A key with length === 1 is a printable character (letter, digit, symbol).
  return event.key.length === 1;
}

// ---------------------------------------------------------------------------
// Mid-chord overlay
// ---------------------------------------------------------------------------

let _overlayEl: HTMLDivElement | null = null;

function showChordOverlay(prefix: Array<{ mod: string[]; key: string; code: string }>): void {
  if (typeof document === 'undefined') return;

  const label = prefix
    .map((stroke) => {
      const mods = stroke.mod
        .map((m) => {
          if (m === 'mod') return isMacPlatform() ? '⌘' : 'Ctrl';
          if (m === 'shift') return '⇧';
          if (m === 'alt') return isMacPlatform() ? '⌥' : 'Alt';
          if (m === 'meta') return '⌘';
          if (m === 'ctrl') return 'Ctrl';
          return m;
        })
        .join('');
      return `${mods}${stroke.key.toUpperCase()}`;
    })
    .join(' ');

  if (!_overlayEl) {
    _overlayEl = document.createElement('div');
    _overlayEl.setAttribute('data-part', 'chord-overlay');
    _overlayEl.setAttribute('role', 'status');
    _overlayEl.setAttribute('aria-live', 'polite');
    Object.assign(_overlayEl.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.85)',
      color: '#fff',
      borderRadius: '6px',
      padding: '8px 16px',
      fontSize: '14px',
      fontFamily: 'monospace',
      zIndex: '99999',
      pointerEvents: 'none',
    });
    document.body.appendChild(_overlayEl);
  }

  _overlayEl.textContent = `${label} — waiting for next key (Esc to cancel)`;
  _overlayEl.style.display = 'block';
}

function hideChordOverlay(): void {
  if (_overlayEl) {
    _overlayEl.style.display = 'none';
  }
}

function isMacPlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /mac/i.test(navigator.platform || navigator.userAgent)
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Install the global key-binding dispatcher at document level (capture phase).
 *
 * Call once at the app-shell root:
 * ```tsx
 * const invoke = useKernelInvoke();
 * useKeyBindings(invoke);
 * ```
 */
export function useKeyBindings(connection: KernelConnection): void {
  /**
   * Serialised chord-state prefix (null = idle, non-null = mid-chord).
   * Stored in a ref (not state) so the listener closure always reads the
   * current value without needing to re-register the listener on each update.
   */
  const chordStateRef = useRef<Array<{ mod: string[]; key: string; code: string }> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable reference to `connection` so the event listener closure is not
  // stale if the caller passes a new function reference on each render.
  const connectionRef = useRef<KernelConnection>(connection);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  const cancelChord = useCallback(() => {
    chordStateRef.current = null;
    hideChordOverlay();
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startChordTimeout = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      cancelChord();
    }, CHORD_TIMEOUT_MS);
  }, [cancelChord]);

  // ------------------------------------------------------------------
  // Main keydown handler
  // ------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      // 1. Yield to recorder when active.
      if (recorderActive.current) return;

      // 2. Skip bare character typing inside contentEditable.
      if (isTypingInContentEditable(event)) return;

      // 3. Cancel mid-chord on Escape.
      if (chordStateRef.current !== null && event.key === 'Escape') {
        event.preventDefault();
        cancelChord();
        return;
      }

      // 4. Build modifiers and resolve scope.
      const modifiers = extractModifiers(event);
      const scope = resolveScope(event.target);

      // 5. Encode chord state as bytes for the kernel (null → no chord).
      const chordStateBytes: string | null =
        chordStateRef.current !== null
          ? JSON.stringify(chordStateRef.current)
          : null;

      // 6. Invoke KeyBinding/resolveKey.
      void (async () => {
        let result: Record<string, unknown>;
        try {
          result = await connectionRef.current('KeyBinding', 'resolveKey', {
            scope,
            eventKey: event.key,
            eventCode: event.code,
            modifiers,
            chordState: chordStateBytes,
          });
        } catch {
          // Network / kernel failure — treat as "none" and fall through.
          return;
        }

        const resolved = result as unknown as ResolveResult;

        if (resolved.variant === 'match') {
          // Cancel any in-flight chord timeout.
          cancelChord();

          // Prevent default browser action for matched bindings.
          event.preventDefault();

          // Invoke the action binding.
          void connectionRef.current('ActionBinding', 'invoke', {
            binding: resolved.actionBinding,
            params: resolved.params ?? '',
          }).catch(() => {
            // ActionBinding invoke failure is non-fatal — Invocation
            // lifecycle handles feedback per MAG-842.
          });

          return;
        }

        if (resolved.variant === 'partial') {
          event.preventDefault();

          // Enter mid-chord mode.
          chordStateRef.current = resolved.prefix;
          showChordOverlay(resolved.prefix);
          startChordTimeout();
          return;
        }

        // resolved.variant === 'none'
        // For bubble-phase bindings: if the event already has defaultPrevented
        // set by a capture-phase handler, do not re-process. Nothing to do here
        // since we are already in capture phase and no match was found.
        // Fall through to default browser behaviour.
      })();
    },
    [cancelChord, startChordTimeout],
  );

  // ------------------------------------------------------------------
  // Register / deregister the listener
  // ------------------------------------------------------------------

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      // Clean up any pending chord timeout.
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      hideChordOverlay();
    };
  }, [handleKeyDown]);
}
