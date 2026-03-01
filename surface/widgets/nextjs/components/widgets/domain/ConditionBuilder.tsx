'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cbReducer } from './ConditionBuilder.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ConditionRow {
  field?: string;
  operator?: string;
  value?: string;
}

export interface FieldDef {
  name: string;
  type: string;
  operators: string[];
}

export interface ConditionBuilderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Condition rows. */
  conditions: ConditionRow[];
  /** Available fields. */
  fields: FieldDef[];
  /** Logic combinator. */
  logic?: 'and' | 'or';
  /** Accessible label. */
  ariaLabel?: string;
  /** Max rows. */
  maxRows?: number;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Allow nested groups. */
  allowGroups?: boolean;
  /** Called on conditions change. */
  onConditionsChange?: (conditions: ConditionRow[]) => void;
  /** Called on logic change. */
  onLogicChange?: (logic: 'and' | 'or') => void;
  /** Custom field selector renderer. */
  renderFieldSelector?: (index: number, field?: string) => ReactNode;
  /** Custom operator selector renderer. */
  renderOperatorSelector?: (index: number, field?: string, operator?: string) => ReactNode;
  /** Custom value input renderer. */
  renderValueInput?: (index: number, field?: string, operator?: string, value?: string) => ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ConditionBuilder = forwardRef<HTMLDivElement, ConditionBuilderProps>(
  function ConditionBuilder(
    {
      conditions,
      fields,
      logic = 'and',
      ariaLabel = 'Condition Builder',
      maxRows = 20,
      readOnly = false,
      allowGroups = false,
      onConditionsChange,
      onLogicChange,
      renderFieldSelector,
      renderOperatorSelector,
      renderValueInput,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(cbReducer, { current: 'idle' });

    const handleAddRow = useCallback(() => {
      if (conditions.length >= maxRows) return;
      onConditionsChange?.([...conditions, {}]);
      send({ type: 'ADD_ROW' });
    }, [conditions, maxRows, onConditionsChange]);

    const handleRemoveRow = useCallback(
      (index: number) => {
        if (conditions.length <= 1) return;
        const next = conditions.filter((_, i) => i !== index);
        onConditionsChange?.(next);
        send({ type: 'REMOVE_ROW', index });
      },
      [conditions, onConditionsChange],
    );

    const handleToggleLogic = useCallback(() => {
      onLogicChange?.(logic === 'and' ? 'or' : 'and');
      send({ type: 'TOGGLE_LOGIC' });
    }, [logic, onLogicChange]);

    const getFieldDef = useCallback(
      (name?: string) => fields.find((f) => f.name === name),
      [fields],
    );

    return (
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        aria-roledescription="condition builder"
        data-surface-widget=""
        data-widget-name="condition-builder"
        data-state={state.current}
        data-logic={logic}
        data-row-count={conditions.length}
        data-readonly={readOnly ? 'true' : 'false'}
        {...rest}
      >
        <div role="list" aria-label="Conditions" data-part="rows">
          {conditions.map((row, index) => {
            const isComplete = !!(row.field && row.operator && row.value);
            const fieldDef = getFieldDef(row.field);
            return (
              <div key={index}>
                {index > 0 && (
                  <button
                    type="button"
                    role="button"
                    aria-label={`Logic: ${logic}. Click to toggle.`}
                    aria-pressed={logic === 'or'}
                    data-part="logic-toggle"
                    data-logic={logic}
                    data-visible="true"
                    onClick={handleToggleLogic}
                  >
                    {logic.toUpperCase()}
                  </button>
                )}
                <div
                  role="listitem"
                  aria-label={`Condition ${index}: ${row.field ?? ''} ${row.operator ?? ''} ${row.value ?? ''}`}
                  data-row-index={index}
                  data-complete={isComplete ? 'true' : 'false'}
                  data-part="row"
                >
                  <div data-part="field-selector" data-row-index={index} aria-label={`Field for condition ${index}`}>
                    {renderFieldSelector ? renderFieldSelector(index, row.field) : (
                      <select
                        value={row.field ?? ''}
                        aria-label={`Field for condition ${index}`}
                        onChange={(e) => {
                          const next = [...conditions];
                          next[index] = { field: e.target.value, operator: undefined, value: undefined };
                          onConditionsChange?.(next);
                          send({ type: 'CHANGE_FIELD' });
                        }}
                      >
                        <option value="">Select field...</option>
                        {fields.map((f) => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div data-part="operator-selector" data-row-index={index} data-field-type={fieldDef?.type} aria-label={`Operator for condition ${index}`}>
                    {renderOperatorSelector ? renderOperatorSelector(index, row.field, row.operator) : (
                      <select
                        value={row.operator ?? ''}
                        aria-label={`Operator for condition ${index}`}
                        disabled={!row.field}
                        onChange={(e) => {
                          const next = [...conditions];
                          next[index] = { ...next[index], operator: e.target.value };
                          onConditionsChange?.(next);
                          send({ type: 'CHANGE_OPERATOR' });
                        }}
                      >
                        <option value="">Operator...</option>
                        {(fieldDef?.operators ?? []).map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div data-part="value-input" data-row-index={index} data-field-type={fieldDef?.type} data-operator={row.operator} aria-label={`Value for condition ${index}`}>
                    {renderValueInput ? renderValueInput(index, row.field, row.operator, row.value) : (
                      <input
                        type="text"
                        value={row.value ?? ''}
                        placeholder="Value..."
                        aria-label={`Value for condition ${index}`}
                        disabled={!row.operator}
                        onChange={(e) => {
                          const next = [...conditions];
                          next[index] = { ...next[index], value: e.target.value };
                          onConditionsChange?.(next);
                          send({ type: 'CHANGE_VALUE' });
                        }}
                      />
                    )}
                  </div>

                  {!readOnly && conditions.length > 1 && (
                    <button
                      type="button"
                      role="button"
                      aria-label={`Remove condition ${index}`}
                      data-part="remove"
                      data-visible="true"
                      onClick={() => handleRemoveRow(index)}
                    >
                      &#x2715;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!readOnly && conditions.length < maxRows && (
          <button
            type="button"
            role="button"
            aria-label="Add condition"
            data-part="add"
            data-visible="true"
            onClick={handleAddRow}
          >
            Add condition
          </button>
        )}
      </div>
    );
  },
);

ConditionBuilder.displayName = 'ConditionBuilder';
export { ConditionBuilder };
export default ConditionBuilder;
