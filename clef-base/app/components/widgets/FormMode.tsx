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
    <div data-surface="mag651-form-shell">
      {error && (
        <div data-part="field-error">
          {error}
        </div>
      )}

      <div data-part="field-panel-section">
        {fields.map(field => {
          const isEditable = field.mutability === 'editable' || field.mutability === undefined;
          return (
            <div key={field.name} data-part="field-panel-row">
              <label
                data-part="field-label"
                data-muted={isEditable ? undefined : 'true'}
              >
                {field.label ?? field.name}
                {!isEditable && (
                  <span data-part="field-meta">
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
                <div data-part="field-readonly">
                  {String(values[field.name] ?? '')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div data-part="field-actions" style={{ marginTop: 'var(--spacing-xl)' }}>
        {success && (
          <span data-part="field-meta" style={{ color: 'var(--palette-success)' }}>
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
