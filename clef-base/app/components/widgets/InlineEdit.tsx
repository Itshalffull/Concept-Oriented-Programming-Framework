'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface InlineEditProps {
  value: unknown;
  onSave: (newValue: unknown) => Promise<void>;
  editable?: boolean;
}

export const InlineEdit: React.FC<InlineEditProps> = ({ value, onSave, editable = true }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    if (editValue === String(value ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
      setEditing(false);
    } catch {
      // Keep editing on error
    } finally {
      setSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''));
      setEditing(false);
    }
  }, [handleSave, value]);

  if (!editable) {
    return <span>{String(value ?? '')}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        style={{
          padding: '2px var(--spacing-xs)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--palette-primary)',
          background: 'var(--palette-surface)',
          color: 'var(--palette-on-surface)',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          width: '100%',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(String(value ?? ''));
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
