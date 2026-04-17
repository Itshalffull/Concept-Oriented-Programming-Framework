'use client';

/**
 * ConceptActionPicker — Two-pane picker for selecting a concept and one of its
 * actions from the live Score index.
 *
 * Widget spec: surface/concept-action-picker.widget
 * Card: CAP-01
 *
 * ## Layout
 *
 * When no value is set (or after clearing):
 *   [ search input         ]
 *   [ concept list | action list ]
 *
 * When a value is set, collapses to a resultChip:
 *   [ ContentNode / createWithSchema  ×  ]
 *
 * ## Data
 *
 * On first render the component calls ScoreApi/listConcepts. The result is
 * cached at module level — concepts are stable within a session.
 *
 * ## Search
 *
 * Falls back to a simple token-match scorer when fuse.js is not available
 * (it is not in package.json). Query tokens are matched against concept name,
 * description, and action names/descriptions.
 *
 * ## Grouping
 *
 * "Common" bucket: category in { domain, content, content-native, view,
 * classification, identity } or no category.
 * "Advanced" bucket: everything else.
 * While search is empty the Advanced bucket is collapsed by default unless
 * showAdvanced=true. While search is non-empty both groups are flattened and
 * sorted by score.
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

export interface ConceptActionVariant {
  tag: string;
  fields: Array<{ name: string; type: string }>;
  prose?: string;
}

export interface ConceptActionSpec {
  name: string;
  description?: string;
  variants: ConceptActionVariant[];
}

export interface ConceptSpec {
  name: string;
  description?: string;
  category?: string;
  actions: ConceptActionSpec[];
}

export interface ConceptActionPickerValue {
  concept: string;
  action: string;
}

export interface ConceptActionPickerProps {
  value?: ConceptActionPickerValue;
  onChange: (value: ConceptActionPickerValue & { actionSpec?: ConceptActionSpec }) => void;
  filter?: 'mutating' | 'query' | 'all';
  showAdvanced?: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Module-level concept cache
// ---------------------------------------------------------------------------

let _conceptCache: ConceptSpec[] | null = null;
let _conceptCachePromise: Promise<ConceptSpec[]> | null = null;

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

const COMMON_CATEGORIES = new Set([
  'domain',
  'content',
  'content-native',
  'view',
  'classification',
  'identity',
]);

function isCommon(c: ConceptSpec): boolean {
  return !c.category || COMMON_CATEGORIES.has(c.category);
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function isQueryAction(action: ConceptActionSpec): boolean {
  const name = action.name.toLowerCase();
  const queryPrefixes = ['get', 'list', 'query', 'search', 'resolve', 'find', 'fetch'];
  if (queryPrefixes.some((p) => name.startsWith(p))) return true;
  // No non-ok variants heuristic — only apply when the action spec actually
  // carries variant metadata. ScoreApi/listConcepts returns action names as
  // strings without variants, so treating `[]` as "all-ok" would vacuously
  // classify every action as a query and hide every mutating option in the
  // picker. Return false when variants is empty and the name prefix didn't
  // match (i.e. default to "mutating", the looser classification).
  if (!action.variants || action.variants.length === 0) return false;
  const nonOkVariants = action.variants.filter(
    (v) => v.tag !== 'ok' && v.tag !== 'error',
  );
  return nonOkVariants.length === 0 && action.variants.every((v) => v.tag === 'ok');
}

function filterActions(
  actions: ConceptActionSpec[],
  filterProp: 'mutating' | 'query' | 'all',
): ConceptActionSpec[] {
  if (filterProp === 'all') return actions;
  if (filterProp === 'query') return actions.filter(isQueryAction);
  return actions.filter((a) => !isQueryAction(a));
}

// ---------------------------------------------------------------------------
// Search scorer (simple token match — no fuse.js dependency needed)
// ---------------------------------------------------------------------------

function scoreConceptMatch(concept: ConceptSpec, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  const haystack = [
    concept.name,
    concept.description ?? '',
    concept.category ?? '',
  ]
    .join(' ')
    .toLowerCase();

  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }

  // Bonus for matching any action name / description
  const actionHaystack = concept.actions
    .map((a) => `${a.name} ${a.description ?? ''}`)
    .join(' ')
    .toLowerCase();
  for (const token of tokens) {
    if (actionHaystack.includes(token)) score += 1;
  }

  return score;
}

function scoreActionMatch(action: ConceptActionSpec, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let score = 0;
  const haystack = [action.name, action.description ?? ''].join(' ').toLowerCase();
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConceptActionPicker({
  value,
  onChange,
  filter = 'all',
  showAdvanced = false,
  placeholder,
}: ConceptActionPickerProps): React.ReactElement {
  const invoke = useKernelInvoke();

  // ---- state ----
  const [concepts, setConcepts] = useState<ConceptSpec[]>(_conceptCache ?? []);
  const [loading, setLoading] = useState<boolean>(_conceptCache === null);
  const [query, setQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<ConceptSpec | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(showAdvanced);
  // When value is set and picker is collapsed, isOpen=false hides the panes.
  // Value can arrive asynchronously (e.g. when a parent editor hydrates from a
  // ContentNode on mount), so mirror value changes into isOpen: if value
  // becomes defined externally, auto-collapse to the resultChip view.
  const [isOpen, setIsOpen] = useState<boolean>(value == null);
  useEffect(() => {
    if (value && isOpen) setIsOpen(false);
  }, [value]); // intentionally only react to value changes, not isOpen toggles

  const searchRef = useRef<HTMLInputElement>(null);

  // ---- load concepts ----
  useEffect(() => {
    if (_conceptCache !== null) {
      setConcepts(_conceptCache);
      setLoading(false);
      return;
    }
    if (_conceptCachePromise === null) {
      _conceptCachePromise = invoke('ScoreApi', 'listConcepts', {}).then(
        (result: Record<string, unknown>) => {
          if (result.variant === 'ok') {
            let rawList: Array<Record<string, unknown>> = [];
            if (typeof result.concepts === 'string') {
              const s = result.concepts.trim();
              if (s !== '') {
                try { rawList = JSON.parse(s); }
                catch { rawList = []; }
              }
            } else if (Array.isArray(result.concepts)) {
              rawList = result.concepts as Array<Record<string, unknown>>;
            }
            // ScoreApi/listConcepts returns {name, purpose, actions: string[],
            // stateFields, file}. Adapt to the ConceptSpec shape the picker
            // needs (description, category, actions as ConceptActionSpec[]).
            // Action names come back as strings; wrap each as a minimal spec
            // with no description/variants. Category derived from purpose
            // heuristics won't be reliable, so default to "domain" to land in
            // Common bucket — users see concepts instead of an empty picker.
            const adapted: ConceptSpec[] = rawList.map((c) => {
              const actionsRaw = c.actions;
              let actionList: ConceptActionSpec[] = [];
              if (Array.isArray(actionsRaw)) {
                actionList = (actionsRaw as unknown[]).map((a) => {
                  if (typeof a === 'string') {
                    return { name: a, description: undefined, variants: [] };
                  }
                  const ao = a as Record<string, unknown>;
                  return {
                    name: String(ao.name ?? ''),
                    description: typeof ao.description === 'string' ? ao.description : undefined,
                    variants: Array.isArray(ao.variants)
                      ? (ao.variants as Array<{ tag: string; fields?: Record<string, string> }>)
                      : [],
                  };
                }).filter((a) => a.name !== '');
              }
              return {
                name: String(c.name ?? c.conceptName ?? ''),
                description: typeof c.description === 'string'
                  ? c.description
                  : (typeof c.purpose === 'string' ? c.purpose : undefined),
                category: typeof c.category === 'string' ? c.category : 'domain',
                actions: actionList,
              };
            }).filter((c) => c.name !== '');
            _conceptCache = adapted;
            return adapted;
          }
          _conceptCache = [];
          return [];
        },
      );
    }
    _conceptCachePromise.then((cs) => {
      setConcepts(cs);
      setLoading(false);
    });
  }, [invoke]);

  // Pre-select concept if value is already set and picker re-opens
  useEffect(() => {
    if (value && isOpen && concepts.length > 0) {
      const found = concepts.find((c) => c.name === value.concept) ?? null;
      setSelectedConcept(found);
    }
  }, [value, isOpen, concepts]);

  // ---- search ----
  const tokens = useMemo(
    () =>
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    [query],
  );

  const filteredConcepts = useMemo(() => {
    if (tokens.length === 0) return concepts;
    return concepts
      .map((c) => ({ concept: c, score: scoreConceptMatch(c, tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.concept);
  }, [concepts, tokens]);

  const commonConcepts = useMemo(
    () => filteredConcepts.filter(isCommon),
    [filteredConcepts],
  );
  const advancedConcepts = useMemo(
    () => filteredConcepts.filter((c) => !isCommon(c)),
    [filteredConcepts],
  );

  // When searching, show flat merged list; otherwise group
  const isSearching = tokens.length > 0;
  const conceptsToShow: ConceptSpec[] = isSearching
    ? filteredConcepts
    : commonConcepts;
  const advancedToShow: ConceptSpec[] = isSearching ? [] : advancedConcepts;

  // ---- actions for selected concept ----
  const visibleActions = useMemo(() => {
    if (!selectedConcept) return [];
    const base = filterActions(selectedConcept.actions, filter);
    if (tokens.length === 0) return base;
    return base
      .map((a) => ({ action: a, score: scoreActionMatch(a, tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.action);
  }, [selectedConcept, filter, tokens]);

  // ---- handlers ----
  const handleConceptSelect = useCallback((concept: ConceptSpec) => {
    setSelectedConcept(concept);
  }, []);

  const handleActionSelect = useCallback(
    (action: ConceptActionSpec) => {
      if (!selectedConcept) return;
      onChange({
        concept: selectedConcept.name,
        action: action.name,
        actionSpec: action,
      });
      setIsOpen(false);
    },
    [onChange, selectedConcept],
  );

  const handleClear = useCallback(() => {
    setSelectedConcept(null);
    setQuery('');
    setIsOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const handleReopen = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  // ---- keyboard navigation (basic) ----
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setQuery('');
      }
    },
    [],
  );

  // ---- collapsed state (resultChip) ----
  if (!isOpen && value) {
    return (
      <div
        data-widget="concept-action-picker"
        data-part="root"
        data-state="action-selected"
        role="region"
        aria-label="Concept action picker"
        className="cap-root cap-collapsed"
      >
        <div data-part="resultChip" className="cap-result-chip">
          <span className="cap-result-label">
            {value.concept} / {value.action}
          </span>
          <button
            data-part="clearButton"
            aria-label="Clear selection"
            className="cap-clear-btn"
            onClick={handleClear}
            type="button"
          >
            &times;
          </button>
          <button
            className="cap-reopen-btn"
            aria-label="Change selection"
            onClick={handleReopen}
            type="button"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  // ---- two-pane open state ----
  const pickerState = selectedConcept
    ? 'concept-selected'
    : query
    ? 'searching'
    : 'idle';

  return (
    <div
      data-widget="concept-action-picker"
      data-part="root"
      data-state={pickerState}
      role="region"
      aria-label="Concept action picker"
      className="cap-root cap-open"
    >
      {/* Search */}
      <input
        ref={searchRef}
        data-part="search"
        role="searchbox"
        aria-label="Search concepts and actions"
        className="cap-search"
        type="text"
        value={query}
        autoFocus
        placeholder={placeholder ?? 'Search concepts and actions…'}
        onChange={handleSearchChange}
        onKeyDown={handleSearchKeyDown}
      />

      {/* Two-pane layout */}
      <div className="cap-panes">
        {/* Left pane: concept list */}
        <div
          data-part="conceptList"
          role="listbox"
          aria-label="Concepts"
          aria-live="polite"
          className="cap-concept-list"
        >
          {loading && (
            <div className="cap-loading" aria-live="polite">
              Loading concepts…
            </div>
          )}

          {/* Common group */}
          {conceptsToShow.length > 0 && (
            <>
              {!isSearching && (
                <div className="cap-group-label">Common</div>
              )}
              {conceptsToShow.map((c) => (
                <ConceptRow
                  key={c.name}
                  concept={c}
                  selected={selectedConcept?.name === c.name}
                  onSelect={handleConceptSelect}
                />
              ))}
            </>
          )}

          {/* Advanced group */}
          {!isSearching && advancedToShow.length > 0 && (
            <>
              <button
                data-part="advancedToggle"
                role="button"
                aria-expanded={advancedOpen ? 'true' : 'false'}
                className="cap-advanced-toggle"
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                {advancedOpen ? '▾' : '▸'} Advanced ({advancedToShow.length})
              </button>
              {advancedOpen &&
                advancedToShow.map((c) => (
                  <ConceptRow
                    key={c.name}
                    concept={c}
                    selected={selectedConcept?.name === c.name}
                    onSelect={handleConceptSelect}
                  />
                ))}
            </>
          )}

          {!loading && filteredConcepts.length === 0 && (
            <div className="cap-empty">No concepts match</div>
          )}
        </div>

        {/* Right pane: action list — visible when a concept is selected */}
        <div
          data-part="actionList"
          role="listbox"
          aria-label="Actions"
          hidden={selectedConcept === null}
          className={`cap-action-list${selectedConcept ? ' cap-action-list--visible' : ''}`}
        >
          {selectedConcept && visibleActions.length === 0 && (
            <div className="cap-empty">No actions match</div>
          )}
          {visibleActions.map((a) => (
            <ActionRow
              key={a.name}
              action={a}
              onSelect={handleActionSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ConceptRowProps {
  concept: ConceptSpec;
  selected: boolean;
  onSelect: (c: ConceptSpec) => void;
}

function ConceptRow({ concept, selected, onSelect }: ConceptRowProps) {
  return (
    <div
      data-part="conceptItem"
      role="option"
      aria-selected={selected}
      className={`cap-concept-item${selected ? ' cap-concept-item--selected' : ''}`}
      onClick={() => onSelect(concept)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(concept);
      }}
      tabIndex={0}
    >
      <span className="cap-concept-name">{concept.name}</span>
      {concept.category && concept.category !== 'domain' && (
        <span data-part="categoryBadge" className="cap-category-badge">
          {concept.category}
        </span>
      )}
      {concept.description && (
        <span data-part="descSnippet" className="cap-desc-snippet">
          {concept.description}
        </span>
      )}
    </div>
  );
}

interface ActionRowProps {
  action: ConceptActionSpec;
  onSelect: (a: ConceptActionSpec) => void;
}

function ActionRow({ action, onSelect }: ActionRowProps) {
  return (
    <div
      data-part="actionItem"
      role="option"
      className="cap-action-item"
      onClick={() => onSelect(action)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(action);
      }}
      tabIndex={0}
    >
      <span className="cap-action-name">{action.name}</span>
      {action.description && (
        <span data-part="descSnippet" className="cap-desc-snippet">
          {action.description}
        </span>
      )}
      {action.variants.length > 0 && (
        <div data-part="variantChips" className="cap-variant-chips">
          {action.variants.map((v) => (
            <span key={v.tag} className={`cap-variant-chip cap-variant-chip--${v.tag}`}>
              {v.tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
