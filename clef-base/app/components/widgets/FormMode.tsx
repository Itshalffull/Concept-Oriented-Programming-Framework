'use client';

import React, { useState, useCallback, useRef } from 'react';
import { FieldWidget } from './FieldWidget';
import { FormRenderer } from './FormRenderer';

export interface SchemaField {
  name: string;
  label?: string;
  type?: string;
  mutability?: 'editable' | 'readonly' | 'system';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  validations?: string; // JSON string of ValidationRule[]
}

interface FormModeProps {
  entity: Record<string, unknown>;
  fields: SchemaField[];
  onSave: (changes: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  /** When provided, attempt FormSpec resolution for the schema. If a FormSpec
   *  exists, renders via FormRenderer; otherwise falls back to the flat
   *  FieldWidget list. */
  schemaId?: string;
}

export const FormMode: React.FC<FormModeProps> = ({ entity, fields, onSave, onCancel, schemaId }) => {
  const [values, setValues] = useState<Record<string, unknown>>({ ...entity });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
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
      setSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [values, entity, fields, onSave]);

  // When schemaId is provided, delegate to FormRenderer which handles FormSpec
  // resolution internally. If the schema has no FormSpec, FormRenderer falls
  // back to its own FlatFallback renderer (FieldDefinition-driven).
  if (schemaId) {
    const handleFormRendererSubmit = async (submittedValues: Record<string, unknown>) => {
      // Compute diff: only send fields that changed from the original entity value.
      const changes: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(submittedValues)) {
        const originalVal = entity[key];
        const submittedStr = typeof val === 'string' ? val : JSON.stringify(val);
        const originalStr = typeof originalVal === 'string' ? originalVal : JSON.stringify(originalVal ?? null);
        if (submittedStr !== originalStr) {
          changes[key] = val;
        }
      }
      if (Object.keys(changes).length > 0) {
        await onSave(changes);
      }
    };

    return (
      <FormRenderer
        schemaId={schemaId}
        mode="edit"
        initialValues={entity}
        onSubmit={handleFormRendererSubmit}
        onCancel={onCancel}
        compact={true}
      />
    );
  }

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

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-xl)', alignItems: 'center' }}>
        {success && (
          <span style={{
            fontSize: 'var(--typography-body-sm-size)',
            color: 'var(--palette-success, #2e7d32)',
            marginRight: 'var(--spacing-sm)',
          }}>
            Saved
          </span>
        )}
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
