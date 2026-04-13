'use client';

/**
 * KeybindingEditor — React component implementing surface/keybinding-editor.widget.
 *
 * Widget spec: surface/keybinding-editor.widget (landed at 14abf232)
 * PRD:         docs/plans/keybinding-prd.md Phase D
 * Card:        KB-09
 *
 * ## Three modes
 *
 *   view   — searchable + category-filtered list. No detail pane, no recorder.
 *   edit   — 3-pane layout: list | detail | recorder + conflict panel.
 *            Selected binding comes from props.context (binding id string).
 *   create — same as edit but detail pane starts empty and recorder is
 *            immediately ready. Save creates a new KeyBinding.
 *
 * ## Recorder
 *
 * Inline (blocking, not modal). Sets recorderActive.current = true while
 * capturing so the global dispatcher (useKeyBindings) yields. Captures
 * keyboard events directly on the recorder <div>. Chord recording:
 *
 *   stroke 1 → KEY_CAPTURED → recordingChordStage2 state, shows "_" prompt
 *   stroke 2 → KEY_CAPTURED → idle, finalizes chord
 *   Enter     → SINGLE_STROKE_CONFIRM (finalize 1-stroke chord)
 *   Backspace → BACKSPACE_STROKE (in stage-2: remove last stroke, back to recording)
 *   Esc       → CANCEL_RECORDING (restore prior chord, recorderActive = false)
 *
 * On finalize:
 *   edit mode   → KeyBinding/setOverride
 *   create mode → KeyBinding/register
 *
 * ## Conflict handling
 *
 * When a chord matches an existing binding in the scope, state → conflict.
 * Three inline options:
 *   Replace existing  → setOverride (overwrite)
 *   Keep both         → setOverride with priority bump
 *   Cancel            → restore prior chord, back to idle
 *
 * ## Data / polling
 *
 * Same 5 s polling pattern as KeybindingHint. All bindings are fetched via
 * KeyBinding/listByScope("app") and filtered client-side.
 *
 * ## Accessibility (per widget spec)
 *
 * - role="region" + aria-label on root
 * - search: role="searchbox" + aria-label
 * - list: role="listbox" + aria-live="polite"
 * - listItem: role="option"
 * - recorder: role="textbox" + aria-label
 * - conflictWarning: role="alert" (always in DOM, visibility toggled)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { recorderActive } from '../../../lib/useKeyBindings';
import { isMac, renderChord } from './KeybindingHint';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyStroke {
  mod: string[];
  key: string;
  code: string;
}

export interface KeyBindingRecord {
  binding: string;
  actionBinding: string;
  chord: KeyStroke[];
  scope: string;
  label: string;
  category?: string;
  isModified?: boolean;
  defaultChord?: KeyStroke[];
}

/** FSM states matching keybinding-editor.widget */
export type RecorderState =
  | 'idle'
  | 'recording'
  | 'recordingChordStage2'
  | 'conflict';

/** A conflict found when the newly recorded chord overlaps an existing binding. */
export interface ConflictInfo {
  existingBindingId: string;
  existingLabel: string;
}

export interface KeybindingEditorProps {
  /** "view" | "edit" | "create" — defaults to "view" */
  mode?: 'view' | 'edit' | 'create';
  /** Selected binding id for edit; null for create/view */
  context?: string | null;
  /** Optional scope subtree filter */
  scopeFilter?: string;
  /**
   * Called when the user clicks a binding row in view mode.
   * Receives the binding id of the clicked row. Callers can use this
   * to switch the enclosing modal to edit mode (KB-07) or navigate to
   * a dedicated editor page.
   */
  onSelectBinding?: (bindingId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
/** After first stroke, wait this long before treating it as a chord request. */
const CHORD_STAGE2_PROMPT_MS = 200;

// ---------------------------------------------------------------------------
// Kernel helper (same pattern as KeybindingHint)
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
// Modifier extraction (mirrors useKeyBindings)
// ---------------------------------------------------------------------------

function extractModifiers(event: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (event.metaKey) mods.push('meta');
  if (event.ctrlKey) mods.push('ctrl');
  if (event.altKey) mods.push('alt');
  if (event.shiftKey) mods.push('shift');

  const mac =
    typeof navigator !== 'undefined' &&
    /mac/i.test(navigator.platform || navigator.userAgent);

  if (mac && mods.includes('meta') && !mods.includes('ctrl')) {
    return mods.map((m) => (m === 'meta' ? 'mod' : m));
  }
  if (!mac && mods.includes('ctrl') && !mods.includes('meta')) {
    return mods.map((m) => (m === 'ctrl' ? 'mod' : m));
  }
  return mods;
}

// ---------------------------------------------------------------------------
// Keycap chip (re-use KeybindingHint's Keycap style without importing the
// internal unexported component — inline equivalent)
// ---------------------------------------------------------------------------

function KeycapChip({ text }: { text: string }): React.ReactElement {
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

function ChordChips({ chord }: { chord: KeyStroke[] }): React.ReactElement {
  const mac = isMac();
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {chord.map((stroke, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden="true"
              style={{ fontSize: '0.75em', color: 'var(--color-text-muted, #888)' }}
            >
              {'\u00A0'}
            </span>
          )}
          <KeycapChip text={renderChord([stroke], mac)} />
        </React.Fragment>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// useAllBindings — polling hook
// ---------------------------------------------------------------------------

function useAllBindings(scope = 'app'): KeyBindingRecord[] {
  const [bindings, setBindings] = useState<KeyBindingRecord[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBindings = useCallback(async () => {
    try {
      const result = await kernelInvoke('KeyBinding', 'listByScope', { scope });
      if (result.variant !== 'ok') return;

      const raw = result.bindings;
      const records: KeyBindingRecord[] = (() => {
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw) as KeyBindingRecord[];
          } catch {
            return [];
          }
        }
        if (Array.isArray(raw)) {
          return raw.filter(
            (r): r is KeyBindingRecord =>
              typeof r === 'object' && r !== null && 'binding' in r,
          );
        }
        return [];
      })();

      setBindings(records);
    } catch {
      // Network error — keep existing value.
    }
  }, [scope]);

  useEffect(() => {
    void fetchBindings();
    intervalRef.current = setInterval(() => {
      void fetchBindings();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchBindings]);

  return bindings;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KeybindingEditor({
  mode = 'view',
  context = null,
  scopeFilter,
  onSelectBinding,
}: KeybindingEditorProps): React.ReactElement {
  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------

  const allBindings = useAllBindings('app');

  // ------------------------------------------------------------------
  // Filter state
  // ------------------------------------------------------------------

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showOnlyModified, setShowOnlyModified] = useState(false);

  const filteredBindings = allBindings.filter((b) => {
    if (scopeFilter && !b.scope.startsWith(scopeFilter)) return false;
    if (showOnlyModified && !b.isModified) return false;
    if (selectedCategory && b.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inLabel = b.label.toLowerCase().includes(q);
      const inScope = b.scope.toLowerCase().includes(q);
      const inChord = renderChord(b.chord, isMac()).toLowerCase().includes(q);
      if (!inLabel && !inScope && !inChord) return false;
    }
    return true;
  });

  const categories = Array.from(new Set(allBindings.map((b) => b.category ?? ''))).filter(Boolean);

  // ------------------------------------------------------------------
  // Selected binding (for detail pane)
  // ------------------------------------------------------------------

  const selectedBinding = context
    ? allBindings.find((b) => b.binding === context) ?? null
    : null;

  // ------------------------------------------------------------------
  // Recorder FSM state
  // ------------------------------------------------------------------

  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [recordedStrokes, setRecordedStrokes] = useState<KeyStroke[]>([]);
  const [priorChord, setPriorChord] = useState<KeyStroke[]>([]);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  // Ref to recorder element for programmatic focus.
  const recorderRef = useRef<HTMLDivElement | null>(null);

  // Stage-2 timeout ref — after first stroke, wait 200 ms before prompting.
  const stage2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kernel invoke hook (available via ClefProvider in the real app).
  // Fallback to kernelInvoke if not inside a ClefProvider (e.g. standalone admin page).
  type KernelCallFn = (concept: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  let _invoke: KernelCallFn | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    _invoke = useKernelInvoke() as KernelCallFn;
  } catch {
    _invoke = kernelInvoke;
  }

  const kernelCall: KernelCallFn = _invoke ?? kernelInvoke;

  // ------------------------------------------------------------------
  // Helpers: conflict detection
  // ------------------------------------------------------------------

  const detectConflict = useCallback(
    (chord: KeyStroke[]): ConflictInfo | null => {
      const chordStr = JSON.stringify(chord);
      for (const b of allBindings) {
        if (context && b.binding === context) continue; // same binding, ignore self
        if (JSON.stringify(b.chord) === chordStr) {
          // Check scope overlap — simplistic: same scope prefix.
          if (!scopeFilter || b.scope.startsWith(scopeFilter)) {
            return { existingBindingId: b.binding, existingLabel: b.label };
          }
        }
      }
      return null;
    },
    [allBindings, context, scopeFilter],
  );

  // ------------------------------------------------------------------
  // Helpers: finalize chord
  // ------------------------------------------------------------------

  const finalizeChord = useCallback(
    async (chord: KeyStroke[]) => {
      const conflictInfo = detectConflict(chord);
      if (conflictInfo) {
        setConflict(conflictInfo);
        setRecorderState('conflict');
        return;
      }

      // Persist.
      try {
        if (mode === 'edit' && context) {
          await kernelCall('KeyBinding', 'setOverride', {
            binding: context,
            chord: JSON.stringify(chord),
          });
        } else if (mode === 'create') {
          await kernelCall('KeyBinding', 'register', {
            chord: JSON.stringify(chord),
            scope: scopeFilter ?? 'app',
          });
        }
      } catch {
        // Non-fatal — UI remains responsive.
      }

      recorderActive.current = false;
      setRecordedStrokes([]);
      setRecorderState('idle');
    },
    [mode, context, scopeFilter, kernelCall, detectConflict],
  );

  // ------------------------------------------------------------------
  // START RECORDING
  // ------------------------------------------------------------------

  const startRecording = useCallback(() => {
    if (recorderState !== 'idle') return;

    // Save prior chord so Esc can restore it.
    const prior = selectedBinding?.chord ?? [];
    setPriorChord(prior);
    setRecordedStrokes([]);
    setConflict(null);

    recorderActive.current = true;
    setRecorderState('recording');

    // Focus the recorder element.
    setTimeout(() => {
      recorderRef.current?.focus();
    }, 0);
  }, [recorderState, selectedBinding]);

  // ------------------------------------------------------------------
  // CANCEL RECORDING
  // ------------------------------------------------------------------

  const cancelRecording = useCallback(() => {
    if (stage2TimerRef.current !== null) {
      clearTimeout(stage2TimerRef.current);
      stage2TimerRef.current = null;
    }
    recorderActive.current = false;
    setRecordedStrokes(priorChord);
    setConflict(null);
    setRecorderState('idle');
  }, [priorChord]);

  // ------------------------------------------------------------------
  // Recorder keydown handler
  // ------------------------------------------------------------------

  const handleRecorderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const key = event.key;
      const code = event.code;
      const mod = extractModifiers(event.nativeEvent);

      // Esc → cancel.
      if (key === 'Escape') {
        cancelRecording();
        return;
      }

      if (recorderState === 'recording') {
        // Backspace in stage-1 just cancels (no strokes yet).
        if (key === 'Backspace') {
          cancelRecording();
          return;
        }

        // Enter with no strokes yet → cancel.
        if (key === 'Enter' && recordedStrokes.length === 0) {
          cancelRecording();
          return;
        }

        // Skip bare modifier-only keys.
        if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return;

        const stroke: KeyStroke = { mod, key, code };

        if (key === 'Enter') {
          // Enter after stage-1 content: finalize single stroke.
          if (recordedStrokes.length > 0) {
            void finalizeChord(recordedStrokes);
          }
          return;
        }

        // First real keystroke — go to stage-2 if there was already a stroke,
        // otherwise record and prompt.
        const newStrokes = [stroke];
        setRecordedStrokes(newStrokes);

        // Transition to recordingChordStage2 after a brief pause.
        if (stage2TimerRef.current !== null) clearTimeout(stage2TimerRef.current);
        stage2TimerRef.current = setTimeout(() => {
          stage2TimerRef.current = null;
          setRecorderState('recordingChordStage2');
        }, CHORD_STAGE2_PROMPT_MS);

        return;
      }

      if (recorderState === 'recordingChordStage2') {
        // Backspace → remove last stroke, return to recording.
        if (key === 'Backspace') {
          if (stage2TimerRef.current !== null) {
            clearTimeout(stage2TimerRef.current);
            stage2TimerRef.current = null;
          }
          setRecordedStrokes((prev) => prev.slice(0, -1));
          setRecorderState('recording');
          return;
        }

        // Enter → finalize current strokes.
        if (key === 'Enter') {
          void finalizeChord(recordedStrokes);
          return;
        }

        // Skip bare modifiers.
        if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return;

        // Second real keystroke → finalize chord.
        const stroke: KeyStroke = { mod, key, code };
        const newStrokes = [...recordedStrokes, stroke];
        setRecordedStrokes(newStrokes);

        if (stage2TimerRef.current !== null) {
          clearTimeout(stage2TimerRef.current);
          stage2TimerRef.current = null;
        }

        void finalizeChord(newStrokes);
        return;
      }
    },
    [recorderState, recordedStrokes, cancelRecording, finalizeChord],
  );

  // ------------------------------------------------------------------
  // Conflict resolution handlers
  // ------------------------------------------------------------------

  const handleResolveReplace = useCallback(async () => {
    if (!conflict) return;
    try {
      await kernelCall('KeyBinding', 'setOverride', {
        binding: conflict.existingBindingId,
        chord: JSON.stringify([]), // clear existing
      });
      if (mode === 'edit' && context) {
        await kernelCall('KeyBinding', 'setOverride', {
          binding: context,
          chord: JSON.stringify(recordedStrokes),
        });
      } else if (mode === 'create') {
        await kernelCall('KeyBinding', 'register', {
          chord: JSON.stringify(recordedStrokes),
          scope: scopeFilter ?? 'app',
        });
      }
    } catch {
      // Non-fatal.
    }
    recorderActive.current = false;
    setConflict(null);
    setRecordedStrokes([]);
    setRecorderState('idle');
  }, [conflict, mode, context, scopeFilter, kernelCall, recordedStrokes]);

  const handleResolveKeepBoth = useCallback(async () => {
    if (!conflict) return;
    try {
      if (mode === 'edit' && context) {
        await kernelCall('KeyBinding', 'setOverride', {
          binding: context,
          chord: JSON.stringify(recordedStrokes),
          priorityBump: true,
        });
      } else if (mode === 'create') {
        await kernelCall('KeyBinding', 'register', {
          chord: JSON.stringify(recordedStrokes),
          scope: scopeFilter ?? 'app',
          priorityBump: true,
        });
      }
    } catch {
      // Non-fatal.
    }
    recorderActive.current = false;
    setConflict(null);
    setRecordedStrokes([]);
    setRecorderState('idle');
  }, [conflict, mode, context, scopeFilter, kernelCall, recordedStrokes]);

  const handleCancelConflict = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  // ------------------------------------------------------------------
  // Reset binding handler
  // ------------------------------------------------------------------

  const handleResetBinding = useCallback(async () => {
    if (!context) return;
    try {
      await kernelCall('KeyBinding', 'resetOverride', { binding: context });
    } catch {
      // Non-fatal.
    }
  }, [context, kernelCall]);

  // ------------------------------------------------------------------
  // Cleanup recorderActive on unmount
  // ------------------------------------------------------------------

  useEffect(() => {
    return () => {
      recorderActive.current = false;
      if (stage2TimerRef.current !== null) clearTimeout(stage2TimerRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const isRecording =
    recorderState === 'recording' || recorderState === 'recordingChordStage2';
  const isConflict = recorderState === 'conflict';
  const showDetailPane = mode === 'edit' || mode === 'create';
  const showRecorder = mode === 'edit' || mode === 'create';

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function renderListItem(b: KeyBindingRecord): React.ReactElement {
    const isSelected = b.binding === context;
    return (
      <div
        key={b.binding}
        data-part="list-item"
        data-binding-id={b.binding}
        role="option"
        aria-selected={isSelected}
        aria-label={`${b.label}, chord: ${renderChord(b.chord, isMac())}, scope: ${b.scope}`}
        tabIndex={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          cursor: 'pointer',
          background: isSelected
            ? 'var(--color-surface-selected, #e8f0fe)'
            : 'transparent',
          borderBottom: '1px solid var(--color-border-subtle, #eee)',
        }}
        onClick={() => {
          // In view mode, notify the caller so it can switch to edit mode (KB-07/KB-12).
          // In edit/create mode context comes from props — no-op here.
          if (mode === 'view' && onSelectBinding) {
            onSelectBinding(b.binding);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.currentTarget.click();
          }
        }}
      >
        <div data-part="item-label" style={{ flex: 1, fontSize: '0.875rem' }}>
          {b.label}
        </div>
        <div
          data-part="keycap-chips"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {b.chord.length > 0 ? (
            <ChordChips chord={b.chord} />
          ) : (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted, #888)',
                fontStyle: 'italic',
              }}
            >
              unbound
            </span>
          )}
        </div>
        <div
          data-part="scope-path"
          style={{
            fontSize: '0.7rem',
            color: 'var(--color-text-muted, #888)',
            marginLeft: '8px',
            minWidth: '120px',
            textAlign: 'right',
          }}
        >
          {b.scope}
        </div>
        {b.isModified && (
          <div
            data-part="modified-indicator"
            style={{
              marginLeft: '6px',
              fontSize: '0.65rem',
              background: 'var(--color-accent-subtle, #fff3cd)',
              color: 'var(--color-accent-text, #856404)',
              borderRadius: '3px',
              padding: '1px 4px',
            }}
          >
            modified
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Recorder display
  // ------------------------------------------------------------------

  function renderRecorder(): React.ReactElement {
    return (
      <div style={{ marginTop: '8px' }}>
        {recorderState === 'idle' && (
          <button
            type="button"
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              border: '1px solid var(--color-border, #ccc)',
              borderRadius: '4px',
              background: 'var(--color-surface, #fff)',
            }}
            onClick={startRecording}
          >
            {mode === 'create' ? 'Record binding' : 'Edit binding'}
          </button>
        )}

        {(isRecording || isConflict) && (
          <div
            ref={recorderRef}
            data-part="recorder"
            data-recording={isRecording ? 'true' : 'false'}
            role="textbox"
            aria-label="Press a key combination to bind"
            aria-live="assertive"
            tabIndex={0}
            onKeyDown={handleRecorderKeyDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              border: `2px solid ${isConflict ? 'var(--color-error, #d32f2f)' : 'var(--color-accent, #1a73e8)'}`,
              borderRadius: '4px',
              background: 'var(--color-surface, #fff)',
              outline: 'none',
              minHeight: '36px',
              cursor: 'text',
            }}
          >
            {recordedStrokes.length > 0 ? (
              <ChordChips chord={recordedStrokes} />
            ) : (
              <span
                style={{
                  color: 'var(--color-text-placeholder, #aaa)',
                  fontSize: '0.875rem',
                }}
              >
                Press a key...
              </span>
            )}
            {recorderState === 'recordingChordStage2' && (
              <span
                aria-hidden="true"
                style={{
                  color: 'var(--color-text-muted, #888)',
                  fontSize: '0.875rem',
                }}
              >
                _
              </span>
            )}
          </div>
        )}

        {/* Conflict warning — always in DOM per invariant */}
        <div
          data-part="conflict-warning"
          data-conflict={isConflict ? 'true' : 'false'}
          role="alert"
          aria-live="assertive"
          hidden={!isConflict}
          style={
            isConflict
              ? {
                  marginTop: '8px',
                  padding: '10px 12px',
                  border: '1px solid var(--color-error, #d32f2f)',
                  borderRadius: '4px',
                  background: 'var(--color-error-subtle, #fdecea)',
                  fontSize: '0.875rem',
                }
              : { display: 'none' }
          }
        >
          {isConflict && conflict && (
            <>
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>
                Chord already bound to:{' '}
                <strong>{conflict.existingLabel}</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={conflictButtonStyle}
                  onClick={() => void handleResolveReplace()}
                >
                  Replace existing binding
                </button>
                <button
                  type="button"
                  style={conflictButtonStyle}
                  onClick={() => void handleResolveKeepBoth()}
                >
                  Keep both (priority)
                </button>
                <button
                  type="button"
                  style={{ ...conflictButtonStyle, background: 'transparent' }}
                  onClick={handleCancelConflict}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Detail pane
  // ------------------------------------------------------------------

  function renderDetailPane(): React.ReactElement {
    return (
      <div
        data-part="detail-pane"
        role="region"
        aria-label="Binding detail"
        style={{
          flex: '0 0 260px',
          padding: '12px',
          borderLeft: '1px solid var(--color-border, #eee)',
          overflowY: 'auto',
        }}
      >
        {selectedBinding ? (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>
              {selectedBinding.label}
            </h3>
            <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--color-text-muted, #888)' }}>
              Scope: {selectedBinding.scope}
            </p>
            {selectedBinding.category && (
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--color-text-muted, #888)' }}>
                Category: {selectedBinding.category}
              </p>
            )}
            <div style={{ margin: '8px 0' }}>
              <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Current chord:
              </span>
              {selectedBinding.chord.length > 0 ? (
                <ChordChips chord={selectedBinding.chord} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #888)', fontStyle: 'italic' }}>
                  unbound
                </span>
              )}
            </div>
            {selectedBinding.isModified && selectedBinding.defaultChord && (
              <div style={{ margin: '8px 0' }}>
                <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                  Default chord:
                </span>
                <ChordChips chord={selectedBinding.defaultChord} />
              </div>
            )}
            <button
              data-part="reset-button"
              type="button"
              role="button"
              aria-label="Reset binding to default"
              style={{
                marginTop: '8px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: '1px solid var(--color-border, #ccc)',
                borderRadius: '4px',
                background: 'var(--color-surface, #fff)',
              }}
              onClick={() => void handleResetBinding()}
            >
              Reset to default
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--color-text-muted, #888)', fontSize: '0.875rem' }}>
            {mode === 'create' ? 'New binding' : 'No binding selected'}
          </p>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Root render
  // ------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={recorderState}
      data-mode={mode}
      role="region"
      aria-label="Keybinding editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        background: 'var(--color-background, #fff)',
        color: 'var(--color-text, inherit)',
      }}
    >
      {/* ---- Toolbar row ---- */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border, #eee)',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <input
          data-part="search"
          type="search"
          role="searchbox"
          aria-label="Search keybindings"
          aria-controls="keybinding-list"
          placeholder="Search by action name or key"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1',
            minWidth: '160px',
            padding: '4px 8px',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        />

        {/* Category filter */}
        <select
          data-part="category-filter"
          role="combobox"
          aria-label="Filter by category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Modified filter toggle */}
        <button
          data-part="modified-filter"
          type="button"
          role="button"
          aria-label="Show only modified bindings"
          aria-pressed={showOnlyModified}
          onClick={() => setShowOnlyModified((v) => !v)}
          style={{
            padding: '4px 10px',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '4px',
            background: showOnlyModified
              ? 'var(--color-accent-subtle, #e8f0fe)'
              : 'var(--color-surface, #fff)',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Modified only
        </button>

        {/* Preset picker */}
        <select
          data-part="preset-picker"
          role="combobox"
          aria-label="Select keybinding preset"
          defaultValue=""
          onChange={() => {
            // KB-10 will wire preset application; no-op for v1.
          }}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          <option value="">Preset...</option>
          <option value="vscode">VS Code</option>
          <option value="vim">Vim</option>
          <option value="emacs">Emacs</option>
        </select>
      </div>

      {/* ---- Main content row ---- */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ---- List pane ---- */}
        <div
          style={{
            flex: showDetailPane ? '1 1 auto' : '1',
            overflowY: 'auto',
            borderRight: showDetailPane
              ? '1px solid var(--color-border, #eee)'
              : 'none',
          }}
        >
          <div
            id="keybinding-list"
            data-part="list"
            role="listbox"
            aria-label="Keybinding list"
            aria-live="polite"
          >
            {filteredBindings.length === 0 ? (
              <p
                style={{
                  padding: '16px 12px',
                  color: 'var(--color-text-muted, #888)',
                  fontSize: '0.875rem',
                }}
              >
                No keybindings match your filters.
              </p>
            ) : (
              filteredBindings.map(renderListItem)
            )}
          </div>
        </div>

        {/* ---- Detail pane (edit/create only) ---- */}
        {showDetailPane && renderDetailPane()}

        {/* ---- Recorder pane (edit/create only) ---- */}
        {showRecorder && (
          <div
            style={{
              flex: '0 0 240px',
              padding: '12px',
              borderLeft: '1px solid var(--color-border, #eee)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>
              Keyboard recorder
            </h4>
            {renderRecorder()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const conflictButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  border: '1px solid var(--color-border, #ccc)',
  borderRadius: '4px',
  background: 'var(--color-surface, #fff)',
};
