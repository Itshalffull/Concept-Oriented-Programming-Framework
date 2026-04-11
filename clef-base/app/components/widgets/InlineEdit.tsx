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
// Shared inline input style (matches CSS custom properties pattern)
// ---------------------------------------------------------------------------

const inlineInputStyle: React.CSSProperties = {
  padding: '2px var(--spacing-xs)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-primary)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
};

const inlineErrorStyle: React.CSSProperties = {
  borderColor: 'var(--palette-error)',
};

const errorMessageStyle: React.CSSProperties = {
  color: 'var(--palette-error)',
  fontSize: 'var(--typography-label-sm-size, 0.75rem)',
  marginTop: '2px',
  display: 'block',
};

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
  const style: React.CSSProperties = {
    ...inlineInputStyle,
    ...(hasError ? inlineErrorStyle : {}),
  };

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
          style={style}
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
          style={style}
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
          style={style}
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
          style={style}
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
          style={style}
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
          style={{ ...style, cursor: 'pointer' }}
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
          style={{
            ...style,
            fontFamily: 'var(--typography-mono, monospace)',
            fontSize: 'var(--typography-body-sm-size, 0.85em)',
            resize: 'vertical',
          }}
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
          style={style}
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
      style={{
        display: 'inline-flex',
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        background: checked ? 'var(--palette-primary)' : 'var(--palette-outline)',
        cursor: editable && !saving ? 'pointer' : 'default',
        alignItems: 'center',
        padding: '2px',
        transition: 'background 0.15s',
        flexShrink: 0,
        opacity: saving ? 0.6 : 1,
      }}
      data-part="inline-toggle-track"
      data-state={checked ? 'on' : 'off'}
    >
      <span style={{
        display: 'block',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--palette-on-primary, #fff)',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.15s',
      }} data-part="inline-toggle-thumb" />
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
    return <span>{String(value ?? '')}</span>;
  }

  if (editing) {
    return (
      <span style={{ display: 'block' }}>
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
          <span style={errorMessageStyle} role="alert">{validationError}</span>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(String(value ?? ''));
        setValidationError(null);
        setEditing(true);
      }}
      style={{ cursor: 'pointer', borderBottom: '1px dashed var(--palette-outline-variant)' }}
      title="Click to edit"
    >
      {String(value ?? '') || '\u00A0'}
    </span>
  );
};

export default InlineEdit;
