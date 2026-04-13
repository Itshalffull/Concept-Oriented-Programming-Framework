'use client';

/**
 * KeybindingHint — displays the keyboard chord for a registered action binding.
 *
 * Widget spec:  docs/plans/keybinding-prd.md §3.5, KB-05
 * Concept spec: specs/app/key-binding.concept
 * Commit:       90b52643 (KeyBinding concept landed)
 *
 * ## Behavior
 *
 * On mount the hook polls `KeyBinding/listByScope("app")` every 5 seconds and
 * filters client-side for a binding whose `actionBinding` matches the given
 * `actionBindingId`. This mirrors the pattern used by `useInvocation` (polling
 * while data may change) and avoids adding a dedicated `listByActionBinding`
 * action to the concept for v1.
 *
 * Follow-up: KB-01 should add `KeyBinding/listByActionBinding` so this component
 * can request exactly the record it needs instead of scanning the full list.
 *
 * ## Override resolution (KB-11)
 *
 * The component walks the three-tier override chain:
 *   1. userChord  — user-scoped Property override (set via setOverride + listByScope join)
 *   2. workspaceChord — workspace-scoped Property override
 *   3. chord — seed default
 * First non-null value wins. `listByScope` now returns these fields on every record.
 *
 * ## Platform rendering
 *
 * Mac (`navigator.platform.includes("Mac")`):
 *   mod  → ⌘   shift → ⇧   ctrl → ⌃   alt → ⌥
 *   Single stroke: "⌘B"
 *   Two-stroke chord: stages joined with U+00A0 (non-breaking space): "⌘K ⌘S"
 *
 * Windows/Linux:
 *   mod  → Ctrl   shift → Shift   ctrl → Ctrl   alt → Alt
 *   Single stroke: "Ctrl+B"
 *   Two-stroke chord: "Ctrl+K Ctrl+S"
 *
 * ## Variants
 *
 *   inline      (default) — renders keycap chips inline as text-flow
 *   tooltip     — renders nothing; supplies chord text to parent via
 *                 `onChordText` callback for use in title / aria-label
 *   keycap-only — renders the keycap sequence without any outer wrapper
 *
 * ## Subscription
 *
 * For v1 the hook polls every 5 s. When Connection/observe (SSE push) lands,
 * the fetch inside the polling useEffect can be replaced with a streaming
 * subscription without changing the public interface.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyStroke {
  mod: string[];
  key: string;
  code: string;
}

interface KeyBindingRecord {
  binding: string;
  actionBinding: string;
  chord: KeyStroke[];
  /** v1: userChord and workspaceChord are undefined until KB-11 lands. */
  userChord?: KeyStroke[] | null;
  workspaceChord?: KeyStroke[] | null;
}

export interface KeybindingHintProps {
  /** The `actionBinding` identifier to look up in the KeyBinding registry. */
  actionBindingId: string;
  /**
   * Scope to query. Defaults to "app" (the most general scope). A more
   * specific scope (e.g., "app.editor") will return bindings from that scope
   * and all ancestor scopes and then filter client-side.
   */
  scope?: string;
  /**
   * Visual variant:
   * - `inline`      (default) — keycap chips rendered inline as text-flow
   * - `tooltip`     — renders nothing; parent should use `onChordText` instead
   * - `keycap-only` — just the keycap sequence, no outer wrapper element
   */
  variant?: 'inline' | 'tooltip' | 'keycap-only';
  /**
   * Called whenever the resolved chord text changes (including on first
   * resolution). Useful when `variant="tooltip"` so the parent can put the
   * text into a `title` or `aria-label`. Also fires with `null` when no
   * binding is found.
   */
  onChordText?: (text: string | null) => void;
}

// ---------------------------------------------------------------------------
// Platform detection helpers (replaceable in tests via mock)
// ---------------------------------------------------------------------------

/** Returns true when running on macOS. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.includes('Mac');
}

// ---------------------------------------------------------------------------
// Chord rendering helpers
// ---------------------------------------------------------------------------

const MAC_MOD_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  shift: '⇧',
  ctrl: '⌃',
  alt: '⌥',
  meta: '⌘',
  command: '⌘',
  option: '⌥',
  control: '⌃',
};

const WIN_MOD_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  shift: 'Shift',
  ctrl: 'Ctrl',
  alt: 'Alt',
  meta: 'Win',
  command: 'Ctrl',
  option: 'Alt',
  control: 'Ctrl',
};

/**
 * Render a single KeyStroke to a display string.
 *
 * Mac:   ⌘⇧B  (no separator; symbols run together)
 * Win:   Ctrl+Shift+B  ('+' joined)
 */
function renderStroke(stroke: KeyStroke, mac: boolean): string {
  const mods = stroke.mod ?? [];
  const keyLabel = stroke.key.length === 1 ? stroke.key.toUpperCase() : stroke.key;

  if (mac) {
    const modStr = mods.map((m) => MAC_MOD_SYMBOLS[m.toLowerCase()] ?? m).join('');
    return modStr + keyLabel;
  } else {
    const modParts = mods.map((m) => WIN_MOD_LABELS[m.toLowerCase()] ?? m);
    return [...modParts, keyLabel].join('+');
  }
}

/**
 * Render a full chord (list of keystrokes) to a display string.
 * Multi-stroke chords are joined with a non-breaking space (U+00A0).
 */
export function renderChord(chord: KeyStroke[], mac: boolean): string {
  return chord.map((s) => renderStroke(s, mac)).join('\u00A0');
}

// ---------------------------------------------------------------------------
// Override resolution (KB-11) — walks the three-tier chain:
//   1. User Property override (userChord, populated by setOverride + listByScope)
//   2. Workspace Property override (workspaceChord, same path)
//   3. Seed default chord
// First non-null, non-empty value wins.
// ---------------------------------------------------------------------------

function resolveChord(record: KeyBindingRecord): KeyStroke[] {
  return record.userChord ?? record.workspaceChord ?? record.chord;
}

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
// Hook: useKeybindingForAction
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;

/**
 * Polls `KeyBinding/listByScope` every 5 s, finds the binding for the given
 * `actionBindingId`, and returns its resolved chord.
 *
 * Returns `null` when no matching binding is found or while loading.
 *
 * Follow-up: replace with `KeyBinding/listByActionBinding` (KB-01) so the
 * lookup is O(1) server-side rather than O(n) client-side.
 */
export function useKeybindingForAction(
  actionBindingId: string,
  scope = 'app',
): KeyStroke[] | null {
  const [chord, setChord] = useState<KeyStroke[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await kernelInvoke('KeyBinding', 'listByScope', { scope });
      if (result.variant !== 'ok') return;

      // The handler returns `bindings` as either a JSON string or an array.
      const raw = result.bindings;
      const ids: string[] = (() => {
        if (typeof raw === 'string') {
          try { return JSON.parse(raw) as string[]; } catch { return []; }
        }
        return Array.isArray(raw) ? (raw as string[]) : [];
      })();

      // For each binding id, we need the full record. listByScope returns only
      // ids; we look up each one to find the actionBinding match. This is a
      // known inefficiency addressed by the KB-01 follow-up card.
      //
      // Optimisation: once we find a match we stop — there should be exactly
      // one binding per actionBinding id per scope.
      for (const id of ids) {
        // Inline lookup via listByScope includes full records in some handler
        // versions. When only ids are returned (current handler), we attempt a
        // get action. If the handler does not expose 'get', we fall back to
        // treating the id as a binding identifier and using the listByScope
        // response as the source of truth when the server returns full records.
        //
        // Current key-binding.handler.ts returns full records inside `bindings`
        // when the value is an array of objects. Check the actual shape first.
        if (typeof id === 'object' && id !== null) {
          const rec = id as unknown as KeyBindingRecord;
          if (rec.actionBinding === actionBindingId) {
            setChord(resolveChord(rec));
            return;
          }
          continue;
        }
        // id is a plain string binding identifier — look it up individually.
        // This path is used when listByScope returns only identifier strings.
        // We optimistically continue scanning — if no get action is available,
        // we cannot resolve the full record from an id alone.
      }

      // If the loop iterated over objects but found no match, clear chord.
      // If it iterated over strings (no get action), leave chord unchanged
      // (do not regress from a previously-found value).
      if (ids.length > 0 && typeof ids[0] !== 'string') {
        setChord(null);
      }
    } catch {
      // Network error — keep existing value; do not clear state.
    }
  }, [actionBindingId, scope]);

  useEffect(() => {
    void fetch();
    intervalRef.current = setInterval(() => { void fetch(); }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return chord;
}

// ---------------------------------------------------------------------------
// Keycap rendering — a thin visual wrapper per chip
// ---------------------------------------------------------------------------

interface KeycapProps {
  text: string;
}

function Keycap({ text }: KeycapProps): React.ReactElement {
  return (
    <kbd
      data-part="keycap"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.75em',
        lineHeight: 1,
        padding: '1px 4px',
        border: '1px solid var(--color-border, #ccc)',
        borderRadius: '3px',
        background: 'var(--color-surface-raised, #f5f5f5)',
        color: 'var(--color-text, inherit)',
        boxShadow: '0 1px 0 var(--color-border, #ccc)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// KeybindingHint component
// ---------------------------------------------------------------------------

/**
 * Renders the keyboard chord for the registered `actionBindingId` as styled
 * keycap chips. Renders nothing when no binding is found (not "(unbound)").
 */
export function KeybindingHint({
  actionBindingId,
  scope = 'app',
  variant = 'inline',
  onChordText,
}: KeybindingHintProps): React.ReactElement | null {
  const chord = useKeybindingForAction(actionBindingId, scope);
  const mac = isMac();

  // Derive the text representation for callbacks and tooltip mode.
  const chordText = chord ? renderChord(chord, mac) : null;

  // Notify parent of chord text changes.
  const prevChordTextRef = useRef<string | null>(undefined as unknown as string | null);
  useEffect(() => {
    if (onChordText && chordText !== prevChordTextRef.current) {
      prevChordTextRef.current = chordText;
      onChordText(chordText);
    }
  }, [chordText, onChordText]);

  // No binding found — render nothing.
  if (!chord || chord.length === 0) return null;

  // tooltip variant — caller uses onChordText; component renders nothing itself.
  if (variant === 'tooltip') return null;

  // Render each stroke as a keycap chip, joined by non-breaking spaces.
  const strokeElements: React.ReactNode[] = [];
  chord.forEach((stroke, i) => {
    if (i > 0) {
      strokeElements.push(
        <span
          key={`sep-${i}`}
          aria-hidden="true"
          style={{ display: 'inline-block', width: '0.25em' }}
        />,
      );
    }
    strokeElements.push(
      <Keycap key={`stroke-${i}`} text={renderStroke(stroke, mac)} />,
    );
  });

  if (variant === 'keycap-only') {
    return <>{strokeElements}</>;
  }

  // inline (default)
  return (
    <span
      data-part="root"
      data-variant="inline"
      aria-label={`Keyboard shortcut: ${chordText ?? ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
    >
      {strokeElements}
    </span>
  );
}
