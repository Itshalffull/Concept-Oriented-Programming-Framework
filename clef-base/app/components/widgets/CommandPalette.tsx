'use client';

/**
 * CommandPalette — React adapter for command-palette.widget spec.
 *
 * Opens via ModalStackProvider (Cmd+K from RecursiveBlockEditor). Provides
 * fuzzy-search across:
 *   - ContentNode/search results  (Pages section)
 *   - ActionBinding seeds tagged palette_command or slash_command  (Commands section)
 *   - Recently visited pages from sessionStorage  (Recents section)
 *
 * Keyboard: ArrowUp/Down navigate the result list; Enter confirms the
 * highlighted item; Escape is handled by ModalStackProvider and closes the
 * containing modal layer.
 *
 * Widget spec: surface/widgets/command-palette.widget
 * PRD card: PP-command-palette (df2a224d-e059-4ab4-b4b1-7c07124bfec2)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaletteResultKind = 'page' | 'command' | 'recent';

export interface PaletteResult {
  id: string;
  kind: PaletteResultKind;
  label: string;
  meta: string;
  /** For pages: the ContentNode id to navigate to. */
  nodeId?: string;
  /** For commands: the ActionBinding id to invoke. */
  bindingId?: string;
  /** For recents: the ContentNode id to navigate to. */
  recentNodeId?: string;
}

export interface PaletteSection {
  label: string;
  items: PaletteResult[];
}

export interface CommandPaletteProps {
  /** Called when the user navigates to a page result. */
  onNavigate?: (nodeId: string) => void;
  /** Called when the user fires a command result. */
  onCommand?: (bindingId: string) => void;
  /** Context passed to ActionBinding/invoke for commands. */
  commandContext?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Recent pages helper — thin sessionStorage wrapper
// ---------------------------------------------------------------------------

const RECENTS_KEY = 'clef_command_palette_recents';
const MAX_RECENTS = 8;

interface RecentEntry {
  nodeId: string;
  label: string;
  ts: number;
}

function loadRecents(): RecentEntry[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentEntry[];
  } catch {
    return [];
  }
}

export function recordRecentPage(nodeId: string, label: string): void {
  try {
    const existing = loadRecents().filter((r) => r.nodeId !== nodeId);
    const updated: RecentEntry[] = [
      { nodeId, label, ts: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENTS);
    sessionStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch {
    // sessionStorage unavailable — skip silently
  }
}

// ---------------------------------------------------------------------------
// Fuzzy match — returns true if all chars of needle appear in order in haystack
// ---------------------------------------------------------------------------

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const pos = h.indexOf(n[ni], hi);
    if (pos === -1) return false;
    hi = pos + 1;
  }
  return true;
}

/**
 * Returns an array of {text, matched} segments for rendering highlighted matches.
 * Simple character-by-character match; highlights all contiguous matched runs.
 */
function fuzzyHighlight(
  haystack: string,
  needle: string,
): Array<{ text: string; matched: boolean }> {
  if (!needle) return [{ text: haystack, matched: false }];

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  // Collect matched character positions
  const matchedPositions = new Set<number>();
  let hi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const pos = h.indexOf(n[ni], hi);
    if (pos === -1) break;
    matchedPositions.add(pos);
    hi = pos + 1;
  }

  // Group into contiguous segments
  const segments: Array<{ text: string; matched: boolean }> = [];
  let i = 0;
  while (i < haystack.length) {
    const matched = matchedPositions.has(i);
    let j = i + 1;
    while (j < haystack.length && matchedPositions.has(j) === matched) {
      j++;
    }
    segments.push({ text: haystack.slice(i, j), matched });
    i = j;
  }
  return segments;
}

// ---------------------------------------------------------------------------
// CommandPalette component
// ---------------------------------------------------------------------------

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onNavigate,
  onCommand,
  commandContext = {},
}) => {
  const invoke = useKernelInvoke();

  const [query, setQuery] = useState('');
  const [sections, setSections] = useState<PaletteSection[]>([]);
  const [flatItems, setFlatItems] = useState<PaletteResult[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // --------------------------------------------------------------------------
  // Focus search input on mount
  // --------------------------------------------------------------------------

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // --------------------------------------------------------------------------
  // Load data on query change
  // --------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const newSections: PaletteSection[] = [];

      // --- Recents section ---
      const recents = loadRecents();
      const recentItems: PaletteResult[] = recents
        .filter((r) => fuzzyMatch(r.label, query))
        .map((r) => ({
          id: `recent:${r.nodeId}`,
          kind: 'recent' as PaletteResultKind,
          label: r.label,
          meta: 'Recently visited',
          recentNodeId: r.nodeId,
        }));

      if (recentItems.length > 0) {
        newSections.push({ label: 'Recents', items: recentItems });
      }

      // --- Pages section — ContentNode/search ---
      try {
        const searchResult = await invoke('ContentNode', 'search', {
          query: query || '',
          limit: 20,
        });
        if (!cancelled && searchResult.variant === 'ok') {
          const nodes: Array<Record<string, unknown>> =
            typeof searchResult.nodes === 'string'
              ? JSON.parse(searchResult.nodes)
              : (searchResult.nodes as Array<Record<string, unknown>> ?? []);

          const pageItems: PaletteResult[] = nodes
            .filter((n) => fuzzyMatch(String(n.title ?? n.id ?? ''), query))
            .map((n) => ({
              id: `page:${String(n.id)}`,
              kind: 'page' as PaletteResultKind,
              label: String(n.title ?? n.id ?? 'Untitled'),
              meta: String(n.schema ?? n.kind ?? ''),
              nodeId: String(n.id),
            }));

          if (pageItems.length > 0) {
            newSections.push({ label: 'Pages', items: pageItems });
          }
        }
      } catch {
        // Non-fatal — ContentNode/search may not be available
      }

      // --- Commands section — ActionBinding/listByTag ---
      const commandItems: PaletteResult[] = [];
      for (const tag of ['palette_command', 'slash_command']) {
        try {
          const bindingResult = await invoke('ActionBinding', 'listByTag', {
            tag,
          });
          if (!cancelled && bindingResult.variant === 'ok') {
            const bindings: Array<Record<string, unknown>> =
              typeof bindingResult.items === 'string'
                ? JSON.parse(bindingResult.items)
                : (bindingResult.items as Array<Record<string, unknown>> ?? []);

            for (const b of bindings) {
              const label = String(b.label ?? b.binding ?? '');
              if (!fuzzyMatch(label, query)) continue;
              const id = `command:${String(b.id ?? b.binding)}`;
              if (commandItems.some((c) => c.id === id)) continue;
              commandItems.push({
                id,
                kind: 'command',
                label,
                meta: String(b.keyboard_shortcut ?? b.section ?? 'Command'),
                bindingId: String(b.id ?? b.binding),
              });
            }
          }
        } catch {
          // Non-fatal
        }
      }

      if (!cancelled && commandItems.length > 0) {
        newSections.push({ label: 'Commands', items: commandItems });
      }

      if (!cancelled) {
        setSections(newSections);
        const allItems = newSections.flatMap((s) => s.items);
        setFlatItems(allItems);
        setHighlightedIndex(0);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [query, invoke]);

  // --------------------------------------------------------------------------
  // Scroll highlighted item into view
  // --------------------------------------------------------------------------

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const highlighted = list.querySelector<HTMLLIElement>(
      `[data-part="result-item"][data-highlighted="true"]`,
    );
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // --------------------------------------------------------------------------
  // Confirm — navigate or invoke command
  // --------------------------------------------------------------------------

  const confirmItem = useCallback(
    async (item: PaletteResult) => {
      if (item.kind === 'page' && item.nodeId) {
        recordRecentPage(item.nodeId, item.label);
        onNavigate?.(item.nodeId);
      } else if (item.kind === 'recent' && item.recentNodeId) {
        recordRecentPage(item.recentNodeId, item.label);
        onNavigate?.(item.recentNodeId);
      } else if (item.kind === 'command' && item.bindingId) {
        try {
          await invoke('ActionBinding', 'invoke', {
            binding: item.bindingId,
            context: JSON.stringify(commandContext),
          });
          onCommand?.(item.bindingId);
        } catch (err) {
          console.warn('[CommandPalette] Command invocation failed:', err);
        }
      }
    },
    [invoke, commandContext, onNavigate, onCommand],
  );

  // --------------------------------------------------------------------------
  // Keyboard handler
  // --------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) =>
          (i - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1),
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[highlightedIndex];
        if (item) {
          confirmItem(item);
        }
      }
      // Escape is handled by ModalStackProvider at the document level
    },
    [flatItems, highlightedIndex, confirmItem],
  );

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  const totalItems = flatItems.length;

  // Compute absolute index of the first item in each section for highlighting
  const sectionOffsets: number[] = [];
  let offset = 0;
  for (const sec of sections) {
    sectionOffsets.push(offset);
    offset += sec.items.length;
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div
      data-part="dialog"
      data-widget="command-palette"
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 'min(640px, 90vw)',
        maxHeight: '70vh',
        overflow: 'hidden',
        background: 'var(--palette-surface, #fff)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        border: '1px solid var(--palette-outline-variant, #e0e0e0)',
      }}
    >
      {/* Search input row */}
      <div
        data-part="search-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm, 8px)',
          padding: '12px 16px',
          borderBottom: '1px solid var(--palette-outline-variant, #e0e0e0)',
        }}
      >
        <span
          data-part="search-icon"
          aria-hidden="true"
          style={{ color: 'var(--palette-on-surface-variant, #666)', fontSize: '16px' }}
        >
          &#x1F50D;
        </span>
        <input
          ref={searchInputRef}
          data-part="search-input"
          role="combobox"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pages and commands"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={
            flatItems[highlightedIndex]
              ? `cpal-item-${flatItems[highlightedIndex].id}`
              : undefined
          }
          placeholder="Search pages, commands..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '16px',
            color: 'var(--palette-on-surface, #111)',
          }}
        />
        {query.length > 0 && (
          <button
            data-part="clear-button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--palette-on-surface-variant, #666)',
              fontSize: '14px',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* Result list */}
      <div
        data-part="result-list-scroll"
        style={{
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {loading && (
          <div
            data-part="loading-spinner"
            role="status"
            aria-label="Searching..."
            aria-live="polite"
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--palette-on-surface-variant, #666)',
              fontSize: '14px',
            }}
          >
            Searching...
          </div>
        )}

        {!loading && totalItems === 0 && (
          <div
            data-part="empty-state"
            role="status"
            aria-live="polite"
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--palette-on-surface-variant, #666)',
              fontSize: '14px',
            }}
          >
            {query ? `No results for "${query}"` : 'Start typing to search...'}
          </div>
        )}

        {!loading && totalItems > 0 && (
          <ol
            ref={listRef}
            id="command-palette-results"
            data-part="result-list"
            role="listbox"
            aria-label="Search results"
            style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}
          >
            {sections.map((sec, sectionIdx) => {
              const secOffset = sectionOffsets[sectionIdx] ?? 0;
              return (
                <React.Fragment key={sec.label}>
                  <li
                    data-part="section-header"
                    role="presentation"
                    aria-hidden="true"
                    style={{
                      padding: '4px 16px 2px',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--palette-on-surface-variant, #888)',
                    }}
                  >
                    {sec.label}
                  </li>
                  {sec.items.map((item, itemIdx) => {
                    const absoluteIndex = secOffset + itemIdx;
                    const isHighlighted = absoluteIndex === highlightedIndex;
                    const segments = fuzzyHighlight(item.label, query);
                    return (
                      <li
                        key={item.id}
                        id={`cpal-item-${item.id}`}
                        data-part="result-item"
                        data-highlighted={isHighlighted ? 'true' : 'false'}
                        data-kind={item.kind}
                        role="option"
                        aria-selected={isHighlighted}
                        tabIndex={-1}
                        onClick={() => confirmItem(item)}
                        onMouseEnter={() => setHighlightedIndex(absoluteIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 16px',
                          cursor: 'pointer',
                          background: isHighlighted
                            ? 'var(--palette-primary-container, #e8f4fd)'
                            : 'transparent',
                          color: isHighlighted
                            ? 'var(--palette-on-primary-container, #0d47a1)'
                            : 'var(--palette-on-surface, #111)',
                        }}
                      >
                        <span
                          data-part="item-icon"
                          aria-hidden="true"
                          style={{ fontSize: '14px', width: '20px', textAlign: 'center', flexShrink: 0 }}
                        >
                          {item.kind === 'page' ? '\u{1F4C4}' :
                           item.kind === 'command' ? '\u26A1' :
                           '\u{1F552}'}
                        </span>

                        <span
                          data-part="item-label"
                          style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {segments.map((seg, si) =>
                            seg.matched ? (
                              <mark
                                key={si}
                                data-part="highlight-mark"
                                aria-hidden="true"
                                style={{
                                  background: 'transparent',
                                  fontWeight: 700,
                                  textDecoration: 'underline',
                                  color: 'inherit',
                                }}
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={si}>{seg.text}</span>
                            ),
                          )}
                        </span>

                        {item.meta && (
                          <span
                            data-part="item-meta"
                            aria-hidden="true"
                            style={{
                              fontSize: '11px',
                              color: isHighlighted
                                ? 'var(--palette-on-primary-container, #0d47a1)'
                                : 'var(--palette-on-surface-variant, #888)',
                              flexShrink: 0,
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isHighlighted
                                ? 'rgba(0,0,0,0.08)'
                                : 'var(--palette-surface-container, #f5f5f5)',
                            }}
                          >
                            {item.meta}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </ol>
        )}
      </div>

      {/* Footer hint */}
      <div
        data-part="footer-hint"
        id="command-palette-search-hint"
        aria-hidden="true"
        style={{
          display: 'flex',
          gap: '16px',
          padding: '8px 16px',
          borderTop: '1px solid var(--palette-outline-variant, #e0e0e0)',
          fontSize: '11px',
          color: 'var(--palette-on-surface-variant, #888)',
        }}
      >
        <span><kbd>&#x2191;&#x2193;</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Confirm</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  );
};
