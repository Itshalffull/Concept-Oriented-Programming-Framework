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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--palette-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          minWidth: 400,
          maxWidth: 560,
          width: '100%',
          boxShadow: 'var(--elevation-3)',
        }}
      >
        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>{title}</h2>

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
          <div
            style={{
              padding: 'var(--spacing-xl)',
              textAlign: 'center',
              color: 'var(--palette-on-surface-variant)',
            }}
          >
            Loading form...
          </div>
        ) : (
          // Fallback: hardcoded FieldDef-based rendering
          <>
            {error && (
              <div style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--palette-error-container)',
                color: 'var(--palette-on-error-container)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--typography-body-sm-size)',
              }}>
                {errorVariant && errorVariant !== 'error' && (
                  <span style={{ fontWeight: 600, marginRight: 4 }}>[{errorVariant}]</span>
                )}
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {fields.map((field) => (
                <div key={field.name} style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label
                    htmlFor={`field-${field.name}`}
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: 'var(--typography-label-md-size)',
                      fontWeight: 'var(--typography-label-md-weight)',
                    }}
                  >
                    {field.label ?? field.name}
                    {field.required && <span style={{ color: 'var(--palette-error)' }}> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--palette-outline)',
                        background: 'var(--palette-surface-variant)',
                        color: 'var(--palette-on-surface)',
                        fontFamily: 'inherit',
                        fontSize: 'var(--typography-body-md-size)',
                        resize: 'vertical',
                      }}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={`field-${field.name}`}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                      required={field.required}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--palette-outline)',
                        background: 'var(--palette-surface-variant)',
                        color: 'var(--palette-on-surface)',
                        fontSize: 'var(--typography-body-md-size)',
                      }}
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
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--palette-outline)',
                        background: 'var(--palette-surface-variant)',
                        color: 'var(--palette-on-surface)',
                        fontSize: 'var(--typography-body-md-size)',
                      }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
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
