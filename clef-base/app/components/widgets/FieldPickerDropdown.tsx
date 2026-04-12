'use client';

/**
 * FieldPickerDropdown — searchable dropdown listing available fields.
 * Per surface/widgets/field-picker-dropdown.widget.
 *
 * Renders a token-driven menu that lists available fields. When fields are
 * grouped by type (groupBy="type"), each type group becomes a labeled section.
 * Supports free-text search to narrow the field list.
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
    <div ref={containerRef} data-surface="floating-anchor" data-part="root" style={{ minWidth: 120 }}>
      <button
        type="button"
        data-surface="floating-trigger"
        data-layout="block"
        data-part="trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{displayLabel}</span>
        <span data-part="trigger-caret">▾</span>
      </button>

      {open && (
        <div data-surface="floating-menu" data-part="dropdown" role="listbox" aria-label="Available fields" style={{ minWidth: '100%' }}>
          <input
            ref={searchRef}
            type="text"
            data-part="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields…"
          />
          {grouped.map(({ type, items }) => (
            <div key={type || '_all'}>
              {type && (
                <div data-part="menu-label">{type}</div>
              )}
              {items.map((f) => (
                <div
                  key={f.key}
                  data-part="menu-item"
                  data-selected={f.key === currentField ? 'true' : 'false'}
                  role="option"
                  aria-selected={f.key === currentField}
                  onClick={() => handleSelect(f)}
                >
                  {f.label ?? f.key}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div data-part="empty">
              No fields found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldPickerDropdown;
