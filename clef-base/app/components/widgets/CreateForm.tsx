'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import FormRenderer from './FormRenderer';

interface FieldDef {
  name: string;
  label?: string;
  type?: 'text' | 'textarea' | 'select';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface CreateFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  concept: string;
  action: string;
  title: string;
  fields: FieldDef[];
  /** When provided, try FormSpec resolution for schema-driven form rendering. */
  schemaId?: string;
}

export const CreateForm: React.FC<CreateFormProps> = ({
  concept,
  action,
  fields,
  title,
  open,
  onClose,
  onCreated,
  schemaId,
}) => {
  const invoke = useKernelInvoke();
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<string | null>(null);

  // FormSpec resolution state — only relevant when schemaId is provided
  const [formSpecResolved, setFormSpecResolved] = useState<boolean | null>(null);

  // Resolve FormSpec existence when schemaId is provided and modal is open
  useEffect(() => {
    if (!schemaId || !open) return;
    let cancelled = false;

    async function resolve() {
      setFormSpecResolved(null); // probing
      try {
        const result = await invoke('FormSpec', 'resolve', { schemaId, mode: 'create' });
        if (!cancelled) {
          setFormSpecResolved(result.variant === 'ok');
        }
      } catch {
        if (!cancelled) {
          setFormSpecResolved(false);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [schemaId, open, invoke]);

  // Fallback submit handler (used when no FormSpec)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrorVariant(null);
    try {
      const result = await invoke(concept, action, values);
      if (result.variant === 'ok') {
        setValues({});
        onCreated();
        onClose();
      } else {
        setErrorVariant(result.variant as string);
        setError(result.message as string ?? `Action returned: ${result.variant}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [invoke, concept, action, values, onCreated, onClose]);

  // FormRenderer submit handler (used when FormSpec is found)
  const handleFormRendererSubmit = useCallback(async (formValues: Record<string, unknown>) => {
    const result = await invoke(concept, action, formValues);
    if (result.variant === 'ok') {
      onCreated();
      onClose();
    } else {
      throw new Error(result.message as string ?? `Failed: ${result.variant}`);
    }
  }, [invoke, concept, action, onCreated, onClose]);

  if (!open) return null;

  // Determine whether to use FormRenderer
  const useFormRenderer = schemaId != null && formSpecResolved === true;

  return (
    <div
      data-surface="mag651-form-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-surface="mag651-field-panel"
      >
        <h2 data-part="field-panel-title">{title}</h2>

        {useFormRenderer ? (
          // FormSpec-driven rendering
          <FormRenderer
            schemaId={schemaId!}
            mode="create"
            onSubmit={handleFormRendererSubmit}
            onCancel={onClose}
            compact={true}
          />
        ) : schemaId != null && formSpecResolved === null ? (
          // Still probing for FormSpec — show a minimal loading state
          <div data-part="field-panel-subtitle">
            Loading form...
          </div>
        ) : (
          // Fallback: hardcoded FieldDef-based rendering
          <>
            {error && (
              <div data-part="field-error">
                {errorVariant && errorVariant !== 'error' && (
                  <span data-part="field-error-variant">[{errorVariant}]</span>
                )}
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {fields.map((field) => (
                <div key={field.name} data-part="field-panel-row">
                  <label
                    htmlFor={`field-${field.name}`}
                    data-part="field-label"
                  >
                    {field.label ?? field.name}
                    {field.required && <span data-part="field-required"> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                      required={field.required}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    >
                      <option value="">Select...</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`field-${field.name}`}
                      type="text"
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      data-surface="mag651-field-control"
                      data-contract="field-control"
                    />
                  )}
                </div>
              ))}

              <div data-part="field-actions" style={{ marginTop: 'var(--spacing-lg)' }}>
                <button
                  type="button"
                  data-part="button"
                  data-variant="outlined"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-part="button"
                  data-variant="filled"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateForm;
