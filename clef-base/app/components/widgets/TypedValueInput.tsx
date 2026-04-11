'use client';

/**
 * TypedValueInput — morphing input based on field type.
 * Per surface/widgets/typed-value-input.widget.
 *
 * Renders the appropriate input control based on fieldType:
 *   text/string  → text input
 *   number       → number stepper
 *   date         → date input
 *   boolean      → toggle checkbox
 *   select       → single-value dropdown
 *   multi-select → comma-separated chip picker (simple implementation)
 *
 * For unary operators (isEmpty, isNotEmpty) the input is hidden.
 */

import React, { useCallback } from 'react';

interface TypedValueInputProps {
  fieldType: 'text' | 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multi-select';
  value: string;
  onChange: (value: string) => void;
  operatorIsUnary?: boolean;
  options?: string[];
  placeholder?: string;
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

export const TypedValueInput: React.FC<TypedValueInputProps> = ({
  fieldType,
  value,
  onChange,
  operatorIsUnary = false,
  options = [],
  placeholder = 'Value',
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Unary operators (isEmpty, isNotEmpty) need no value input
  if (operatorIsUnary) {
    return null;
  }

  if (fieldType === 'boolean') {
    return (
      <label
        data-part="root"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
      >
        <input
          type="checkbox"
          data-part="toggle"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        />
        <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface)' }}>
          {value === 'true' ? 'True' : 'False'}
        </span>
      </label>
    );
  }

  if (fieldType === 'select' && options.length > 0) {
    return (
      <select
        data-part="root"
        value={value}
        onChange={handleChange}
        style={inputStyle}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (fieldType === 'multi-select' && options.length > 0) {
    const selectedValues = value ? value.split(',').map((v) => v.trim()) : [];
    const toggleOption = (opt: string) => {
      const next = selectedValues.includes(opt)
        ? selectedValues.filter((v) => v !== opt)
        : [...selectedValues, opt];
      onChange(next.join(', '));
    };
    return (
      <div
        data-part="root"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
      >
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              data-part="chip"
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => toggleOption(opt)}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline)'}`,
                background: isSelected ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                color: isSelected ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
                fontSize: 'var(--typography-body-sm-size)',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (fieldType === 'date') {
    return (
      <input
        type="date"
        data-part="root"
        value={value}
        onChange={handleChange}
        style={inputStyle}
      />
    );
  }

  if (fieldType === 'number') {
    return (
      <input
        type="number"
        data-part="root"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={inputStyle}
      />
    );
  }

  // Default: text input (text, string, or unknown fieldType)
  return (
    <input
      type="text"
      data-part="root"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
};

export default TypedValueInput;
