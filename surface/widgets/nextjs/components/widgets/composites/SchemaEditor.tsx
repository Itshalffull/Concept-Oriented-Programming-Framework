'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { schemaEditorReducer, nextFieldId } from './SchemaEditor.reducer.js';
import type { FieldType, FieldDefinition, SchemaEditorEvent } from './SchemaEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from schema-editor.widget spec props
 * ------------------------------------------------------------------------- */

export type { FieldType, FieldDefinition, SchemaEditorEvent };

export interface TypeDef {
  key: FieldType;
  label: string;
}

export interface SchemaEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  fields?: FieldDefinition[];
  availableTypes?: FieldType[];
  maxFields?: number;
  disabled?: boolean;
  reorderable?: boolean;
  showValidation?: boolean;
  onChange?: (fields: FieldDefinition[]) => void;
  renderConfigPanel?: (field: FieldDefinition, onUpdate: (config: Record<string, unknown>) => void) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const SchemaEditor = forwardRef<HTMLDivElement, SchemaEditorProps>(
  function SchemaEditor(
    {
      fields: controlledFields,
      availableTypes = ['text', 'number', 'date', 'select', 'checkbox', 'url', 'email', 'relation', 'formula'],
      maxFields = 50,
      disabled = false,
      reorderable = true,
      showValidation = true,
      onChange,
      renderConfigPanel,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(schemaEditorReducer, {
      fieldCount: (controlledFields?.length ?? 0) > 0 ? 'hasFields' : 'empty',
      expandedFieldId: null,
      draggingFieldId: null,
      fields: controlledFields ?? [],
    });

    const effectiveFields = controlledFields ?? state.fields;

    const emitChange = useCallback(
      (fields: FieldDefinition[]) => {
        onChange?.(fields);
      },
      [onChange],
    );

    const handleAdd = useCallback(() => {
      if (disabled || effectiveFields.length >= maxFields) return;
      const newField: FieldDefinition = {
        id: nextFieldId(),
        name: '',
        type: 'text',
        required: false,
      };
      send({ type: 'ADD_FIELD' });
      emitChange([...effectiveFields, newField]);
    }, [disabled, effectiveFields, maxFields, emitChange]);

    const handleRemove = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'REMOVE_FIELD', id });
        emitChange(effectiveFields.filter((f) => f.id !== id));
      },
      [disabled, effectiveFields, emitChange],
    );

    const handleNameChange = useCallback(
      (id: string, name: string) => {
        send({ type: 'NAME_CHANGE', id, name });
        emitChange(effectiveFields.map((f) => (f.id === id ? { ...f, name } : f)));
      },
      [effectiveFields, emitChange],
    );

    const handleTypeChange = useCallback(
      (id: string, fieldType: FieldType) => {
        send({ type: 'TYPE_CHANGE', id, fieldType });
        emitChange(
          effectiveFields.map((f) =>
            f.id === id ? { ...f, type: fieldType, config: {}, options: undefined } : f,
          ),
        );
      },
      [effectiveFields, emitChange],
    );

    const handleMoveUp = useCallback(
      (id: string) => {
        if (disabled) return;
        const idx = effectiveFields.findIndex((f) => f.id === id);
        if (idx <= 0) return;
        const next = [...effectiveFields];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        send({ type: 'MOVE_UP', id });
        emitChange(next);
      },
      [disabled, effectiveFields, emitChange],
    );

    const handleMoveDown = useCallback(
      (id: string) => {
        if (disabled) return;
        const idx = effectiveFields.findIndex((f) => f.id === id);
        if (idx < 0 || idx >= effectiveFields.length - 1) return;
        const next = [...effectiveFields];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        send({ type: 'MOVE_DOWN', id });
        emitChange(next);
      },
      [disabled, effectiveFields, emitChange],
    );

    const isExpanded = (id: string) => state.expandedFieldId === id;
    const isDuplicateName = (field: FieldDefinition) =>
      effectiveFields.some((f) => f.id !== field.id && f.name === field.name && f.name !== '');

    return (
      <div
        ref={ref}
        role="list"
        aria-label="Schema editor"
        data-surface-widget=""
        data-widget-name="schema-editor"
        data-part="root"
        data-state={effectiveFields.length === 0 ? 'empty' : 'has-fields'}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        <div data-part="field-list" data-count={effectiveFields.length}>
          {effectiveFields.map((field) => (
            <div
              key={field.id}
              role="listitem"
              aria-label={`Field: ${field.name || 'Unnamed'}`}
              aria-expanded={isExpanded(field.id) ? 'true' : 'false'}
              data-part="field-row"
              data-type={field.type}
              data-state={isExpanded(field.id) ? 'expanded' : 'collapsed'}
              data-dragging={state.draggingFieldId === field.id ? 'true' : 'false'}
              data-valid={isDuplicateName(field) ? 'false' : 'true'}
            >
              {reorderable && (
                <button
                  type="button"
                  data-part="drag-handle"
                  role="button"
                  aria-roledescription="sortable"
                  aria-label={`Reorder field ${field.name}`}
                  hidden={!reorderable}
                  disabled={disabled}
                  tabIndex={0}
                  onPointerDown={() => send({ type: 'DRAG_START', id: field.id })}
                  onPointerUp={() => send({ type: 'DRAG_END' })}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') handleMoveUp(field.id);
                    if (e.key === 'ArrowDown') handleMoveDown(field.id);
                  }}
                >
                  &#x2630;
                </button>
              )}

              <span data-part="field-icon" data-type={field.type} aria-hidden="true" />

              <input
                type="text"
                data-part="field-name"
                value={field.name}
                placeholder="Field name"
                disabled={disabled}
                aria-label="Field name"
                onChange={(e) => handleNameChange(field.id, e.target.value)}
              />

              <select
                data-part="type-selector"
                value={field.type}
                disabled={disabled}
                aria-label="Field type"
                onChange={(e) => handleTypeChange(field.id, e.target.value as FieldType)}
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {field.required && (
                <span data-part="required-badge" aria-label="Required field">
                  Required
                </span>
              )}

              <button
                type="button"
                data-part="expand-button"
                aria-label={isExpanded(field.id) ? 'Collapse configuration' : 'Expand configuration'}
                onClick={() =>
                  send({
                    type: isExpanded(field.id) ? 'COLLAPSE_CONFIG' : 'EXPAND_CONFIG',
                    id: field.id,
                  } as SchemaEditorEvent)
                }
              >
                {isExpanded(field.id) ? '\u25B2' : '\u25BC'}
              </button>

              <button
                type="button"
                data-part="remove-button"
                aria-label={`Remove field ${field.name}`}
                disabled={disabled}
                onClick={() => handleRemove(field.id)}
              >
                Remove
              </button>

              {isExpanded(field.id) && (
                <div
                  role="region"
                  aria-label={`Configuration for ${field.name}`}
                  data-part="config-panel"
                  data-state="expanded"
                  data-type={field.type}
                >
                  <div data-part="config-option" data-option="required">
                    <label>
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={disabled}
                        onChange={() => {
                          send({ type: 'TOGGLE_REQUIRED', id: field.id });
                          emitChange(
                            effectiveFields.map((f) =>
                              f.id === field.id ? { ...f, required: !f.required } : f,
                            ),
                          );
                        }}
                      />
                      Required
                    </label>
                  </div>

                  <div data-part="config-option" data-option="defaultValue">
                    <span id={`config-label-${field.id}-default`}>Default value</span>
                    <input
                      type="text"
                      aria-labelledby={`config-label-${field.id}-default`}
                      data-part="config-value"
                      value={field.defaultValue ?? ''}
                      placeholder="Default value"
                      disabled={disabled}
                      onChange={(e) => {
                        const updated = effectiveFields.map((f) =>
                          f.id === field.id ? { ...f, defaultValue: e.target.value } : f,
                        );
                        emitChange(updated);
                      }}
                    />
                  </div>

                  {renderConfigPanel?.(field, (config) => {
                    send({ type: 'UPDATE_CONFIG', id: field.id, config });
                    emitChange(
                      effectiveFields.map((f) =>
                        f.id === field.id ? { ...f, config } : f,
                      ),
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          data-part="add-field-button"
          aria-label="Add field"
          disabled={disabled || effectiveFields.length >= maxFields}
          onClick={handleAdd}
        >
          Add field
        </button>

        {children}
      </div>
    );
  },
);

SchemaEditor.displayName = 'SchemaEditor';
export default SchemaEditor;
