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
          data-part="cell-input"
          data-field-type={fieldType}
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type="date"
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type="datetime"
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type="url"
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type="email"
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type={fieldType}
          data-invalid="false"
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
        <div data-part="cell-rating" data-field-type="rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(String(star))}
              disabled={saving}
              data-part="cell-rating-option"
              data-selected={star <= numVal ? 'true' : 'false'}
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
          data-part="cell-input"
          data-field-type={fieldType}
          data-invalid="false"
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
          data-part="cell-input"
          data-field-type={fieldType}
          data-invalid="false"
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
      data-part="inline-cell-toggle"
      data-state={checked ? 'on' : 'off'}
      data-field-type="boolean"
      data-disabled={saving ? 'true' : 'false'}
      data-saving={saving ? 'true' : 'false'}
    >
      <span data-part="inline-cell-toggle-thumb" data-state={checked ? 'on' : 'off'} />
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
      data-part="inline-cell-editor"
      data-state={editState}
      data-field-type={fieldType}
      role="gridcell"
      aria-label={`Edit ${fieldId}`}
      aria-busy={isSaving}
      aria-invalid={editState === 'error'}
    >
      {/* Input container — visible while editing/saving/error */}
      {(editState === 'editing' || editState === 'saving' || editState === 'error') && (
        <div
          data-part="cell-input-container"
          data-visible="true"
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
            <span data-part="cell-saving-indicator" aria-live="polite" aria-label="Saving">
              ···
            </span>
          )}

          {/* Error message below input */}
          {editState === 'error' && errorMsg && (
            <span
              data-part="cell-error-message"
              data-visible="true"
              role="alert"
              aria-live="assertive"
            >
              {errorMsg}
            </span>
          )}
        </div>
      )}

      {/* Saved indicator — briefly shown after successful save */}
      {editState === 'saved' && (
        <span
          data-part="cell-save-indicator"
          data-visible="true"
          role="status"
          aria-live="polite"
          aria-label="Saved"
        >
          <span data-part="cell-save-icon">✓</span>
          {String(value ?? '')}
        </span>
      )}

      {/* Viewing state — shows the value (parent controls this, but fallback) */}
      {editState === 'viewing' && (
        <span data-part="cell-view-value">
          {String(value ?? '')}
        </span>
      )}
    </div>
  );
};

export default InlineCellEditor;
