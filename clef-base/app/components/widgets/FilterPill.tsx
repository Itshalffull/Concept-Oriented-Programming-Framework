'use client';

/**
 * FilterPill — compact inline chip showing a single active filter condition.
 * Per surface/widgets/filter-pill.widget.
 *
 * Displays three clickable segments: field, operator, value.
 * Click field → open field picker dropdown anchored to pill.
 * Click operator → open operator dropdown.
 * Click value → open typed value input.
 * × button removes the filter entirely.
 */

import React, { useState, useCallback, useRef } from 'react';
import { FieldPickerDropdown, type FieldDef } from './FieldPickerDropdown';
import { OperatorDropdown, type FieldType, getOperatorsForType, isUnaryOperator } from './OperatorDropdown';
import { TypedValueInput } from './TypedValueInput';

export interface FilterCondition {
  id: string;
  field: string;
  fieldType: FieldType;
  operator: string;
  value: string;
  conjunction: 'and' | 'or';
}

interface FilterPillProps {
  condition: FilterCondition;
  availableFields?: FieldDef[];
  isFirst?: boolean;
  onChange: (updated: FilterCondition) => void;
  onRemove: (id: string) => void;
}

type EditingSegment = 'field' | 'operator' | 'value' | null;

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
  overflow: 'visible',
  position: 'relative',
};

const segmentStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 6px',
  cursor: 'pointer',
  background: active ? 'var(--palette-primary-container)' : 'transparent',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  borderRadius: 0,
  whiteSpace: 'nowrap',
});

const operatorSegStyle: React.CSSProperties = {
  padding: '3px 4px',
  color: 'var(--palette-on-surface-variant)',
  fontStyle: 'italic',
  fontSize: '11px',
  borderLeft: '1px solid var(--palette-outline-variant)',
  borderRight: '1px solid var(--palette-outline-variant)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  fontFamily: 'inherit',
};

const removeStyle: React.CSSProperties = {
  padding: '2px 6px',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  background: 'transparent',
  border: 'none',
  borderLeft: '1px solid var(--palette-outline-variant)',
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1,
};

const conjunctionStyle: React.CSSProperties = {
  padding: '2px 6px',
  marginRight: '4px',
  fontSize: '11px',
  color: 'var(--palette-on-surface-variant)',
  background: 'var(--palette-surface-variant)',
  border: '1px solid var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  zIndex: 1100,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-sm)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '8px',
  minWidth: 160,
};

export const FilterPill: React.FC<FilterPillProps> = ({
  condition,
  availableFields = [],
  isFirst = false,
  onChange,
  onRemove,
}) => {
  const [editing, setEditing] = useState<EditingSegment>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const operatorLabel = (() => {
    const ops = getOperatorsForType(condition.fieldType);
    return ops.find((o) => o.value === condition.operator)?.label ?? condition.operator;
  })();

  const isUnary = isUnaryOperator(condition.operator, condition.fieldType);

  const handleFieldChange = useCallback((field: string, fieldType?: FieldType) => {
    onChange({ ...condition, field, fieldType: fieldType ?? 'text' });
    setEditing(null);
  }, [condition, onChange]);

  const handleOperatorChange = useCallback((operator: string) => {
    onChange({ ...condition, operator });
    setEditing(null);
  }, [condition, onChange]);

  const handleValueChange = useCallback((value: string) => {
    onChange({ ...condition, value });
  }, [condition, onChange]);

  const handleConjunctionToggle = useCallback(() => {
    onChange({ ...condition, conjunction: condition.conjunction === 'and' ? 'or' : 'and' });
  }, [condition, onChange]);

  const closeEditing = useCallback(() => setEditing(null), []);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {/* Conjunction toggle (not shown for first condition) */}
      {!isFirst && (
        <button
          type="button"
          data-part="conjunction-toggle"
          data-conjunction={condition.conjunction}
          onClick={handleConjunctionToggle}
          style={conjunctionStyle}
          title="Toggle AND/OR"
        >
          {condition.conjunction}
        </button>
      )}

      {/* The pill itself */}
      <div ref={pillRef} data-part="root" data-state={editing ? 'editing' : 'idle'} style={pillStyle}>
        {/* Field segment */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-part="field-segment"
            onClick={() => setEditing(editing === 'field' ? null : 'field')}
            style={segmentStyle(editing === 'field')}
          >
            {(availableFields.find((f) => f.key === condition.field)?.label ?? condition.field) || 'Field'}
          </button>
          {editing === 'field' && (
            <div style={{ ...popoverStyle, minWidth: 200 }}>
              <FieldPickerDropdown
                fields={availableFields}
                currentField={condition.field}
                onChange={handleFieldChange}
                groupBy="type"
              />
            </div>
          )}
        </div>

        {/* Operator segment */}
        <div style={{ position: 'relative', borderLeft: '1px solid var(--palette-outline-variant)', borderRight: '1px solid var(--palette-outline-variant)' }}>
          <button
            type="button"
            data-part="operator-segment"
            onClick={() => setEditing(editing === 'operator' ? null : 'operator')}
            style={operatorSegStyle}
          >
            {operatorLabel}
          </button>
          {editing === 'operator' && (
            <div style={popoverStyle}>
              <OperatorDropdown
                fieldType={condition.fieldType}
                currentOperator={condition.operator}
                onChange={handleOperatorChange}
              />
            </div>
          )}
        </div>

        {/* Value segment (hidden for unary operators) */}
        {!isUnary && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-part="value-segment"
              onClick={() => setEditing(editing === 'value' ? null : 'value')}
              style={segmentStyle(editing === 'value')}
            >
              {condition.value || 'Value'}
            </button>
            {editing === 'value' && (
              <div style={{ ...popoverStyle, minWidth: 200 }}>
                <TypedValueInput
                  fieldType={condition.fieldType}
                  value={condition.value}
                  onChange={handleValueChange}
                  operatorIsUnary={isUnary}
                />
                <button
                  type="button"
                  onClick={closeEditing}
                  style={{
                    marginTop: 6, width: '100%', padding: '4px',
                    background: 'var(--palette-primary)', color: 'var(--palette-on-primary)',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: 'var(--typography-body-sm-size)',
                    fontFamily: 'inherit',
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          data-part="remove-button"
          onClick={() => onRemove(condition.id)}
          style={removeStyle}
          title="Remove filter"
          aria-label="Remove filter"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default FilterPill;
