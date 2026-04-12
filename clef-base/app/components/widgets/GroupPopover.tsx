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
      <div data-surface="floating-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        data-surface="floating-panel"
        data-part="root"
        data-state="open"
        role="dialog"
        aria-label="Group configuration"
        aria-modal="true"
        style={{ ...panelPos, minWidth: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-part="header">
          <span data-part="title">
            Group
          </span>
          <button
            type="button"
            onClick={onClose}
            data-surface="floating-icon-button"
            data-part="close-button"
            aria-label="Close group panel"
          >
            ×
          </button>
        </div>

        <div>
          <label data-part="section-label">Group by field</label>
          <FieldPickerDropdown
            fields={fieldsWithNone}
            currentField={groupConfig?.field ?? ''}
            onChange={handleFieldChange}
          />
        </div>

        {groupConfig?.field && (
          <>
            <div data-part="toggle-row">
              <input
                type="checkbox"
                id="hide-empty-groups"
                checked={!!groupConfig.hideEmpty}
                onChange={() => handleToggle('hideEmpty')}
              />
              <label
                htmlFor="hide-empty-groups"
                data-part="row-label"
              >
                Hide empty groups
              </label>
            </div>
            <div data-part="toggle-row">
              <input
                type="checkbox"
                id="collapse-groups"
                checked={!!groupConfig.collapsedByDefault}
                onChange={() => handleToggle('collapsedByDefault')}
              />
              <label
                htmlFor="collapse-groups"
                data-part="row-label"
              >
                Collapse groups by default
              </label>
            </div>
            <button
              type="button"
              onClick={handleClear}
              data-surface="floating-action-button"
              data-variant="quiet"
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
