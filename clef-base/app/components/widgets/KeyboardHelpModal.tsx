'use client';

/**
 * KeyboardHelpModal — React adapter for surface/widgets/keyboard-help-modal.widget.
 *
 * Reads ActionBinding seeds that carry a `keyboard` or `keyChord` field, groups
 * the shortcuts by their `section` field, and renders a grouped cheat-sheet
 * with chord chips (e.g. "Cmd+B") alongside each action label.
 *
 * Opening: RecursiveBlockEditor dispatches Cmd+/ or ? to openKeyboardHelp()
 * which pushes this modal via ModalStackProvider.pushModal.
 * Closing: Escape (handled by ModalStackProvider) or the close button.
 *
 * The component renders chord text client-side only so platform-specific
 * modifiers (Cmd vs Ctrl) can be displayed correctly based on navigator.platform.
 *
 * Widget spec: surface/widgets/keyboard-help-modal.widget
 * Card: PP-keyboard-help (3c7748a2-36bd-4fd6-9621-24b045d667b2)
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

/** A single shortcut row derived from an ActionBinding seed. */
export interface ShortcutEntry {
  /** Category that groups this shortcut (Format, Navigate, Edit, etc.) */
  section: string;
  /** Human-readable description of what the shortcut does. */
  label: string;
  /** Raw chord string from the seed (e.g. "Ctrl+B", "Meta+/"). */
  chord: string;
}

export interface KeyboardHelpModalProps {
  /** Called when the modal requests closure. */
  onClose: () => void;
  /**
   * Optional pre-resolved shortcut list. When absent the component queries
   * ActionBinding/listByTag to build the list from registered seeds at runtime.
   */
  shortcuts?: ShortcutEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Display order and canonical names for shortcut categories. */
const CATEGORY_ORDER: string[] = [
  'Format',
  'Navigate',
  'Edit',
  'Insert',
  'Selection',
  'View',
];

/**
 * Hard-coded fallback shortcut list covering the shortcuts registered in
 * ActionBinding seeds. Displayed when the kernel query is unavailable or
 * while loading.
 */
const BUILTIN_SHORTCUTS: ShortcutEntry[] = [
  // Format
  { section: 'Format', label: 'Bold',           chord: 'Cmd+B' },
  { section: 'Format', label: 'Italic',          chord: 'Cmd+I' },
  { section: 'Format', label: 'Code',            chord: 'Cmd+E' },
  { section: 'Format', label: 'Strikethrough',   chord: 'Cmd+Shift+X' },
  { section: 'Format', label: 'Subscript',       chord: 'Cmd+Shift+-' },
  { section: 'Format', label: 'Superscript',     chord: 'Cmd+Shift+=' },
  { section: 'Format', label: 'Link',            chord: 'Cmd+K' },
  // Navigate
  { section: 'Navigate', label: 'Command Palette',    chord: 'Cmd+K' },
  { section: 'Navigate', label: 'Find / Replace',     chord: 'Cmd+F' },
  { section: 'Navigate', label: 'Keyboard Shortcuts', chord: 'Cmd+/' },
  // Edit
  { section: 'Edit', label: 'Undo',              chord: 'Cmd+Z' },
  { section: 'Edit', label: 'Redo',              chord: 'Cmd+Shift+Z' },
  { section: 'Edit', label: 'Slash Command Menu', chord: '/' },
  // Insert
  { section: 'Insert', label: 'Insert Image',    chord: 'Cmd+Shift+I' },
  { section: 'Insert', label: 'Math (LaTeX)',     chord: 'Cmd+Alt+M' },
  // Selection
  { section: 'Selection', label: 'Select All',   chord: 'Cmd+A' },
  // View
  { section: 'View', label: 'Toggle Focus Mode', chord: 'Cmd+.' },
  { section: 'View', label: 'Keyboard Shortcuts', chord: 'Cmd+/' },
];

// ---------------------------------------------------------------------------
// Chord rendering helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether the user is on macOS so we can swap "Meta" for "Cmd" and
 * "Ctrl" for "Ctrl" (or vice-versa). Runs client-side only.
 */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Normalise a raw chord string from seed data into a human-readable form.
 *
 * Input examples:
 *   "Ctrl+B"       → Mac: "Cmd+B",  Win: "Ctrl+B"
 *   "Meta+/"       → Mac: "Cmd+/",  Win: "Ctrl+/"
 *   "Ctrl+Shift+Z" → Mac: "Cmd+Shift+Z", Win: "Ctrl+Shift+Z"
 */
function formatChord(raw: string, mac: boolean): string {
  return raw
    .split('+')
    .map((part) => {
      if (part === 'Meta' || part === 'Ctrl') return mac ? 'Cmd' : 'Ctrl';
      if (part === 'Shift') return 'Shift';
      if (part === 'Alt') return mac ? 'Opt' : 'Alt';
      return part;
    })
    .join('+');
}

/**
 * Split a chord string into individual key token strings for rendering as
 * separate chip spans.
 *
 * "Cmd+Shift+B" → ["Cmd", "Shift", "B"]
 */
function chordTokens(chord: string): string[] {
  return chord.split('+');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ChordChipsProps {
  chord: string;
  mac: boolean;
}

const ChordChips: React.FC<ChordChipsProps> = ({ chord, mac }) => {
  const formatted = formatChord(chord, mac);
  const tokens = chordTokens(formatted);

  return (
    <span
      data-part="chord-chip-group"
      style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}
      aria-label={formatted}
    >
      {tokens.map((token, i) => (
        <React.Fragment key={i}>
          <kbd
            data-part="chord-chip"
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
              padding: '2px 6px',
              minWidth: '1.6rem',
              background: 'var(--palette-surface-container, #f3f3f3)',
              border: '1px solid var(--palette-outline-variant, #d1d5db)',
              borderRadius: '4px',
              color: 'var(--palette-on-surface, #1f2937)',
              boxShadow: '0 1px 0 0 var(--palette-outline-variant, #d1d5db)',
              userSelect: 'none',
            }}
          >
            {token}
          </kbd>
          {i < tokens.length - 1 && (
            <span
              aria-hidden="true"
              style={{ color: 'var(--palette-on-surface-variant, #6b7280)', fontSize: '0.7rem' }}
            >
              +
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

interface ShortcutRowProps {
  entry: ShortcutEntry;
  mac: boolean;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ entry, mac }) => (
  <li
    data-part="shortcut-row"
    data-section={entry.section}
    aria-label={entry.label}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid var(--palette-outline-variant, #e5e7eb)',
      gap: 'var(--spacing-md, 16px)',
    }}
  >
    <span
      data-part="action-label"
      style={{
        fontSize: '0.875rem',
        color: 'var(--palette-on-surface, #1f2937)',
        flexShrink: 0,
      }}
    >
      {entry.label}
    </span>
    <ChordChips chord={entry.chord} mac={mac} />
  </li>
);

interface GroupSectionProps {
  category: string;
  rows: ShortcutEntry[];
  mac: boolean;
}

const GroupSection: React.FC<GroupSectionProps> = ({ category, rows, mac }) => (
  <li
    data-part="group"
    data-category={category}
    aria-label={category}
    style={{ marginBottom: 'var(--spacing-lg, 24px)' }}
  >
    <h3
      data-part="group-label"
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--palette-on-surface-variant, #6b7280)',
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: '2px solid var(--palette-primary, #6366f1)',
        display: 'inline-block',
      }}
    >
      {category}
    </h3>
    <ul
      data-part="shortcut-list"
      role="list"
      aria-label={category}
      style={{ margin: 0, padding: 0, listStyle: 'none' }}
    >
      {rows.map((row, i) => (
        <ShortcutRow key={`${row.label}-${i}`} entry={row} mac={mac} />
      ))}
    </ul>
  </li>
);

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

type FsmState = 'open';

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({
  onClose,
  shortcuts: shortcutsProp,
}) => {
  const invoke = useKernelInvoke();

  // ---- FSM state (widget spec: visibility = open while mounted) ----
  const [fsmState] = useState<FsmState>('open');

  // ---- Shortcut data ----
  const [shortcuts, setShortcuts] = useState<ShortcutEntry[]>(
    shortcutsProp ?? BUILTIN_SHORTCUTS,
  );

  // ---- Filter query ----
  const [filterQuery, setFilterQuery] = useState('');
  const [filterState, setFilterState] = useState<'idle' | 'filtering'>('idle');

  // ---- Mac vs Win chord rendering ----
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(isMac());
  }, []);

  // ---- Attempt to load live shortcut data from ActionBinding/listByTag ----
  useEffect(() => {
    if (shortcutsProp) return; // caller provided data — skip kernel query

    let cancelled = false;

    async function loadShortcuts() {
      try {
        const result = await invoke('ActionBinding', 'listByTag', {
          tag: 'editor_keyboard_chord',
        });

        if (cancelled) return;

        if (result.variant === 'ok') {
          const raw: Array<Record<string, unknown>> = Array.isArray(result.entries)
            ? (result.entries as Array<Record<string, unknown>>)
            : [];

          const parsed: ShortcutEntry[] = raw
            .filter((entry) => {
              const chord = (entry.keyboard ?? entry.keyChord ?? entry.keyboard_shortcut ?? '') as string;
              return chord !== '' && chord != null;
            })
            .map((entry) => ({
              section: (entry.section as string | undefined) ?? 'Edit',
              label:   (entry.label as string | undefined) ?? String(entry.name ?? entry.binding ?? ''),
              chord:   String(entry.keyboard ?? entry.keyChord ?? entry.keyboard_shortcut ?? ''),
            }));

          if (parsed.length > 0) {
            setShortcuts(parsed);
          }
          // If parsed is empty, keep the built-in fallback.
        }
      } catch {
        // ActionBinding/listByTag not available — built-in fallback stays
      }
    }

    loadShortcuts();
    return () => { cancelled = true; };
  }, [invoke, shortcutsProp]);

  // ---- Filter logic ----
  const filteredShortcuts = useMemo(() => {
    if (!filterQuery.trim()) return shortcuts;
    const q = filterQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q) ||
        s.chord.toLowerCase().includes(q),
    );
  }, [shortcuts, filterQuery]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setFilterQuery(q);
    setFilterState(q.trim() ? 'filtering' : 'idle');
  }, []);

  // ---- Group by section in canonical order ----
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, ShortcutEntry[]>();

    for (const s of filteredShortcuts) {
      const key = CATEGORY_ORDER.includes(s.section) ? s.section : 'Edit';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    // Return in CATEGORY_ORDER, only categories that have at least one row
    return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      category: cat,
      rows: map.get(cat)!,
    }));
  }, [filteredShortcuts]);

  const hasResults = groupedByCategory.length > 0;

  // ---- Keyboard: Escape closes ----
  // ModalStackProvider already handles Escape globally; this handler is a
  // belt-and-suspenders guard for when the modal is used standalone.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  // ---- Focus: move focus to search input on mount ----
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-widget="keyboard-help-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      aria-describedby="kh-group-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 'min(640px, 92vw)',
        maxHeight: '80vh',
        background: 'var(--palette-surface, #ffffff)',
        borderRadius: '10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--palette-outline-variant, #e5e7eb)',
          flexShrink: 0,
        }}
      >
        <h2
          data-part="title"
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--palette-on-surface, #111827)',
          }}
        >
          Keyboard Shortcuts
        </h2>

        <button
          data-part="close-button"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--palette-on-surface-variant, #6b7280)',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high, #e5e7eb)';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {/* X icon */}
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* search input                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--palette-outline-variant, #e5e7eb)',
          flexShrink: 0,
        }}
      >
        <input
          ref={searchRef}
          data-part="search-input"
          type="search"
          value={filterQuery}
          onChange={handleFilterChange}
          placeholder="Filter shortcuts..."
          aria-label="Filter shortcuts"
          aria-controls="kh-group-list"
          role="searchbox"
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid var(--palette-outline-variant, #d1d5db)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            background: 'var(--palette-surface-container, #f9fafb)',
            color: 'var(--palette-on-surface, #111827)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* panel — scrollable shortcut list                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={panelRef}
        data-part="panel"
        role="document"
        style={{
          overflowY: 'auto',
          padding: '16px 20px 20px',
          flexGrow: 1,
        }}
      >
        {hasResults ? (
          <ul
            id="kh-group-list"
            data-part="group-list"
            data-filter-state={filterState}
            role="list"
            aria-label="Shortcut categories"
            aria-live="polite"
            style={{ margin: 0, padding: 0, listStyle: 'none' }}
          >
            {groupedByCategory.map(({ category, rows }) => (
              <GroupSection key={category} category={category} rows={rows} mac={mac} />
            ))}
          </ul>
        ) : (
          <div
            data-part="empty-state"
            role="status"
            aria-live="polite"
            aria-label="No shortcuts match your filter"
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: 'var(--palette-on-surface-variant, #9ca3af)',
              fontSize: '0.875rem',
            }}
          >
            No shortcuts match &ldquo;{filterQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};

export default KeyboardHelpModal;
