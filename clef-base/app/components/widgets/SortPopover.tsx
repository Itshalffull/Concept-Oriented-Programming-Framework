'use client';

/**
 * SortPopover — popover for configuring sort rules on a data view.
 * Per surface/widgets/sort-popover.widget.
 *
 * Opens from the Sort toolbar button. Shows sort rows with field picker and
 * direction toggle. Supports adding/removing/reordering sort keys.
 */

import React, { useCallback } from 'react';
import { FieldPickerDropdown, type FieldDef } from './FieldPickerDropdown';
import { Popover } from './Popover';

export interface SortKey {
  field: string;
  direction: 'asc' | 'desc';
}

interface SortPopoverProps {
  open: boolean;
  onClose: () => void;
  sortKeys: SortKey[];
  onSortKeysChange: (keys: SortKey[]) => void;
  availableFields?: FieldDef[];
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  padding: 'var(--spacing-md)',
  minWidth: 300,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--spacing-sm)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  marginBottom: 'var(--spacing-xs)',
};

const directionBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${active ? 'var(--palette-primary)' : 'var(--palette-outline)'}`,
  background: active ? 'var(--palette-primary-container)' : 'transparent',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
});

const addBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'none',
  border: '1px dashed var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 'var(--spacing-xs)',
};

export const SortPopover: React.FC<SortPopoverProps> = ({
  open,
  onClose,
  sortKeys,
  onSortKeysChange,
  availableFields = [],
  anchorRef,
}) => {
  const addSortKey = useCallback(() => {
    const firstField = availableFields[0];
    if (!firstField) return;
    onSortKeysChange([...sortKeys, { field: firstField.key, direction: 'asc' }]);
  }, [sortKeys, onSortKeysChange, availableFields]);

  const updateField = useCallback((index: number, field: string) => {
    onSortKeysChange(sortKeys.map((k, i) => i === index ? { ...k, field } : k));
  }, [sortKeys, onSortKeysChange]);

  const toggleDirection = useCallback((index: number) => {
    onSortKeysChange(sortKeys.map((k, i) =>
      i === index ? { ...k, direction: k.direction === 'asc' ? 'desc' : 'asc' } : k
    ));
  }, [sortKeys, onSortKeysChange]);

  const removeKey = useCallback((index: number) => {
    onSortKeysChange(sortKeys.filter((_, i) => i !== index));
  }, [sortKeys, onSortKeysChange]);

  return (
    <Popover
      anchor={anchorRef?.current ?? null}
      open={open}
      onClose={onClose}
      placement="bottom-start"
      width={320}
    >
      <div
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Sort configuration"
        style={panelStyle}
      >
        <div style={headerStyle}>
          <span style={{
            fontSize: 'var(--typography-label-md-size)',
            fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
          }}>
            Sort
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-on-surface-variant)', fontSize: 18 }}
            aria-label="Close sort panel"
          >
            ×
          </button>
        </div>

        {sortKeys.length === 0 && (
          <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', margin: '0 0 var(--spacing-xs)' }}>
            No sort rules. Add one to order the view.
          </p>
        )}

        {sortKeys.map((key, index) => (
          <div key={index} data-part="sort-row" style={rowStyle}>
            <span style={{ fontSize: 10, color: 'var(--palette-on-surface-variant)', minWidth: 14 }}>
              {index === 0 ? '1st' : index === 1 ? '2nd' : `${index + 1}th`}
            </span>
            <div style={{ flex: 1 }}>
              <FieldPickerDropdown
                fields={availableFields}
                currentField={key.field}
                onChange={(field) => updateField(index, field)}
              />
            </div>
            <button
              type="button"
              data-part="direction-toggle"
              onClick={() => toggleDirection(index)}
              style={directionBtnStyle(true)}
              title="Toggle sort direction"
            >
              {key.direction === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
            <button
              type="button"
              onClick={() => removeKey(index)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-error)', fontSize: 16 }}
              aria-label="Remove sort rule"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          data-part="add-sort-button"
          onClick={addSortKey}
          style={addBtnStyle}
          disabled={availableFields.length === 0}
        >
          + Add sort
        </button>
      </div>
    </Popover>
  );
};

export default SortPopover;
