'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { FIELD_TYPE_REGISTRY } from './FieldWidget';

// ---------------------------------------------------------------------------
// Extended type metadata (descriptions + widget-spec groups)
// ---------------------------------------------------------------------------

interface FieldTypeEntry {
  value: string;
  label: string;
  icon: string;
  description: string;
  group: GroupId;
}

type GroupId = 'text' | 'number' | 'datetime' | 'choice' | 'reference' | 'special';

interface GroupConfig {
  id: GroupId;
  label: string;
}

const GROUPS: GroupConfig[] = [
  { id: 'text',      label: 'Text'       },
  { id: 'number',    label: 'Number'     },
  { id: 'datetime',  label: 'Date / Time'},
  { id: 'choice',    label: 'Choice'     },
  { id: 'reference', label: 'Reference'  },
  { id: 'special',   label: 'Special'    },
];

// Descriptions for each type, keyed by type value
const TYPE_DESCRIPTIONS: Record<string, string> = {
  text:           'Short single-line text',
  textarea:       'Long multi-line plain text',
  'rich-text':    'Formatted text with bold, lists, and more',
  url:            'Web address with validation',
  email:          'Email address with validation',
  number:         'Any numeric value',
  currency:       'Monetary amount with symbol',
  percentage:     'Numeric value as a percentage',
  rating:         'Star or score rating',
  date:           'Calendar date without time',
  datetime:       'Date with time and timezone',
  duration:       'Length of time (e.g. 2h 30m)',
  boolean:        'True / false toggle',
  select:         'Single choice from a list of options',
  'multi-select': 'Multiple choices from a list of options',
  relation:       'Link to another content node',
  person:         'Reference to a user or person',
  file:           'Attached file or document',
  media:          'Image, video, or audio file',
  json:           'Raw structured JSON data',
  formula:        'Computed value from an expression',
  computed:       'Read-only value derived from other fields',
};

// Map FieldWidget groups to widget-spec groups (date → datetime, number stays)
// and add extra types from the spec that may not be in FIELD_TYPE_REGISTRY
const GROUP_MAP: Record<string, GroupId> = {
  text:      'text',
  number:    'number',
  date:      'datetime',
  choice:    'choice',
  reference: 'reference',
  special:   'special',
};

// Build the full entry list from FIELD_TYPE_REGISTRY, merging descriptions
function buildTypeEntries(): FieldTypeEntry[] {
  const entries: FieldTypeEntry[] = Object.entries(FIELD_TYPE_REGISTRY).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
    icon: cfg.icon,
    description: TYPE_DESCRIPTIONS[key] ?? '',
    group: (GROUP_MAP[cfg.group] ?? 'special') as GroupId,
  }));

  // Add extra types from the widget spec that don't exist in FIELD_TYPE_REGISTRY
  const extra: FieldTypeEntry[] = [
    { value: 'duration',  label: 'Duration',  icon: '⏱', description: TYPE_DESCRIPTIONS.duration  ?? '', group: 'datetime' },
    { value: 'formula',   label: 'Formula',   icon: 'f()', description: TYPE_DESCRIPTIONS.formula  ?? '', group: 'special'  },
    { value: 'computed',  label: 'Computed',  icon: '⟳',  description: TYPE_DESCRIPTIONS.computed ?? '', group: 'special'  },
  ];
  const existing = new Set(entries.map((e) => e.value));
  for (const e of extra) {
    if (!existing.has(e.value)) entries.push(e);
  }

  return entries;
}

const ALL_ENTRIES = buildTypeEntries();

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldTypePickerProps {
  onSelect: (type: string) => void;
  selectedType?: string;
  recentTypes?: string[];
}

// ---------------------------------------------------------------------------
// Styles (CSS custom properties — no new deps)
// ---------------------------------------------------------------------------

const pickerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--elevation-md, 0 4px 16px rgba(0,0,0,0.15))',
  width: '360px',
  maxHeight: '480px',
  overflow: 'hidden',
};

const searchWrapStyle: React.CSSProperties = {
  padding: '8px',
  borderBottom: '1px solid var(--palette-outline)',
  position: 'relative',
  flexShrink: 0,
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 28px 6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size, 0.875rem)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};

const clearBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: '0.8rem',
  padding: '2px 4px',
  lineHeight: 1,
};

const scrollAreaStyle: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '4px 0',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-sm-size, 0.7rem)',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--palette-on-surface-variant)',
  padding: '8px 12px 4px',
  userSelect: 'none',
};

const typeOptionBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 12px',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size, 0.875rem)',
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
  margin: '0 4px',
  boxSizing: 'border-box',
  position: 'relative',
};

const iconStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface-variant)',
  fontSize: '0.85rem',
  flexShrink: 0,
};

const labelTextStyle: React.CSSProperties = {
  fontWeight: 500,
  lineHeight: 1.2,
};

const descTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--palette-on-surface-variant)',
  lineHeight: 1.2,
};

const checkmarkStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  color: 'var(--palette-primary)',
  fontSize: '0.8rem',
};

// ---------------------------------------------------------------------------
// TypeOption — individual selectable card
// ---------------------------------------------------------------------------

interface TypeOptionProps {
  entry: FieldTypeEntry;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (v: string) => void;
  onFocus: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent, value: string) => void;
  btnRef?: (el: HTMLButtonElement | null) => void;
  prefix?: string;
}

const TypeOption: React.FC<TypeOptionProps> = ({
  entry, isSelected, isFocused, onSelect, onFocus, onKeyDown, btnRef, prefix,
}) => {
  const id = `${prefix ?? 'ft'}-${entry.value}`;
  return (
    <button
      id={id}
      ref={btnRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${entry.label}: ${entry.description}`}
      tabIndex={isFocused ? 0 : -1}
      data-part="type-option"
      data-value={entry.value}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={() => onSelect(entry.value)}
      onFocus={() => onFocus(entry.value)}
      onKeyDown={onKeyDown ? (e) => onKeyDown(e, entry.value) : undefined}
      style={{
        ...typeOptionBase,
        background: isFocused
          ? 'var(--palette-surface-variant)'
          : isSelected
            ? 'color-mix(in oklch, var(--palette-primary) 10%, transparent)'
            : 'none',
        width: 'calc(100% - 8px)',
      }}
    >
      <span data-part="type-icon" data-icon={entry.icon} style={iconStyle}>
        {entry.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span data-part="type-label" style={labelTextStyle}>{entry.label}</span>
        <br />
        <span data-part="type-description" style={descTextStyle}>{entry.description}</span>
      </span>
      {isSelected && (
        <span data-part="selected-indicator" style={checkmarkStyle} aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------
// FieldTypePicker — main component
// ---------------------------------------------------------------------------

export const FieldTypePicker: React.FC<FieldTypePickerProps> = ({
  onSelect,
  selectedType,
  recentTypes = [],
}) => {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [focusedValue, setFocusedValue] = useState<string | null>(selectedType ?? null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Determine visible state (closed / open / searching / selected)
  const isSearching = query.trim().length > 0;
  const dataState = isSearching ? 'searching' : selectedType ? 'selected' : 'open';

  // Focus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Filter entries by query
  const filteredEntries = useMemo((): FieldTypeEntry[] => {
    if (!isSearching) return ALL_ENTRIES;
    const q = query.toLowerCase();
    return ALL_ENTRIES.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.value.toLowerCase().includes(q),
    );
  }, [query, isSearching]);

  // Group filtered entries
  const entriesByGroup = useMemo((): Map<GroupId, FieldTypeEntry[]> => {
    const map = new Map<GroupId, FieldTypeEntry[]>();
    for (const g of GROUPS) map.set(g.id, []);
    for (const e of filteredEntries) {
      map.get(e.group)?.push(e);
    }
    return map;
  }, [filteredEntries]);

  // Recent type entries (resolved from registry)
  const recentEntries = useMemo((): FieldTypeEntry[] => {
    if (isSearching) return [];
    return recentTypes
      .map((v) => ALL_ENTRIES.find((e) => e.value === v))
      .filter((e): e is FieldTypeEntry => e != null);
  }, [recentTypes, isSearching]);

  // All focusable values in order (recent → groups)
  const focusableValues = useMemo((): string[] => {
    const vals: string[] = [];
    if (!isSearching) {
      for (const e of recentEntries) vals.push(e.value);
    }
    for (const g of GROUPS) {
      const items = entriesByGroup.get(g.id) ?? [];
      for (const e of items) vals.push(e.value);
    }
    return vals;
  }, [recentEntries, entriesByGroup, isSearching]);

  const handleSelect = useCallback((type: string) => {
    onSelect(type);
  }, [onSelect]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = focusableValues[0];
      if (first) {
        setFocusedValue(first);
        btnRefs.current.get(first)?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
    }
  }, [focusableValues]);

  const handleOptionKeyDown = useCallback((e: React.KeyboardEvent, value: string) => {
    const idx = focusableValues.indexOf(value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = focusableValues[idx + 1];
      if (next) { setFocusedValue(next); btnRefs.current.get(next)?.focus(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx === 0) {
        searchRef.current?.focus();
        setFocusedValue(null);
      } else {
        const prev = focusableValues[idx - 1];
        if (prev) { setFocusedValue(prev); btnRefs.current.get(prev)?.focus(); }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      searchRef.current?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }, [focusableValues]);

  return (
    <div
      data-part="root"
      data-state={dataState}
      data-selected-type={selectedType ?? ''}
      role="listbox"
      aria-label="Select field type"
      aria-multiselectable="false"
      style={pickerStyle}
    >
      {/* Search input */}
      <div style={searchWrapStyle} data-part="search-wrap">
        <input
          ref={searchRef}
          data-part="search-input"
          type="search"
          role="searchbox"
          aria-label="Search field types"
          placeholder="Search field types..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          style={searchInputStyle}
          autoComplete="off"
          spellCheck={false}
        />
        {isSearching && (
          <button
            data-part="search-clear"
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); searchRef.current?.focus(); }}
            style={clearBtnStyle}
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div style={scrollAreaStyle} data-part="type-grid" role="presentation" aria-label="Field type groups">

        {/* Recent section — hidden while searching */}
        {!isSearching && recentEntries.length > 0 && (
          <div
            data-part="recent-section"
            role="group"
            aria-label="Recently used field types"
          >
            <div data-part="recent-label" style={sectionLabelStyle}>
              Recently used
            </div>
            {recentEntries.map((entry) => (
              <TypeOption
                key={`recent-${entry.value}`}
                entry={entry}
                isSelected={entry.value === selectedType}
                isFocused={focusedValue === entry.value}
                onSelect={handleSelect}
                onFocus={setFocusedValue}
                onKeyDown={handleOptionKeyDown}
                btnRef={(el) => {
                  if (el) btnRefs.current.set(entry.value, el);
                }}
                prefix={`${uid}-recent`}
              />
            ))}
            <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--palette-outline)' }} />
          </div>
        )}

        {/* Groups */}
        {GROUPS.map((group) => {
          const items = entriesByGroup.get(group.id) ?? [];
          const hidden = items.length === 0;
          return (
            <div
              key={group.id}
              data-part="type-group"
              data-group-id={group.id}
              role="group"
              aria-labelledby={`${uid}-group-${group.id}`}
              hidden={hidden}
              style={hidden ? { display: 'none' } : undefined}
            >
              <div
                id={`${uid}-group-${group.id}`}
                data-part="type-group-label"
                role="presentation"
                aria-hidden="true"
                style={sectionLabelStyle}
              >
                {group.label}
              </div>
              {items.map((entry) => (
                <TypeOption
                  key={entry.value}
                  entry={entry}
                  isSelected={entry.value === selectedType}
                  isFocused={focusedValue === entry.value}
                  onSelect={handleSelect}
                  onFocus={setFocusedValue}
                  onKeyDown={handleOptionKeyDown}
                  btnRef={(el) => {
                    if (el) btnRefs.current.set(entry.value, el);
                  }}
                  prefix={`${uid}-opt`}
                />
              ))}
            </div>
          );
        })}

        {/* Empty state when search matches nothing */}
        {isSearching && filteredEntries.length === 0 && (
          <div style={{ padding: '16px 12px', color: 'var(--palette-on-surface-variant)', fontSize: '0.875rem' }}>
            No field types match &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldTypePicker;
