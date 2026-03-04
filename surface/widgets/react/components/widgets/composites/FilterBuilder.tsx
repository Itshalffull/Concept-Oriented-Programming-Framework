/* ---------------------------------------------------------------------------
 * FilterBuilder reducer — extracted state machine
 * States: filterCount (empty | hasFilters), row (idle | editing), validity
 * ------------------------------------------------------------------------- */

export interface FilterRow {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: 'and' | 'or';
}

export interface FilterBuilderState {
  filterCount: 'empty' | 'hasFilters';
  editingRowId: string | null;
  filters: FilterRow[];
  logic: 'and' | 'or';
}

export type FilterBuilderEvent =
  | { type: 'ADD_FILTER' }
  | { type: 'REMOVE_FILTER'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; id: string; field: string }
  | { type: 'OPERATOR_CHANGE'; id: string; operator: string }
  | { type: 'VALUE_CHANGE'; id: string; value: string }
  | { type: 'TOGGLE_LOGIC'; id: string }
  | { type: 'FOCUS_ROW'; id: string }
  | { type: 'BLUR_ROW' }
  | { type: 'TOGGLE_ROOT_LOGIC' };

let filterCounter = 0;
export function nextFilterId() {
  return `filter-${++filterCounter}`;
}

export function resetFilterCounter() {
  filterCounter = 0;
}

export function filterBuilderReducer(
  state: FilterBuilderState,
  event: FilterBuilderEvent,
): FilterBuilderState {
  switch (event.type) {
    case 'ADD_FILTER': {
      const newFilter: FilterRow = {
        id: nextFilterId(),
        field: '',
        operator: '',
        value: '',
        logic: state.logic,
      };
      const filters = [...state.filters, newFilter];
      return { ...state, filters, filterCount: 'hasFilters' };
    }
    case 'REMOVE_FILTER': {
      const filters = state.filters.filter((f) => f.id !== event.id);
      return {
        ...state,
        filters,
        filterCount: filters.length === 0 ? 'empty' : 'hasFilters',
        editingRowId: state.editingRowId === event.id ? null : state.editingRowId,
      };
    }
    case 'CLEAR_ALL':
      return { ...state, filters: [], filterCount: 'empty', editingRowId: null };
    case 'FIELD_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, field: event.field, operator: '', value: '' } : f,
      );
      return { ...state, filters };
    }
    case 'OPERATOR_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, operator: event.operator, value: '' } : f,
      );
      return { ...state, filters };
    }
    case 'VALUE_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, value: event.value } : f,
      );
      return { ...state, filters };
    }
    case 'TOGGLE_LOGIC': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, logic: f.logic === 'and' ? 'or' : 'and' } : f,
      );
      return { ...state, filters };
    }
    case 'TOGGLE_ROOT_LOGIC':
      return { ...state, logic: state.logic === 'and' ? 'or' : 'and' };
    case 'FOCUS_ROW':
      return { ...state, editingRowId: event.id };
    case 'BLUR_ROW':
      return { ...state, editingRowId: null };
    default:
      return state;
  }
}


import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { filterBuilderReducer, nextFilterId } from './FilterBuilder.reducer.js';
import type { FilterRow } from './FilterBuilder.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from filter-builder.widget spec props
 * ------------------------------------------------------------------------- */

export type { FilterRow };

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[];
}

export interface OperatorDef {
  key: string;
  label: string;
  fieldTypes?: string[];
}

export interface FilterGroup {
  id: string;
  logic: 'and' | 'or';
  filters: (FilterRow | FilterGroup)[];
  depth: number;
}

export interface FilterBuilderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  filters?: FilterRow[];
  logic?: 'and' | 'or';
  fields: FieldDef[];
  operators: OperatorDef[];
  maxDepth?: number;
  maxFilters?: number;
  disabled?: boolean;
  allowGroups?: boolean;
  onChange?: (filters: FilterRow[], logic: 'and' | 'or') => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const FilterBuilder = forwardRef<HTMLDivElement, FilterBuilderProps>(
  function FilterBuilder(
    {
      filters: controlledFilters,
      logic: controlledLogic = 'and',
      fields,
      operators,
      maxDepth = 3,
      maxFilters = 20,
      disabled = false,
      allowGroups = true,
      onChange,
      children,
      ...rest
    },
    ref,
  ) {
    const initialState: FilterBuilderState = {
      filterCount: (controlledFilters?.length ?? 0) > 0 ? 'hasFilters' : 'empty',
      editingRowId: null,
      filters: controlledFilters ?? [],
      logic: controlledLogic,
    };

    const [state, send] = useReducer(filterBuilderReducer, initialState);
    const uid = useId();

    const effectiveFilters = controlledFilters ?? state.filters;
    const effectiveLogic = controlledLogic ?? state.logic;

    const handleAdd = useCallback(() => {
      if (disabled || effectiveFilters.length >= maxFilters) return;
      send({ type: 'ADD_FILTER' });
      onChange?.(
        [...effectiveFilters, { id: nextFilterId(), field: '', operator: '', value: '', logic: effectiveLogic }],
        effectiveLogic,
      );
    }, [disabled, effectiveFilters, maxFilters, onChange, effectiveLogic]);

    const handleRemove = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'REMOVE_FILTER', id });
        const next = effectiveFilters.filter((f) => f.id !== id);
        onChange?.(next, effectiveLogic);
      },
      [disabled, effectiveFilters, onChange, effectiveLogic],
    );

    const handleFieldChange = useCallback(
      (id: string, field: string) => {
        send({ type: 'FIELD_CHANGE', id, field });
        const next = effectiveFilters.map((f) =>
          f.id === id ? { ...f, field, operator: '', value: '' } : f,
        );
        onChange?.(next, effectiveLogic);
      },
      [effectiveFilters, onChange, effectiveLogic],
    );

    const handleOperatorChange = useCallback(
      (id: string, operator: string) => {
        send({ type: 'OPERATOR_CHANGE', id, operator });
        const next = effectiveFilters.map((f) =>
          f.id === id ? { ...f, operator, value: '' } : f,
        );
        onChange?.(next, effectiveLogic);
      },
      [effectiveFilters, onChange, effectiveLogic],
    );

    const handleValueChange = useCallback(
      (id: string, value: string) => {
        send({ type: 'VALUE_CHANGE', id, value });
        const next = effectiveFilters.map((f) =>
          f.id === id ? { ...f, value } : f,
        );
        onChange?.(next, effectiveLogic);
      },
      [effectiveFilters, onChange, effectiveLogic],
    );

    const handleToggleLogic = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'TOGGLE_LOGIC', id });
        const next = effectiveFilters.map((f) =>
          f.id === id ? { ...f, logic: f.logic === 'and' ? 'or' : 'and' } : f,
        );
        onChange?.(next, effectiveLogic);
      },
      [disabled, effectiveFilters, onChange, effectiveLogic],
    );

    const operatorsForField = (fieldKey: string) =>
      operators.filter(
        (op) => !op.fieldTypes || op.fieldTypes.includes(fields.find((f) => f.key === fieldKey)?.type ?? ''),
      );

    const isRowValid = (row: FilterRow) => Boolean(row.field && row.operator && row.value);

    return (
      <div
        ref={ref}
        role="group"
        aria-label="Filter builder"
        data-surface-widget=""
        data-widget-name="filter-builder"
        data-part="root"
        data-state={effectiveFilters.length === 0 ? 'empty' : 'has-filters'}
        data-logic={effectiveLogic}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        {effectiveFilters.map((filter, index) => (
          <div key={filter.id}>
            {index > 0 && (
              <button
                type="button"
                data-part="logic-toggle"
                data-logic={filter.logic ?? effectiveLogic}
                role="button"
                aria-label="Toggle logic operator"
                aria-pressed={
                  (filter.logic ?? effectiveLogic) === 'or' ? 'true' : 'false'
                }
                disabled={disabled}
                onClick={() => handleToggleLogic(filter.id)}
              >
                {(filter.logic ?? effectiveLogic).toUpperCase()}
              </button>
            )}
            <div
              data-part="filter-row"
              role="group"
              aria-label="Filter row"
              data-state={state.editingRowId === filter.id ? 'editing' : 'idle'}
              data-valid={isRowValid(filter) ? 'true' : 'false'}
            >
              <select
                data-part="field-selector"
                value={filter.field}
                disabled={disabled}
                aria-label="Filter field"
                onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                onFocus={() => send({ type: 'FOCUS_ROW', id: filter.id })}
                onBlur={() => send({ type: 'BLUR_ROW' })}
              >
                <option value="">Select field...</option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                data-part="operator-selector"
                value={filter.operator}
                disabled={disabled || !filter.field}
                aria-label="Filter operator"
                onChange={(e) => handleOperatorChange(filter.id, e.target.value)}
                onFocus={() => send({ type: 'FOCUS_ROW', id: filter.id })}
                onBlur={() => send({ type: 'BLUR_ROW' })}
              >
                <option value="">Select operator...</option>
                {operatorsForField(filter.field).map((op) => (
                  <option key={op.key} value={op.key}>
                    {op.label}
                  </option>
                ))}
              </select>

              <input
                data-part="value-input"
                type="text"
                value={filter.value}
                disabled={disabled || !filter.operator}
                aria-label="Filter value"
                placeholder="Enter value..."
                onChange={(e) => handleValueChange(filter.id, e.target.value)}
                onFocus={() => send({ type: 'FOCUS_ROW', id: filter.id })}
                onBlur={() => send({ type: 'BLUR_ROW' })}
              />

              <button
                type="button"
                data-part="remove-button"
                aria-label="Remove filter"
                disabled={disabled}
                onClick={() => handleRemove(filter.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          data-part="add-button"
          aria-label="Add filter"
          disabled={disabled || effectiveFilters.length >= maxFilters}
          onClick={handleAdd}
        >
          Add filter
        </button>

        {children}
      </div>
    );
  },
);

FilterBuilder.displayName = 'FilterBuilder';
export default FilterBuilder;
