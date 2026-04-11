'use client';

/**
 * FieldPickerDropdown — searchable dropdown listing available fields.
 * Per surface/widgets/field-picker-dropdown.widget.
 *
 * Renders a select element that lists available fields. When fields are grouped
 * by type (groupBy="type"), each type group becomes an <optgroup>. Supports
 * free-text search to narrow the field list.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface FieldDef {
  key: string;
  label?: string;
  type?: 'text' | 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multi-select';
}

interface FieldPickerDropdownProps {
  fields: FieldDef[];
  currentField: string;
  onChange: (field: string, fieldType?: FieldDef['type']) => void;
  groupBy?: 'type' | 'none';
  placeholder?: string;
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 120,
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 4,
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  left: 0,
  minWidth: '100%',
  maxHeight: 200,
  overflowY: 'auto',
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  zIndex: 1000,
};

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderBottom: '1px solid var(--palette-outline-variant)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const optionStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  background: active ? 'var(--palette-primary-container)' : 'transparent',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
});

const groupLabelStyle: React.CSSProperties = {
  padding: '4px 8px 2px',
  fontSize: 'var(--typography-label-sm-size)',
  color: 'var(--palette-on-surface-variant)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const FieldPickerDropdown: React.FC<FieldPickerDropdownProps> = ({
  fields,
  currentField,
  onChange,
  groupBy = 'none',
  placeholder = 'Select field…',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedField = fields.find((f) => f.key === currentField);
  const displayLabel = selectedField?.label ?? selectedField?.key ?? currentField ?? placeholder;

  const filtered = fields.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (f.key.toLowerCase().includes(q) || (f.label ?? '').toLowerCase().includes(q));
  });

  // Group by type when requested
  const grouped: Array<{ type: string; items: FieldDef[] }> = [];
  if (groupBy === 'type') {
    const typeMap = new Map<string, FieldDef[]>();
    for (const f of filtered) {
      const t = f.type ?? 'text';
      if (!typeMap.has(t)) typeMap.set(t, []);
      typeMap.get(t)!.push(f);
    }
    for (const [type, items] of typeMap) {
      grouped.push({ type, items });
    }
  } else {
    grouped.push({ type: '', items: filtered });
  }

  const handleSelect = useCallback((f: FieldDef) => {
    onChange(f.key, f.type);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={containerRef} data-part="root" style={containerStyle}>
      <button
        type="button"
        data-part="trigger"
        onClick={() => setOpen((v) => !v)}
        style={buttonStyle}
      >
        <span>{displayLabel}</span>
        <span style={{ fontSize: 10, color: 'var(--palette-on-surface-variant)' }}>▾</span>
      </button>

      {open && (
        <div data-part="dropdown" style={dropdownStyle}>
          <input
            ref={searchRef}
            type="text"
            data-part="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
            style={searchStyle}
          />
          {grouped.map(({ type, items }) => (
            <div key={type || '_all'}>
              {type && (
                <div data-part="group-label" style={groupLabelStyle}>{type}</div>
              )}
              {items.map((f) => (
                <div
                  key={f.key}
                  data-part="option"
                  data-selected={f.key === currentField ? 'true' : 'false'}
                  onClick={() => handleSelect(f)}
                  style={optionStyle(f.key === currentField)}
                >
                  {f.label ?? f.key}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
              No fields found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldPickerDropdown;
