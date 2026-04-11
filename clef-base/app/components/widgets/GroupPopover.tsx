'use client';

/**
 * GroupPopover — popover for configuring grouping on a data view.
 * Per surface/widgets/group-popover.widget.
 *
 * Opens from the Group toolbar button. Provides a field picker to choose the
 * grouping field, and toggles for collapsing empty groups.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { FieldPickerDropdown, type FieldDef } from './FieldPickerDropdown';

export interface GroupConfig {
  field: string;
  hideEmpty?: boolean;
  collapsedByDefault?: boolean;
}

interface GroupPopoverProps {
  open: boolean;
  onClose: () => void;
  groupConfig: GroupConfig | null;
  onGroupConfigChange: (config: GroupConfig | null) => void;
  availableFields?: FieldDef[];
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  padding: 'var(--spacing-md)',
  minWidth: 280,
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--typography-label-sm-size)',
  color: 'var(--palette-on-surface-variant)',
  marginBottom: 'var(--spacing-xs)',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  marginTop: 'var(--spacing-sm)',
};

export const GroupPopover: React.FC<GroupPopoverProps> = ({
  open,
  onClose,
  groupConfig,
  onGroupConfigChange,
  availableFields = [],
  anchorRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const getPosition = (): React.CSSProperties => {
    if (!anchorRef?.current) return { top: 80, left: 200 };
    const rect = anchorRef.current.getBoundingClientRect();
    return { top: rect.bottom + 8, left: rect.left };
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleFieldChange = useCallback((field: string) => {
    if (!field) {
      onGroupConfigChange(null);
    } else {
      onGroupConfigChange({
        ...(groupConfig ?? {}),
        field,
      });
    }
  }, [groupConfig, onGroupConfigChange]);

  const handleToggle = useCallback((key: 'hideEmpty' | 'collapsedByDefault') => {
    if (!groupConfig) return;
    onGroupConfigChange({ ...groupConfig, [key]: !groupConfig[key] });
  }, [groupConfig, onGroupConfigChange]);

  const handleClear = useCallback(() => {
    onGroupConfigChange(null);
  }, [onGroupConfigChange]);

  if (!open) return null;

  const panelPos = getPosition();
  const fieldsWithNone: FieldDef[] = [{ key: '', label: 'No grouping' }, ...availableFields];

  return (
    <>
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Group configuration"
        style={{ ...panelStyle, ...panelPos }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'] }}>
            Group
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-on-surface-variant)', fontSize: 18 }}
            aria-label="Close group panel"
          >
            ×
          </button>
        </div>

        <div>
          <label style={labelStyle}>Group by field</label>
          <FieldPickerDropdown
            fields={fieldsWithNone}
            currentField={groupConfig?.field ?? ''}
            onChange={handleFieldChange}
          />
        </div>

        {groupConfig?.field && (
          <>
            <div style={toggleRowStyle}>
              <input
                type="checkbox"
                id="hide-empty-groups"
                checked={!!groupConfig.hideEmpty}
                onChange={() => handleToggle('hideEmpty')}
              />
              <label
                htmlFor="hide-empty-groups"
                style={{ fontSize: 'var(--typography-body-sm-size)', cursor: 'pointer' }}
              >
                Hide empty groups
              </label>
            </div>
            <div style={toggleRowStyle}>
              <input
                type="checkbox"
                id="collapse-groups"
                checked={!!groupConfig.collapsedByDefault}
                onChange={() => handleToggle('collapsedByDefault')}
              />
              <label
                htmlFor="collapse-groups"
                style={{ fontSize: 'var(--typography-body-sm-size)', cursor: 'pointer' }}
              >
                Collapse groups by default
              </label>
            </div>
            <button
              type="button"
              onClick={handleClear}
              style={{
                marginTop: 'var(--spacing-sm)',
                padding: '4px 10px',
                background: 'none',
                border: '1px solid var(--palette-outline)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--palette-on-surface-variant)',
                fontSize: 'var(--typography-body-sm-size)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Clear grouping
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default GroupPopover;
