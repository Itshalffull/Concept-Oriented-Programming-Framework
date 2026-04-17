'use client';

/**
 * FilterPopover — popover for composing AND/OR filter conditions on a data view.
 * Per surface/widgets/filter-popover.widget.
 *
 * Opens from the Filter toolbar button. Shows condition rows with field picker,
 * operator dropdown, and value input. Supports adding/removing conditions and
 * toggling AND/OR conjunction. Changes are applied immediately (auto-apply).
 */

import React, { useCallback } from 'react';
import { FilterPill, type FilterCondition } from './FilterPill';
import { type FieldDef } from './FieldPickerDropdown';
import { Popover } from './Popover';

interface FilterPopoverProps {
  open: boolean;
  onClose: () => void;
  conditions: FilterCondition[];
  onConditionsChange: (conditions: FilterCondition[]) => void;
  availableFields?: FieldDef[];
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  padding: 'var(--spacing-md)',
  minWidth: 360,
  maxWidth: 540,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--spacing-sm)',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 18,
  lineHeight: 1,
  padding: '2px 4px',
};

const addBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'none',
  border: '1px dashed var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function generateId(): string {
  return `cond-${Math.random().toString(36).slice(2, 9)}`;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  open,
  onClose,
  conditions,
  onConditionsChange,
  availableFields = [],
  anchorRef,
}) => {
  const addCondition = useCallback(() => {
    const firstField = availableFields[0];
    const newCondition: FilterCondition = {
      id: generateId(),
      field: firstField?.key ?? '',
      fieldType: firstField?.type ?? 'text',
      operator: 'eq',
      value: '',
      conjunction: 'and',
    };
    onConditionsChange([...conditions, newCondition]);
  }, [conditions, onConditionsChange, availableFields]);

  const updateCondition = useCallback((updated: FilterCondition) => {
    onConditionsChange(conditions.map((c) => (c.id === updated.id ? updated : c)));
  }, [conditions, onConditionsChange]);

  const removeCondition = useCallback((id: string) => {
    onConditionsChange(conditions.filter((c) => c.id !== id));
  }, [conditions, onConditionsChange]);

  return (
    <Popover
      anchor={anchorRef?.current ?? null}
      open={open}
      onClose={onClose}
      placement="bottom-start"
      width={400}
    >
      <div
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Filter conditions"
        style={panelStyle}
      >
        <div style={headerStyle}>
          <span style={{
            fontSize: 'var(--typography-label-md-size)',
            fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
            color: 'var(--palette-on-surface)',
          }}>
            Filter
          </span>
          <button
            type="button"
            data-part="close-button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label="Close filter panel"
          >
            ×
          </button>
        </div>

        {/* Condition rows as filter pills */}
        <div
          data-part="condition-list"
          role="list"
          aria-label="Filter rules"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
        >
          {conditions.length === 0 && (
            <p style={{
              color: 'var(--palette-on-surface-variant)',
              fontSize: 'var(--typography-body-sm-size)',
              margin: '0 0 var(--spacing-xs)',
            }}>
              No filters active. Add a condition to filter the view.
            </p>
          )}
          {conditions.map((condition, index) => (
            <div key={condition.id} role="listitem" data-part="condition-row">
              <FilterPill
                condition={condition}
                availableFields={availableFields}
                isFirst={index === 0}
                onChange={updateCondition}
                onRemove={removeCondition}
              />
            </div>
          ))}
        </div>

        {/* Add condition button */}
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <button
            type="button"
            data-part="add-condition-button"
            onClick={addCondition}
            style={addBtnStyle}
          >
            + Add filter
          </button>
        </div>
      </div>
    </Popover>
  );
};

export default FilterPopover;
