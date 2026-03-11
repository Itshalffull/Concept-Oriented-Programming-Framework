'use client';

import React, { useState, useCallback } from 'react';
import { FieldWidget } from './FieldWidget';

export interface SchemaField {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'select' | 'boolean' | 'json';
  mutability?: 'editable' | 'readonly' | 'system';
  options?: string[];
}

interface FormModeProps {
  entity: Record<string, unknown>;
  fields: SchemaField[];
  onSave: (changes: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export const FormMode: React.FC<FormModeProps> = ({ entity, fields, onSave, onCancel }) => {
  const [values, setValues] = useState<Record<string, unknown>>({ ...entity });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Compute changed fields
      const changes: Record<string, unknown> = {};
      for (const field of fields) {
        if (field.mutability !== 'editable' && field.mutability !== undefined) continue;
        if (values[field.name] !== entity[field.name]) {
          changes[field.name] = values[field.name];
        }
      }
      await onSave(changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [values, entity, fields, onSave]);

  return (
    <div>
      {error && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--typography-body-sm-size)',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {fields.map(field => {
          const isEditable = field.mutability === 'editable' || field.mutability === undefined;
          return (
            <div key={field.name}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: 'var(--typography-label-md-size)',
                  fontWeight: 'var(--typography-label-md-weight)',
                  color: isEditable ? 'var(--palette-on-surface)' : 'var(--palette-on-surface-variant)',
                }}
              >
                {field.label ?? field.name}
                {!isEditable && (
                  <span style={{ fontSize: 'var(--typography-label-sm-size)', marginLeft: 'var(--spacing-xs)', opacity: 0.6 }}>
                    ({field.mutability})
                  </span>
                )}
              </label>
              {isEditable ? (
                <FieldWidget
                  field={field}
                  value={values[field.name]}
                  onChange={(v) => handleChange(field.name, v)}
                />
              ) : (
                <div style={{
                  padding: 'var(--spacing-sm)',
                  background: 'var(--palette-surface-variant)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--typography-body-md-size)',
                  opacity: 0.7,
                }}>
                  {String(values[field.name] ?? '')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-xl)' }}>
        <button data-part="button" data-variant="outlined" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button data-part="button" data-variant="outlined" onClick={() => setValues({ ...entity })} disabled={saving}>
          Preview
        </button>
        <button data-part="button" data-variant="filled" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default FormMode;
