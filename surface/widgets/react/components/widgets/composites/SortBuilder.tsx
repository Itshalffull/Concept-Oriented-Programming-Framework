/* ---------------------------------------------------------------------------
 * SortBuilder reducer — extracted state machine
 * States: sortCount (empty | hasSorts), drag (idle | dragging)
 * ------------------------------------------------------------------------- */

export interface SortCriterion {
  id: string;
  field: string;
  direction: 'ascending' | 'descending';
}

export interface SortBuilderState {
  sortCount: 'empty' | 'hasSorts';
  draggingId: string | null;
  sorts: SortCriterion[];
}

export type SortBuilderEvent =
  | { type: 'ADD_SORT' }
  | { type: 'REMOVE_SORT'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; id: string; field: string }
  | { type: 'TOGGLE_DIRECTION'; id: string }
  | { type: 'MOVE_UP'; id: string }
  | { type: 'MOVE_DOWN'; id: string }
  | { type: 'DRAG_START'; id: string }
  | { type: 'DRAG_END' };

let sortCounter = 0;
export function nextSortId() {
  return `sort-${++sortCounter}`;
}

export function resetSortCounter() {
  sortCounter = 0;
}

export function sortBuilderReducer(
  state: SortBuilderState,
  event: SortBuilderEvent,
): SortBuilderState {
  switch (event.type) {
    case 'ADD_SORT': {
      const newSort: SortCriterion = {
        id: nextSortId(),
        field: '',
        direction: 'ascending',
      };
      const sorts = [...state.sorts, newSort];
      return { ...state, sorts, sortCount: 'hasSorts' };
    }
    case 'REMOVE_SORT': {
      const sorts = state.sorts.filter((s) => s.id !== event.id);
      return { ...state, sorts, sortCount: sorts.length === 0 ? 'empty' : 'hasSorts' };
    }
    case 'CLEAR_ALL':
      return { ...state, sorts: [], sortCount: 'empty', draggingId: null };
    case 'FIELD_CHANGE': {
      const sorts = state.sorts.map((s) =>
        s.id === event.id ? { ...s, field: event.field } : s,
      );
      return { ...state, sorts };
    }
    case 'TOGGLE_DIRECTION': {
      const sorts = state.sorts.map((s) =>
        s.id === event.id
          ? { ...s, direction: s.direction === 'ascending' ? 'descending' as const : 'ascending' as const }
          : s,
      );
      return { ...state, sorts };
    }
    case 'MOVE_UP': {
      const idx = state.sorts.findIndex((s) => s.id === event.id);
      if (idx <= 0) return state;
      const sorts = [...state.sorts];
      [sorts[idx - 1], sorts[idx]] = [sorts[idx], sorts[idx - 1]];
      return { ...state, sorts };
    }
    case 'MOVE_DOWN': {
      const idx = state.sorts.findIndex((s) => s.id === event.id);
      if (idx < 0 || idx >= state.sorts.length - 1) return state;
      const sorts = [...state.sorts];
      [sorts[idx], sorts[idx + 1]] = [sorts[idx + 1], sorts[idx]];
      return { ...state, sorts };
    }
    case 'DRAG_START':
      return { ...state, draggingId: event.id };
    case 'DRAG_END':
      return { ...state, draggingId: null };
    default:
      return state;
  }
}

export function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';


/* ---------------------------------------------------------------------------
 * Types derived from sort-builder.widget spec props
 * ------------------------------------------------------------------------- */

export type { SortCriterion };

export interface SortFieldDef {
  key: string;
  label: string;
}

export interface SortBuilderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  sorts?: SortCriterion[];
  fields: SortFieldDef[];
  maxSorts?: number;
  disabled?: boolean;
  onChange?: (sorts: SortCriterion[]) => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const SortBuilder = forwardRef<HTMLDivElement, SortBuilderProps>(
  function SortBuilder(
    {
      sorts: controlledSorts,
      fields,
      maxSorts = 5,
      disabled = false,
      onChange,
      children,
      ...rest
    },
    ref,
  ) {
    const initialState: SortBuilderState = {
      sortCount: (controlledSorts?.length ?? 0) > 0 ? 'hasSorts' : 'empty',
      draggingId: null,
      sorts: controlledSorts ?? [],
    };

    const [state, send] = useReducer(sortBuilderReducer, initialState);
    const effectiveSorts = controlledSorts ?? state.sorts;

    const usedFields = new Set(effectiveSorts.map((s) => s.field));

    const handleAdd = useCallback(() => {
      if (disabled || effectiveSorts.length >= maxSorts) return;
      const newSort: SortCriterion = { id: nextSortId(), field: '', direction: 'ascending' };
      send({ type: 'ADD_SORT' });
      onChange?.([...effectiveSorts, newSort]);
    }, [disabled, effectiveSorts, maxSorts, onChange]);

    const handleRemove = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'REMOVE_SORT', id });
        onChange?.(effectiveSorts.filter((s) => s.id !== id));
      },
      [disabled, effectiveSorts, onChange],
    );

    const handleFieldChange = useCallback(
      (id: string, field: string) => {
        send({ type: 'FIELD_CHANGE', id, field });
        onChange?.(effectiveSorts.map((s) => (s.id === id ? { ...s, field } : s)));
      },
      [effectiveSorts, onChange],
    );

    const handleToggleDirection = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'TOGGLE_DIRECTION', id });
        onChange?.(
          effectiveSorts.map((s) =>
            s.id === id
              ? { ...s, direction: s.direction === 'ascending' ? 'descending' as const : 'ascending' as const }
              : s,
          ),
        );
      },
      [disabled, effectiveSorts, onChange],
    );

    const handleMoveUp = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'MOVE_UP', id });
        const idx = effectiveSorts.findIndex((s) => s.id === id);
        if (idx <= 0) return;
        const next = [...effectiveSorts];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        onChange?.(next);
      },
      [disabled, effectiveSorts, onChange],
    );

    const handleMoveDown = useCallback(
      (id: string) => {
        if (disabled) return;
        send({ type: 'MOVE_DOWN', id });
        const idx = effectiveSorts.findIndex((s) => s.id === id);
        if (idx < 0 || idx >= effectiveSorts.length - 1) return;
        const next = [...effectiveSorts];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        onChange?.(next);
      },
      [disabled, effectiveSorts, onChange],
    );

    const fieldLabel = (fieldKey: string) =>
      fields.find((f) => f.key === fieldKey)?.label ?? fieldKey;

    return (
      <div
        ref={ref}
        role="list"
        aria-label="Sort criteria"
        data-surface-widget=""
        data-widget-name="sort-builder"
        data-part="root"
        data-state={effectiveSorts.length === 0 ? 'empty' : 'has-sorts'}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        {effectiveSorts.length === 0 && (
          <div data-part="empty-state" aria-hidden="false">
            No sort criteria defined
          </div>
        )}

        {effectiveSorts.map((sort, index) => (
          <div
            key={sort.id}
            role="listitem"
            aria-label={`Sort by ${fieldLabel(sort.field)}`}
            data-part="sort-row"
            data-direction={sort.direction}
            data-dragging={state.draggingId === sort.id ? 'true' : 'false'}
            data-priority={index}
          >
            <span data-part="priority-label" aria-hidden="true">
              {index + 1}{ordinalSuffix(index + 1)}
            </span>

            <button
              type="button"
              data-part="drag-handle"
              role="button"
              aria-roledescription="sortable"
              aria-label={`Reorder sort criterion ${fieldLabel(sort.field)}`}
              tabIndex={0}
              disabled={disabled}
              data-dragging={state.draggingId === sort.id ? 'true' : 'false'}
              onPointerDown={() => send({ type: 'DRAG_START', id: sort.id })}
              onPointerUp={() => send({ type: 'DRAG_END' })}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') handleMoveUp(sort.id);
                if (e.key === 'ArrowDown') handleMoveDown(sort.id);
              }}
            >
              &#x2630;
            </button>

            <select
              data-part="field-selector"
              value={sort.field}
              disabled={disabled}
              aria-label="Sort field"
              onChange={(e) => handleFieldChange(sort.id, e.target.value)}
            >
              <option value="">Select field...</option>
              {fields
                .filter((f) => !usedFields.has(f.key) || f.key === sort.field)
                .map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
            </select>

            <button
              type="button"
              data-part="direction-toggle"
              role="button"
              aria-label={
                sort.direction === 'ascending'
                  ? 'Sort ascending, click to change to descending'
                  : 'Sort descending, click to change to ascending'
              }
              aria-pressed={sort.direction === 'descending' ? 'true' : 'false'}
              data-direction={sort.direction}
              disabled={disabled}
              onClick={() => handleToggleDirection(sort.id)}
            >
              {sort.direction === 'ascending' ? '\u2191' : '\u2193'}
            </button>

            <button
              type="button"
              data-part="remove-button"
              aria-label={`Remove sort by ${fieldLabel(sort.field)}`}
              disabled={disabled}
              onClick={() => handleRemove(sort.id)}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          data-part="add-button"
          aria-label="Add sort criterion"
          disabled={disabled || effectiveSorts.length >= maxSorts}
          onClick={handleAdd}
        >
          Add sort
        </button>

        {children}
      </div>
    );
  },
);

SortBuilder.displayName = 'SortBuilder';
export default SortBuilder;
