'use client';

/**
 * FieldsPopover — popover for controlling field visibility and order on a data view.
 * Per surface/widgets/fields-popover.widget.
 *
 * Shows a searchable list of fields with checkboxes for visibility and up/down
 * buttons for reordering. Show all / hide all buttons for bulk control.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

export interface FieldVisibilityConfig {
  key: string;
  label?: string;
  visible: boolean;
}

interface FieldsPopoverProps {
  open: boolean;
  onClose: () => void;
  fields: FieldVisibilityConfig[];
  onFieldsChange: (fields: FieldVisibilityConfig[]) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  padding: 'var(--spacing-md)',
  minWidth: 240,
  maxWidth: 320,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999,
};

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  marginBottom: 'var(--spacing-xs)',
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  padding: '3px 0',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 11,
  padding: '0 2px',
  fontFamily: 'inherit',
};

export const FieldsPopover: React.FC<FieldsPopoverProps> = ({
  open,
  onClose,
  fields,
  onFieldsChange,
  anchorRef,
}) => {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const getPosition = (): React.CSSProperties => {
    if (!anchorRef?.current) return { top: 80, left: 300 };
    const rect = anchorRef.current.getBoundingClientRect();
    return { top: rect.bottom + 8, left: rect.left };
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = fields.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.key.toLowerCase().includes(q) || (f.label ?? '').toLowerCase().includes(q);
  });

  const toggleField = useCallback((key: string) => {
    onFieldsChange(fields.map((f) => f.key === key ? { ...f, visible: !f.visible } : f));
  }, [fields, onFieldsChange]);

  const showAll = useCallback(() => {
    onFieldsChange(fields.map((f) => ({ ...f, visible: true })));
  }, [fields, onFieldsChange]);

  const hideAll = useCallback(() => {
    onFieldsChange(fields.map((f) => ({ ...f, visible: false })));
  }, [fields, onFieldsChange]);

  const moveField = useCallback((key: string, direction: -1 | 1) => {
    const index = fields.findIndex((f) => f.key === key);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onFieldsChange(next);
  }, [fields, onFieldsChange]);

  if (!open) return null;

  const panelPos = getPosition();

  return (
    <>
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Field visibility"
        style={{ ...panelStyle, ...panelPos }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
          <span style={{ fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'] }}>
            Fields
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-on-surface-variant)', fontSize: 18 }}
          >
            ×
          </button>
        </div>

        {/* Bulk actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
          <button type="button" onClick={showAll} style={{
            fontSize: 'var(--typography-body-sm-size)', padding: '3px 8px',
            border: '1px solid var(--palette-outline)', borderRadius: 'var(--radius-sm)',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--palette-on-surface)',
          }}>
            Show all
          </button>
          <button type="button" onClick={hideAll} style={{
            fontSize: 'var(--typography-body-sm-size)', padding: '3px 8px',
            border: '1px solid var(--palette-outline)', borderRadius: 'var(--radius-sm)',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--palette-on-surface)',
          }}>
            Hide all
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          data-part="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fields…"
          style={searchStyle}
        />

        {/* Field list */}
        <div
          data-part="field-list"
          style={{ maxHeight: 220, overflowY: 'auto' }}
        >
          {filtered.map((field) => {
            const index = fields.findIndex((f) => f.key === field.key);
            return (
              <div key={field.key} data-part="field-row" style={fieldRowStyle}>
                <input
                  type="checkbox"
                  id={`field-vis-${field.key}`}
                  checked={field.visible}
                  onChange={() => toggleField(field.key)}
                  style={{ cursor: 'pointer' }}
                />
                <label
                  htmlFor={`field-vis-${field.key}`}
                  style={{
                    flex: 1,
                    fontSize: 'var(--typography-body-sm-size)',
                    cursor: 'pointer',
                    color: field.visible ? 'var(--palette-on-surface)' : 'var(--palette-on-surface-variant)',
                  }}
                >
                  {field.label ?? field.key}
                </label>
                <button
                  type="button"
                  onClick={() => moveField(field.key, -1)}
                  disabled={index === 0}
                  style={{ ...smallBtnStyle, opacity: index === 0 ? 0.3 : 1 }}
                  aria-label="Move field up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveField(field.key, 1)}
                  disabled={index === fields.length - 1}
                  style={{ ...smallBtnStyle, opacity: index === fields.length - 1 ? 0.3 : 1 }}
                  aria-label="Move field down"
                >
                  ▼
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', margin: 0 }}>
              No matching fields
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default FieldsPopover;
