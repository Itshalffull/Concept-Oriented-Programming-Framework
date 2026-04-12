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
      <div data-surface="floating-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        data-surface="floating-panel"
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Field visibility"
        aria-modal="true"
        style={{ ...panelPos, minWidth: 240, maxWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-part="header">
          <span data-part="title">
            Fields
          </span>
          <button
            type="button"
            onClick={onClose}
            data-surface="floating-icon-button"
            data-part="close-button"
            data-variant="quiet"
            aria-label="Close fields panel"
          >
            ×
          </button>
        </div>

        <div data-part="actions">
          <button type="button" onClick={showAll} data-surface="floating-action-button" data-variant="quiet">
            Show all
          </button>
          <button type="button" onClick={hideAll} data-surface="floating-action-button" data-variant="quiet">
            Hide all
          </button>
        </div>

        <input
          type="text"
          data-part="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fields…"
        />

        <div data-part="list">
          {filtered.map((field) => {
            const index = fields.findIndex((f) => f.key === field.key);
            return (
              <div key={field.key} data-part="row">
                <input
                  type="checkbox"
                  id={`field-vis-${field.key}`}
                  checked={field.visible}
                  onChange={() => toggleField(field.key)}
                />
                <label
                  htmlFor={`field-vis-${field.key}`}
                  data-part="row-label"
                  data-active={field.visible ? 'true' : 'false'}
                >
                  {field.label ?? field.key}
                </label>
                <button
                  type="button"
                  onClick={() => moveField(field.key, -1)}
                  disabled={index === 0}
                  data-surface="floating-icon-button"
                  data-part="row-action"
                  aria-label="Move field up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveField(field.key, 1)}
                  disabled={index === fields.length - 1}
                  data-surface="floating-icon-button"
                  data-part="row-action"
                  aria-label="Move field down"
                >
                  ▼
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p data-part="empty">
              No matching fields
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default FieldsPopover;
