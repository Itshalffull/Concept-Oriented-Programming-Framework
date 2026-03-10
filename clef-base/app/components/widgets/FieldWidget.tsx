'use client';

import React from 'react';
import type { SchemaField } from './FormMode';

interface FieldWidgetProps {
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-md-size)',
  fontFamily: 'inherit',
};

export const FieldWidget: React.FC<FieldWidgetProps> = ({ field, value, onChange }) => {
  const type = field.type ?? 'text';

  switch (type) {
    case 'textarea':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      );
    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontSize: 'var(--typography-body-md-size)' }}>
            {value ? 'Yes' : 'No'}
          </span>
        </label>
      );
    case 'json':
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)', fontSize: 'var(--typography-code-sm-size)', resize: 'vertical' }}
        />
      );
    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );
  }
};

export default FieldWidget;
