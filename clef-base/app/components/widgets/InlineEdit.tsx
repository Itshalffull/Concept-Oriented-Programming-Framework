'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { validateField, parseValidationRules } from '../../../lib/form-validation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InlineEditProps {
  value: unknown;
  onSave: (newValue: unknown) => Promise<void>;
  editable?: boolean;
  /** Field type for typed input rendering. Defaults to 'text'. */
  fieldType?: string;
  /** Options for select types. */
  options?: string[];
  /** JSON string of validation rules (ValidationRule[]). */
  validations?: string;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Type-specific input renderers
// ---------------------------------------------------------------------------

interface TypedInputProps {
  fieldType: string;
  value: string;
  options?: string[];
  placeholder?: string;
  saving: boolean;
  hasError: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const TypedInput: React.FC<TypedInputProps> = ({
  fieldType, value, options, placeholder, saving, hasError,
  inputRef, onChange, onBlur, onKeyDown,
}) => {
  switch (fieldType) {
    case 'number':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder={placeholder}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    case 'date':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    case 'datetime':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    case 'url':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder={placeholder ?? 'https://'}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    case 'email':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder={placeholder}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    case 'select':
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        >
          <option value="">Select...</option>
          {(options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'json':
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder={placeholder ?? '{}'}
          rows={3}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );

    // text, and all unknown types fall through to text input
    default:
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder={placeholder}
          data-part="inline-edit-input"
          data-field-type={fieldType}
          data-invalid={hasError ? 'true' : 'false'}
        />
      );
  }
};

// ---------------------------------------------------------------------------
// BooleanInlineToggle — no edit mode, click toggles directly
// ---------------------------------------------------------------------------

interface BooleanToggleProps {
  value: unknown;
  onSave: (v: unknown) => Promise<void>;
  editable: boolean;
}

const BooleanInlineToggle: React.FC<BooleanToggleProps> = ({ value, onSave, editable }) => {
  const checked = value === true || value === 'true' || value === 1;
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!editable || saving) return;
    setSaving(true);
    try {
      await onSave(!checked);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [checked, editable, onSave, saving]);

  return (
    <span
      role="switch"
      aria-checked={checked}
      onClick={handleToggle}
      data-part="inline-toggle-track"
      data-state={checked ? 'on' : 'off'}
      data-disabled={editable && !saving ? 'false' : 'true'}
      data-saving={saving ? 'true' : 'false'}
    >
      <span data-part="inline-toggle-thumb" data-state={checked ? 'on' : 'off'} />
    </span>
  );
};

// ---------------------------------------------------------------------------
// InlineEdit — main component
// ---------------------------------------------------------------------------

export const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  onSave,
  editable = true,
  fieldType = 'text',
  options,
  validations,
  placeholder,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, [editing]);

  const validate = useCallback((v: string): string | null => {
    if (!validations) return null;
    try {
      const rules = parseValidationRules(validations);
      if (rules.length === 0) return null;
      const errors = validateField(v, rules);
      return errors.length > 0 ? errors[0] : null;
    } catch {
      return null;
    }
  }, [validations]);

  const handleSave = useCallback(async () => {
    const strValue = String(value ?? '');
    if (editValue === strValue) {
      setEditing(false);
      setValidationError(null);
      return;
    }

    const err = validate(editValue);
    if (err) {
      setValidationError(err);
      // Clear error after 2 seconds and cancel
      setTimeout(() => {
        setValidationError(null);
        setEditValue(strValue);
        setEditing(false);
      }, 2000);
      return;
    }

    setValidationError(null);
    setSaving(true);
    try {
      await onSave(editValue);
      setEditing(false);
    } catch {
      // Keep editing on error
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave, validate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fieldType !== 'json') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''));
      setValidationError(null);
      setEditing(false);
    }
  }, [handleSave, value, fieldType]);

  // Boolean fields use a dedicated toggle — no edit mode, rendered after all hooks
  if (fieldType === 'boolean') {
    return (
      <BooleanInlineToggle value={value} onSave={onSave} editable={editable} />
    );
  }

  if (!editable) {
    return <span data-part="inline-edit-value">{String(value ?? '')}</span>;
  }

  if (editing) {
    return (
      <span data-part="inline-edit" data-state="editing">
        <TypedInput
          fieldType={fieldType}
          value={editValue}
          options={options}
          placeholder={placeholder}
          saving={saving}
          hasError={!!validationError}
          inputRef={inputRef}
          onChange={setEditValue}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
        {validationError && (
          <span data-part="inline-edit-error" role="alert">{validationError}</span>
        )}
      </span>
    );
  }

  return (
    <span
      data-part="inline-edit-trigger"
      data-state="idle"
      onClick={() => {
        setEditValue(String(value ?? ''));
        setValidationError(null);
        setEditing(true);
      }}
      title="Click to edit"
    >
      {String(value ?? '') || '\u00A0'}
    </span>
  );
};

export default InlineEdit;
