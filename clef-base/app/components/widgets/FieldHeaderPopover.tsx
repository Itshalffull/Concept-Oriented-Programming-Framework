'use client';

/**
 * FieldHeaderPopover — popover on table column header click for Level 1
 * schema editing (rename, type change, required/unique, sort, hide, delete).
 *
 * Provides quick inline field management without opening the full config drawer.
 * A "Configure..." button escalates to the field config drawer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { FIELD_TYPE_REGISTRY } from './FieldWidget';
import { Popover } from './Popover';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface FieldHeaderPopoverProps {
  open: boolean;
  anchorEl?: HTMLElement;
  fieldId: string;
  schemaId: string;
  fieldLabel: string;
  fieldType: string;
  required?: boolean;
  unique?: boolean;
  onClose: () => void;
  onRename: (label: string) => void;
  onChangeType: (type: string) => void;
  onToggleRequired: () => void;
  onToggleUnique: () => void;
  onSort: (direction: 'asc' | 'desc') => void;
  onHide: () => void;
  onDelete: () => void;
  onConfigure: () => void;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  minWidth: 240,
  maxWidth: 300,
  overflow: 'hidden',
};

const sectionStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs) 0',
  borderBottom: '1px solid var(--palette-outline)',
};

const rowInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--palette-outline)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-md-size)',
  fontFamily: 'inherit',
  outline: 'none',
};

const menuItemStyle = (danger = false): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  width: '100%',
  padding: '6px var(--spacing-md)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: danger ? 'var(--palette-error)' : 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  textAlign: 'left',
});

const menuItemHoverStyle: React.CSSProperties = {
  background: 'var(--palette-surface-variant)',
};

const toggleStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '6px var(--spacing-md)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
});

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 16,
  borderRadius: 8,
  background: active ? 'var(--palette-primary)' : 'var(--palette-outline)',
  transition: 'background 0.15s',
  position: 'relative',
});

const pillDotStyle = (active: boolean): React.CSSProperties => ({
  position: 'absolute',
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: 'var(--palette-surface)',
  left: active ? 18 : 2,
  transition: 'left 0.15s',
});

const typePickerStyle: React.CSSProperties = {
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
  padding: 'var(--spacing-xs) 0',
  minWidth: 180,
  maxHeight: 320,
  overflowY: 'auto',
};

const typeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  padding: '5px var(--spacing-md)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  color: 'var(--palette-on-surface)',
  background: 'none',
  border: 'none',
  width: '100%',
  fontFamily: 'inherit',
  textAlign: 'left',
};

// ─── Toggle helper ─────────────────────────────────────────────────────────────

const Toggle: React.FC<{ label: string; active: boolean; onToggle: () => void }> = ({
  label, active, onToggle,
}) => (
  <button
    type="button"
    data-part="toggle-row"
    style={toggleStyle(active)}
    onClick={onToggle}
    aria-pressed={active}
  >
    <span>{label}</span>
    <span style={pillStyle(active)}>
      <span style={pillDotStyle(active)} />
    </span>
  </button>
);

// ─── MenuItem helper ───────────────────────────────────────────────────────────

const MenuItem: React.FC<{
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger = false, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      data-part="menu-item"
      style={{ ...menuItemStyle(danger), ...(hovered ? menuItemHoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span style={{ width: 16, textAlign: 'center', opacity: 0.7 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

// ─── FieldHeaderPopover ────────────────────────────────────────────────────────

export const FieldHeaderPopover: React.FC<FieldHeaderPopoverProps> = ({
  open,
  anchorEl,
  fieldId,
  schemaId,
  fieldLabel,
  fieldType,
  required = false,
  unique = false,
  onClose,
  onRename,
  onChangeType,
  onToggleRequired,
  onToggleUnique,
  onSort,
  onHide,
  onDelete,
  onConfigure,
}) => {
  const invoke = useKernelInvoke();
  const renameRef = useRef<HTMLInputElement>(null);
  const typePickerTriggerRef = useRef<HTMLDivElement>(null);

  const [labelDraft, setLabelDraft] = useState(fieldLabel);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync label draft when prop changes (e.g. popover reopens on different field)
  useEffect(() => {
    setLabelDraft(fieldLabel);
  }, [fieldLabel, fieldId]);

  const commitRename = () => {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== fieldLabel) {
      onRename(trimmed);
      // Also persist via kernel
      invoke('FieldDefinition', 'update', {
        field: fieldId,
        label: trimmed,
      }).catch(() => {/* silently ignore — parent callback handles optimistic update */});
    }
  };

  const handleTypePickerOpen = () => {
    setShowTypePicker(true);
  };

  const handleTypeSelect = async (type: string) => {
    setShowTypePicker(false);
    onChangeType(type);
    setActionError(null);
    try {
      const result = await invoke('FieldDefinition', 'update', { field: fieldId, type });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to update field type.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update field type.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) {
      // First click: check usage, then show confirm
      setDeleting(true);
      return;
    }
    // Second click: confirmed delete
    setActionError(null);
    try {
      const result = await invoke('FieldDefinition', 'remove', { field: fieldId, schema: schemaId });
      if (result.variant === 'ok') {
        onDelete();
        onClose();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to delete field.');
        setDeleting(false);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete field.');
      setDeleting(false);
    }
  };

  const currentTypeCfg = FIELD_TYPE_REGISTRY[fieldType];

  const mainPanelContent = (
    <div style={panelStyle}>
      {/* Action error */}
      {actionError && (
        <div
          data-part="action-error"
          style={{
            padding: '4px var(--spacing-sm)',
            background: 'var(--palette-error-container)',
            color: 'var(--palette-on-error-container)',
            fontSize: '11px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, lineHeight: 1, padding: '2px' }} onClick={() => setActionError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Rename input */}
      <div data-part="rename-section" style={{ padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
        <input
          ref={renameRef}
          data-part="rename-input"
          type="text"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitRename();
              e.currentTarget.blur();
            }
          }}
          style={rowInputStyle}
          aria-label="Field label"
          placeholder="Field name"
        />
      </div>

      {/* Type picker trigger */}
      <div data-part="type-section" ref={typePickerTriggerRef} style={sectionStyle}>
        <MenuItem
          icon={currentTypeCfg?.icon ?? '?'}
          label={`Type: ${currentTypeCfg?.label ?? fieldType}`}
          onClick={handleTypePickerOpen}
        />
      </div>

      {/* Required / Unique toggles */}
      <div data-part="toggles-section" style={sectionStyle}>
        <Toggle label="Required" active={required} onToggle={onToggleRequired} />
        <Toggle label="Unique" active={unique} onToggle={onToggleUnique} />
      </div>

      {/* Sort actions */}
      <div data-part="sort-section" style={sectionStyle}>
        <MenuItem icon="↑" label="Sort ascending" onClick={() => { onSort('asc'); onClose(); }} />
        <MenuItem icon="↓" label="Sort descending" onClick={() => { onSort('desc'); onClose(); }} />
      </div>

      {/* Field actions */}
      <div data-part="actions-section" style={sectionStyle}>
        <MenuItem icon="⊘" label="Hide field" onClick={() => { onHide(); onClose(); }} />
        <MenuItem
          icon="⚙"
          label="Configure..."
          onClick={() => { onConfigure(); onClose(); }}
        />
      </div>

      {/* Delete — two-step confirm */}
      <div data-part="delete-section" style={{ padding: 'var(--spacing-xs) 0' }}>
        <MenuItem
          icon="🗑"
          label={deleting ? 'Click again to confirm delete' : 'Delete field'}
          danger
          onClick={handleDelete}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Main popover panel anchored to the column header */}
      <Popover
        anchor={anchorEl ?? null}
        open={open}
        onClose={onClose}
        placement="bottom-start"
        width={280}
      >
        <div
          data-part="root"
          data-state="open"
          data-contract="floating-panel"
          aria-label={`Field options for ${fieldLabel}`}
        >
          {mainPanelContent}
        </div>
      </Popover>

      {/* Type picker flyout — anchored to the type row trigger */}
      <Popover
        anchor={typePickerTriggerRef.current}
        open={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        placement="right-start"
        width={200}
      >
        <div data-part="type-picker" style={typePickerStyle}>
          {Object.entries(FIELD_TYPE_REGISTRY).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              data-part="type-option"
              style={{
                ...typeItemStyle,
                background: key === fieldType ? 'var(--palette-primary-container)' : 'none',
                color: key === fieldType ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
              }}
              onClick={() => handleTypeSelect(key)}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
};

export default FieldHeaderPopover;
