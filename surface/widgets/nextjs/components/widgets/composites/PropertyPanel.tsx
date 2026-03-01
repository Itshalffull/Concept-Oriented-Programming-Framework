'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { propertyPanelReducer } from './PropertyPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from property-panel.widget spec props
 * ------------------------------------------------------------------------- */

export type PropertyType = 'text' | 'select' | 'date' | 'person' | 'tags' | 'checkbox' | 'number' | 'url';

export interface PropertyDef {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
  displayValue?: string;
  options?: string[];
}

export interface PropertyPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'title'> {
  properties: PropertyDef[];
  title?: string;
  collapsed?: boolean;
  editable?: boolean;
  reorderable?: boolean;
  showAddButton?: boolean;
  disabled?: boolean;
  onChange?: (key: string, value: unknown) => void;
  onAdd?: () => void;
  onReorder?: (properties: PropertyDef[]) => void;
  renderEditor?: (property: PropertyDef, onCommit: (value: unknown) => void) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const PropertyPanel = forwardRef<HTMLDivElement, PropertyPanelProps>(
  function PropertyPanel(
    {
      properties,
      title = 'Properties',
      collapsed = false,
      editable = true,
      reorderable = false,
      showAddButton = true,
      disabled = false,
      onChange,
      onAdd,
      onReorder,
      renderEditor,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(propertyPanelReducer, {
      panel: collapsed ? 'collapsed' : 'expanded',
      editingKey: null,
      editValue: null,
      draggingKey: null,
    });

    const listId = useId();
    const panelTitleId = useId();

    const handleToggle = useCallback(() => {
      send({ type: state.panel === 'expanded' ? 'COLLAPSE' : 'EXPAND' });
    }, [state.panel]);

    const handleClickValue = useCallback(
      (prop: PropertyDef) => {
        if (!editable || disabled) return;
        send({ type: 'CLICK_VALUE', key: prop.key, value: prop.value });
      },
      [editable, disabled],
    );

    const handleCommit = useCallback(
      (key: string, value: unknown) => {
        send({ type: 'COMMIT', value });
        onChange?.(key, value);
      },
      [onChange],
    );

    const handleMoveUp = useCallback(
      (key: string) => {
        const idx = properties.findIndex((p) => p.key === key);
        if (idx <= 0) return;
        const next = [...properties];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onReorder?.(next);
      },
      [properties, onReorder],
    );

    const handleMoveDown = useCallback(
      (key: string) => {
        const idx = properties.findIndex((p) => p.key === key);
        if (idx < 0 || idx >= properties.length - 1) return;
        const next = [...properties];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        onReorder?.(next);
      },
      [properties, onReorder],
    );

    const renderValueEditor = (prop: PropertyDef) => {
      if (renderEditor) {
        return renderEditor(prop, (val) => handleCommit(prop.key, val));
      }
      if (prop.type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={Boolean(prop.value)}
            onChange={(e) => handleCommit(prop.key, e.target.checked)}
            disabled={disabled}
          />
        );
      }
      if (prop.type === 'select' && prop.options) {
        return (
          <select
            value={String(prop.value ?? '')}
            onChange={(e) => handleCommit(prop.key, e.target.value)}
            disabled={disabled}
            autoFocus
          >
            <option value="">Select...</option>
            {prop.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          type={prop.type === 'number' ? 'number' : prop.type === 'date' ? 'date' : prop.type === 'url' ? 'url' : 'text'}
          value={String(state.editValue ?? '')}
          onChange={(e) => send({ type: 'EDIT_VALUE', value: e.target.value })}
          onBlur={() => {
            handleCommit(prop.key, state.editValue);
            send({ type: 'BLUR' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit(prop.key, state.editValue);
            if (e.key === 'Escape') send({ type: 'CANCEL' });
          }}
          disabled={disabled}
          autoFocus
        />
      );
    };

    return (
      <div
        ref={ref}
        role="region"
        aria-label={`${title} panel`}
        data-surface-widget=""
        data-widget-name="property-panel"
        data-part="root"
        data-state={state.panel}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        <div data-part="header" data-state={state.panel}>
          <span data-part="title" id={panelTitleId}>
            {title}
          </span>
          <button
            type="button"
            data-part="toggle-button"
            aria-expanded={state.panel === 'expanded' ? 'true' : 'false'}
            aria-controls={listId}
            aria-label={
              state.panel === 'expanded' ? `Collapse ${title}` : `Expand ${title}`
            }
            onClick={handleToggle}
          >
            {state.panel === 'expanded' ? '\u25B2' : '\u25BC'}
          </button>
        </div>

        <div
          id={listId}
          role="list"
          aria-label="Properties"
          data-part="property-list"
          data-state={state.panel}
          hidden={state.panel === 'collapsed'}
        >
          {properties.length === 0 && (
            <div data-part="empty-state" aria-hidden="false">
              No properties defined
            </div>
          )}

          {properties.map((prop) => {
            const isEditing = state.editingKey === prop.key;
            return (
              <div
                key={prop.key}
                role="listitem"
                aria-label={prop.label}
                data-part="property-row"
                data-type={prop.type}
                data-state={isEditing ? 'editing' : 'displaying'}
                data-dragging={state.draggingKey === prop.key ? 'true' : 'false'}
              >
                {reorderable && (
                  <button
                    type="button"
                    data-part="drag-handle"
                    role="button"
                    aria-roledescription="sortable"
                    aria-label={`Reorder property ${prop.label}`}
                    hidden={!reorderable}
                    disabled={disabled}
                    tabIndex={0}
                    onPointerDown={() => send({ type: 'DRAG_START', key: prop.key })}
                    onPointerUp={() => send({ type: 'DROP' })}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') handleMoveUp(prop.key);
                      if (e.key === 'ArrowDown') handleMoveDown(prop.key);
                    }}
                  >
                    &#x2630;
                  </button>
                )}

                <span data-part="property-icon" data-type={prop.type} aria-hidden="true" />

                <span
                  data-part="property-label"
                  data-type={prop.type}
                  id={`prop-label-${prop.key}`}
                >
                  {prop.label}
                </span>

                <div
                  data-part="property-value"
                  data-state={isEditing ? 'editing' : 'displaying'}
                  data-type={prop.type}
                  data-empty={!prop.value ? 'true' : 'false'}
                  role={isEditing ? undefined : 'button'}
                  aria-label={
                    isEditing ? undefined : `Edit ${prop.label}: ${prop.displayValue ?? String(prop.value ?? '')}`
                  }
                  aria-labelledby={`prop-label-${prop.key}`}
                  tabIndex={0}
                  onClick={() => handleClickValue(prop)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleClickValue(prop);
                  }}
                >
                  {isEditing
                    ? renderValueEditor(prop)
                    : (prop.displayValue ?? String(prop.value ?? 'Empty'))}
                </div>
              </div>
            );
          })}
        </div>

        {showAddButton && (
          <button
            type="button"
            data-part="add-property-button"
            aria-label="Add property"
            disabled={disabled || !showAddButton}
            hidden={!showAddButton}
            onClick={onAdd}
          >
            Add property
          </button>
        )}

        {children}
      </div>
    );
  },
);

PropertyPanel.displayName = 'PropertyPanel';
export default PropertyPanel;
