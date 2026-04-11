'use client';

/**
 * ViewEditorToolbar — horizontal control bar displayed above every data view.
 * Per surface/widgets/view-editor-toolbar.widget.
 *
 * Hosts per-concern toolbar buttons (Filter, Sort, Group, Fields, Layout, Source)
 * that each open a dedicated popover. Shows filter pills for active filters.
 * Has a save button with unsaved-changes indicator.
 *
 * Usage: drop above ViewRenderer to add toolbar functionality to any view.
 * The toolbar is stateless with respect to the view config — callers pass in
 * the current state and receive change callbacks.
 */

import React, { useState, useCallback, useRef } from 'react';
import { FilterPopover } from './FilterPopover';
import { SortPopover, type SortKey } from './SortPopover';
import { GroupPopover, type GroupConfig } from './GroupPopover';
import { FieldsPopover, type FieldVisibilityConfig } from './FieldsPopover';
import { DisplayModeSwitcher } from './DisplayModeSwitcher';
import { FilterPill, type FilterCondition } from './FilterPill';
import { type FieldDef } from './FieldPickerDropdown';

export type { FilterCondition } from './FilterPill';
export type { SortKey } from './SortPopover';
export type { GroupConfig } from './GroupPopover';
export type { FieldVisibilityConfig } from './FieldsPopover';

type ActivePopover = 'filter' | 'sort' | 'group' | 'fields' | 'layout' | 'source' | null;
type SaveState = 'idle' | 'saving' | 'saved';

interface ViewEditorToolbarProps {
  /** Available fields for filter/sort/group/fields pickers */
  availableFields?: FieldDef[];
  /** Active filter conditions */
  filterConditions: FilterCondition[];
  onFilterConditionsChange: (conditions: FilterCondition[]) => void;
  /** Active sort keys */
  sortKeys: SortKey[];
  onSortKeysChange: (keys: SortKey[]) => void;
  /** Active group config */
  groupConfig: GroupConfig | null;
  onGroupConfigChange: (config: GroupConfig | null) => void;
  /** Field visibility config */
  fieldVisibility: FieldVisibilityConfig[];
  onFieldVisibilityChange: (fields: FieldVisibilityConfig[]) => void;
  /** Current display layout */
  currentLayout: string;
  onLayoutChange: (layout: string) => void;
  /** Save state */
  hasUnsavedChanges: boolean;
  saveState?: SaveState;
  onSave?: () => void;
  /** Optional: compact mode hides labels */
  compact?: boolean;
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  padding: '4px var(--spacing-sm)',
  borderBottom: '1px solid var(--palette-outline-variant)',
  flexWrap: 'wrap',
};

const toolbarBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${active ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
  background: active ? 'var(--palette-primary-container)' : 'transparent',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
  fontWeight: active ? 600 : 400,
});

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 8,
  background: 'var(--palette-primary)',
  color: 'var(--palette-on-primary)',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
};

const saveBtnStyle = (state: SaveState, hasChanges: boolean): React.CSSProperties => ({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: hasChanges && state === 'idle'
    ? 'var(--palette-primary)'
    : 'var(--palette-surface-variant)',
  color: hasChanges && state === 'idle'
    ? 'var(--palette-on-primary)'
    : 'var(--palette-on-surface-variant)',
  cursor: hasChanges && state === 'idle' ? 'pointer' : 'default',
  fontFamily: 'inherit',
  fontSize: 'var(--typography-body-sm-size)',
  fontWeight: 500,
  opacity: state === 'saving' ? 0.7 : 1,
});

const unsavedDotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--palette-warning, #f59e0b)',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--palette-outline-variant)',
  flexShrink: 0,
};

export const ViewEditorToolbar: React.FC<ViewEditorToolbarProps> = ({
  availableFields = [],
  filterConditions,
  onFilterConditionsChange,
  sortKeys,
  onSortKeysChange,
  groupConfig,
  onGroupConfigChange,
  fieldVisibility,
  onFieldVisibilityChange,
  currentLayout,
  onLayoutChange,
  hasUnsavedChanges,
  saveState = 'idle',
  onSave,
  compact = false,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);

  // Refs for each toolbar button (used to position popovers)
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const fieldsBtnRef = useRef<HTMLButtonElement>(null);
  const layoutBtnRef = useRef<HTMLButtonElement>(null);

  const togglePopover = useCallback((key: ActivePopover) => {
    setActivePopover((prev) => (prev === key ? null : key));
  }, []);

  const closePopover = useCallback(() => setActivePopover(null), []);

  const addFilterPill = useCallback(() => {
    const firstField = availableFields[0];
    if (!firstField) return;
    const newCond: FilterCondition = {
      id: `cond-${Math.random().toString(36).slice(2, 9)}`,
      field: firstField.key,
      fieldType: firstField.type ?? 'text',
      operator: 'eq',
      value: '',
      conjunction: 'and',
    };
    onFilterConditionsChange([...filterConditions, newCond]);
  }, [availableFields, filterConditions, onFilterConditionsChange]);

  const filterCount = filterConditions.length;
  const sortCount = sortKeys.length;
  const groupActive = !!groupConfig?.field;

  const saveLabelMap: Record<SaveState, string> = {
    idle: hasUnsavedChanges ? 'Save' : 'Saved',
    saving: 'Saving…',
    saved: 'Saved',
  };

  return (
    <div data-part="root" data-state={saveState} data-has-unsaved={hasUnsavedChanges ? 'true' : 'false'} style={toolbarStyle}>
      {/* Toolbar row */}
      <div data-part="toolbar-row" role="toolbar" aria-label="View editor controls" style={rowStyle}>

        {/* Filter button */}
        <button
          ref={filterBtnRef}
          type="button"
          data-part="filter-button"
          data-active={filterCount > 0 ? 'true' : 'false'}
          onClick={() => togglePopover('filter')}
          style={toolbarBtnStyle(activePopover === 'filter' || filterCount > 0)}
          aria-haspopup="dialog"
          aria-label={filterCount > 0 ? `Filter, ${filterCount} active` : 'Filter'}
        >
          Filter
          {filterCount > 0 && (
            <span data-part="filter-button-badge" style={badgeStyle}>{filterCount}</span>
          )}
        </button>

        {/* Sort button */}
        <button
          ref={sortBtnRef}
          type="button"
          data-part="sort-button"
          data-active={sortCount > 0 ? 'true' : 'false'}
          onClick={() => togglePopover('sort')}
          style={toolbarBtnStyle(activePopover === 'sort' || sortCount > 0)}
          aria-haspopup="dialog"
          aria-label={sortCount > 0 ? `Sort, ${sortCount} active` : 'Sort'}
        >
          Sort
          {sortCount > 0 && (
            <span data-part="sort-button-badge" style={badgeStyle}>{sortCount}</span>
          )}
        </button>

        {/* Group button */}
        <button
          ref={groupBtnRef}
          type="button"
          data-part="group-button"
          data-active={groupActive ? 'true' : 'false'}
          onClick={() => togglePopover('group')}
          style={toolbarBtnStyle(activePopover === 'group' || groupActive)}
          aria-haspopup="dialog"
          aria-label={groupActive ? 'Group, active' : 'Group'}
          aria-pressed={groupActive}
        >
          Group
          {groupActive && (
            <span data-part="group-button-badge" style={badgeStyle}>1</span>
          )}
        </button>

        {/* Fields button */}
        <button
          ref={fieldsBtnRef}
          type="button"
          data-part="fields-button"
          onClick={() => togglePopover('fields')}
          style={toolbarBtnStyle(activePopover === 'fields')}
          aria-haspopup="dialog"
          aria-label="Fields"
        >
          Fields
          {fieldVisibility.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--palette-on-surface-variant)' }}>
              {fieldVisibility.filter((f) => f.visible).length}/{fieldVisibility.length}
            </span>
          )}
        </button>

        <div style={dividerStyle} aria-hidden="true" />

        {/* Layout button */}
        <button
          ref={layoutBtnRef}
          type="button"
          data-part="layout-button"
          onClick={() => togglePopover('layout')}
          style={toolbarBtnStyle(activePopover === 'layout')}
          aria-haspopup="dialog"
          aria-label="Layout"
        >
          {compact ? '▦' : `▦ ${currentLayout}`}
        </button>

        {/* Unsaved indicator + Save button */}
        {onSave && (
          <>
            {hasUnsavedChanges && (
              <span
                data-part="unsaved-indicator"
                role="status"
                aria-label="Unsaved changes"
                aria-live="polite"
                style={unsavedDotStyle}
                title="Unsaved changes"
              />
            )}
            <button
              type="button"
              data-part="save-button"
              data-state={saveState}
              onClick={hasUnsavedChanges && saveState === 'idle' ? onSave : undefined}
              disabled={saveState === 'saving'}
              style={saveBtnStyle(saveState, hasUnsavedChanges)}
              aria-label={
                saveState === 'saving' ? 'Saving…'
                : saveState === 'saved' ? 'Saved'
                : 'Save view'
              }
              aria-busy={saveState === 'saving'}
            >
              {saveLabelMap[saveState]}
            </button>
          </>
        )}
      </div>

      {/* Filter pill bar — shown when there are active filter conditions */}
      {filterConditions.length > 0 && (
        <div
          data-part="filter-pill-bar"
          role="group"
          aria-label="Active filters"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--spacing-xs)',
            padding: '4px var(--spacing-sm)',
            borderBottom: '1px solid var(--palette-outline-variant)',
          }}
        >
          {filterConditions.map((condition, index) => (
            <FilterPill
              key={condition.id}
              condition={condition}
              availableFields={availableFields}
              isFirst={index === 0}
              onChange={(updated) => {
                onFilterConditionsChange(
                  filterConditions.map((c) => (c.id === updated.id ? updated : c))
                );
              }}
              onRemove={(id) => {
                onFilterConditionsChange(filterConditions.filter((c) => c.id !== id));
              }}
            />
          ))}
          <button
            type="button"
            data-part="add-filter-pill-button"
            onClick={addFilterPill}
            style={{
              padding: '3px 8px',
              background: 'none',
              border: '1px dashed var(--palette-outline-variant)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--palette-on-surface-variant)',
              fontSize: 'var(--typography-body-sm-size)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            aria-label="Add filter"
          >
            + filter
          </button>
        </div>
      )}

      {/* Popovers */}
      <FilterPopover
        open={activePopover === 'filter'}
        onClose={closePopover}
        conditions={filterConditions}
        onConditionsChange={onFilterConditionsChange}
        availableFields={availableFields}
        anchorRef={filterBtnRef}
      />

      <SortPopover
        open={activePopover === 'sort'}
        onClose={closePopover}
        sortKeys={sortKeys}
        onSortKeysChange={onSortKeysChange}
        availableFields={availableFields}
        anchorRef={sortBtnRef}
      />

      <GroupPopover
        open={activePopover === 'group'}
        onClose={closePopover}
        groupConfig={groupConfig}
        onGroupConfigChange={onGroupConfigChange}
        availableFields={availableFields}
        anchorRef={groupBtnRef}
      />

      <FieldsPopover
        open={activePopover === 'fields'}
        onClose={closePopover}
        fields={fieldVisibility}
        onFieldsChange={onFieldVisibilityChange}
        anchorRef={fieldsBtnRef}
      />

      <DisplayModeSwitcher
        open={activePopover === 'layout'}
        onClose={closePopover}
        currentMode={currentLayout}
        onModeChange={onLayoutChange}
        anchorRef={layoutBtnRef}
      />
    </div>
  );
};

export default ViewEditorToolbar;
