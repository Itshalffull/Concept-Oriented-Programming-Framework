'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineCellEditorProps {
  value: unknown;
  fieldType: string;
  fieldId: string;
  options?: string[];
  onSave: (value: unknown) => void;
  onCancel: () => void;
  onTab?: (direction: 'next' | 'prev') => void;
}

// ---------------------------------------------------------------------------
// Shared cell input style — compact to fit within table cell dimensions
// ---------------------------------------------------------------------------

const cellInputStyle: React.CSSProperties = {
  padding: '1px 4px',
  borderRadius: 'var(--radius-sm)',
  border: '2px solid var(--palette-primary)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

const cellSelectStyle: React.CSSProperties = {
  ...cellInputStyle,
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: '20px',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 4px center',
};

const savingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  paddingRight: '4px',
  fontSize: '0.7rem',
  color: 'var(--palette-primary)',
  pointerEvents: 'none',
};

const errorTextStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 10,
  background: 'var(--palette-error-container, #fde8e8)',
  color: 'var(--palette-error)',
  fontSize: '0.7rem',
  padding: '2px 4px',
  borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// ---------------------------------------------------------------------------
// CellInput — type-dispatched mini-editor
// ---------------------------------------------------------------------------

interface CellInputProps {
  fieldType: string;
  value: string;
  options?: string[];
  inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  saving: boolean;
}

const CellInput: React.FC<CellInputProps> = ({
  fieldType, value, options, inputRef, onChange, onBlur, onKeyDown, saving,
}) => {
  switch (fieldType) {
    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency':
    case 'percentage':
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          step={fieldType === 'integer' ? 1 : 'any'}
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type={fieldType}
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
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type="date"
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
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type="datetime"
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
          placeholder="https://"
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type="url"
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
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type="email"
        />
      );

    case 'select':
    case 'multi-select': {
      // multi-select in a table cell: treat as single-select for compact editing
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          style={cellSelectStyle}
          data-part="cell-input"
          data-field-type={fieldType}
        >
          <option value="">—</option>
          {(options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    case 'rating': {
      const numVal = parseInt(value, 10) || 0;
      return (
        <div
          style={{ display: 'flex', gap: '2px', alignItems: 'center' }}
          data-part="cell-input"
          data-field-type="rating"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(String(star))}
              disabled={saving}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 1px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: star <= numVal ? 'var(--palette-primary)' : 'var(--palette-outline)',
              }}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            >
              {star <= numVal ? '★' : '☆'}
            </button>
          ))}
        </div>
      );
    }

    case 'relation':
    case 'person':
      // Basic type-ahead — just a text input for now; a full reference picker
      // would require async search that is out of scope for a cell editor.
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          placeholder="Search or type ID…"
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type={fieldType}
        />
      );

    default:
      // text, rich-text, json, file, media, formula, computed — plain text
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={saving}
          style={cellInputStyle}
          data-part="cell-input"
          data-field-type={fieldType}
        />
      );
  }
};

// ---------------------------------------------------------------------------
// BooleanCellToggle — immediate toggle, no editing state
// ---------------------------------------------------------------------------

interface BooleanCellToggleProps {
  value: unknown;
  onSave: (v: unknown) => void;
}

const BooleanCellToggle: React.FC<BooleanCellToggleProps> = ({ value, onSave }) => {
  const checked = value === true || value === 'true' || value === 1;
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      onSave(!checked);
    } finally {
      setSaving(false);
    }
  }, [checked, onSave, saving]);

  return (
    <span
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggle(); }}
      data-part="root"
      data-state={checked ? 'on' : 'off'}
      data-field-type="boolean"
      style={{
        display: 'inline-flex',
        width: '32px',
        height: '18px',
        borderRadius: '9px',
        background: checked ? 'var(--palette-primary)' : 'var(--palette-outline)',
        cursor: saving ? 'default' : 'pointer',
        alignItems: 'center',
        padding: '2px',
        opacity: saving ? 0.6 : 1,
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        display: 'block',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: 'var(--palette-on-primary, #fff)',
        transform: checked ? 'translateX(14px)' : 'translateX(0)',
        transition: 'transform 0.15s',
        flexShrink: 0,
      }} data-part="toggle-thumb" />
    </span>
  );
};

// ---------------------------------------------------------------------------
// InlineCellEditor — main component
// ---------------------------------------------------------------------------

type EditState = 'viewing' | 'editing' | 'saving' | 'saved' | 'error';

export const InlineCellEditor: React.FC<InlineCellEditorProps> = ({
  value,
  fieldType,
  fieldId,
  options,
  onSave,
  onCancel,
  onTab,
}) => {
  // Boolean fields use immediate toggle — skip the FSM entirely
  if (fieldType === 'boolean' || fieldType === 'checkbox') {
    return <BooleanCellToggle value={value} onSave={onSave} />;
  }

  return (
    <InlineCellEditorFSM
      value={value}
      fieldType={fieldType}
      fieldId={fieldId}
      options={options}
      onSave={onSave}
      onCancel={onCancel}
      onTab={onTab}
    />
  );
};

// Separate component so hooks aren't called conditionally for boolean case
const InlineCellEditorFSM: React.FC<InlineCellEditorProps> = ({
  value,
  fieldType,
  fieldId,
  options,
  onSave,
  onCancel,
  onTab,
}) => {
  const [editState, setEditState] = useState<EditState>('editing');
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Focus input on mount (we start in editing state)
  useEffect(() => {
    if (editState === 'editing' && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, [editState]);

  // Auto-dismiss saved state after 800ms
  useEffect(() => {
    if (editState === 'saved') {
      const timer = setTimeout(() => {
        setEditState('viewing');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [editState]);

  const handleSave = useCallback(async () => {
    if (editState !== 'editing') return;
    setEditState('saving');
    setErrorMsg(null);
    try {
      onSave(editValue);
      setEditState('saved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
      setEditState('error');
    }
  }, [editState, editValue, onSave]);

  const handleCancel = useCallback(() => {
    onCancel();
    setEditState('viewing');
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (onTab) {
        onTab(e.shiftKey ? 'prev' : 'next');
      } else {
        handleSave();
      }
    }
  }, [handleSave, handleCancel, onTab]);

  const isSaving = editState === 'saving';

  return (
    <div
      data-part="root"
      data-state={editState}
      data-field-type={fieldType}
      role="gridcell"
      aria-label={`Edit ${fieldId}`}
      aria-busy={isSaving}
      aria-invalid={editState === 'error'}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}
    >
      {/* Input container — visible while editing/saving/error */}
      {(editState === 'editing' || editState === 'saving' || editState === 'error') && (
        <div
          data-part="input-container"
          data-visible="true"
          style={{ position: 'relative', width: '100%' }}
        >
          <CellInput
            fieldType={fieldType}
            value={editValue}
            options={options}
            inputRef={inputRef}
            onChange={setEditValue}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            saving={isSaving}
          />

          {/* Saving indicator inside the input */}
          {isSaving && (
            <span style={savingOverlayStyle} aria-live="polite" aria-label="Saving">
              ···
            </span>
          )}

          {/* Error message below input */}
          {editState === 'error' && errorMsg && (
            <span
              data-part="error-message"
              data-visible="true"
              role="alert"
              aria-live="assertive"
              style={errorTextStyle}
            >
              {errorMsg}
            </span>
          )}
        </div>
      )}

      {/* Saved indicator — briefly shown after successful save */}
      {editState === 'saved' && (
        <span
          data-part="save-indicator"
          data-visible="true"
          role="status"
          aria-live="polite"
          aria-label="Saved"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '0.75rem',
            color: 'var(--palette-primary)',
            padding: '1px 4px',
          }}
        >
          <span style={{ fontSize: '0.65rem' }}>✓</span>
          {String(value ?? '')}
        </span>
      )}

      {/* Viewing state — shows the value (parent controls this, but fallback) */}
      {editState === 'viewing' && (
        <span data-part="view-value" style={{ opacity: 0.6, fontSize: '0.85em' }}>
          {String(value ?? '')}
        </span>
      )}
    </div>
  );
};

export default InlineCellEditor;
