'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { pickerReducer } from './ColorLabelPicker.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface LabelDef {
  name: string;
  color: string;
}

export interface ColorLabelPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Available labels. */
  labels: LabelDef[];
  /** Currently selected label names. */
  selectedLabels?: string[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Allow multiple selections. */
  multiSelect?: boolean;
  /** Allow creating new labels. */
  allowCreate?: boolean;
  /** Maximum number of selections. */
  maxSelected?: number;
  /** Whether read-only. */
  readOnly?: boolean;
  /** Called when selection changes. */
  onSelectionChange?: (selected: string[]) => void;
  /** Called when a new label is created. */
  onCreate?: (name: string) => void;
  /** Trigger content. */
  trigger?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ColorLabelPicker = forwardRef<HTMLDivElement, ColorLabelPickerProps>(
  function ColorLabelPicker(
    {
      labels,
      selectedLabels: controlledSelected = [],
      ariaLabel = 'Labels',
      multiSelect = true,
      allowCreate = false,
      maxSelected,
      readOnly = false,
      onSelectionChange,
      onCreate,
      trigger,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(pickerReducer, 'closed');
    const [filterValue, setFilterValue] = useState('');
    const [selected, setSelected] = useState<string[]>(controlledSelected);
    const searchRef = useRef<HTMLInputElement>(null);
    const isOpen = state === 'open' || state === 'empty';

    useEffect(() => {
      setSelected(controlledSelected);
    }, [controlledSelected]);

    useEffect(() => {
      if (isOpen && searchRef.current) {
        searchRef.current.focus();
      }
    }, [isOpen]);

    const filtered = labels.filter((l) =>
      l.name.toLowerCase().includes(filterValue.toLowerCase()),
    );

    const toggleLabel = useCallback(
      (name: string) => {
        setSelected((prev) => {
          const isSelected = prev.includes(name);
          let next: string[];
          if (isSelected) {
            next = prev.filter((n) => n !== name);
            send({ type: 'DESELECT', name });
          } else {
            if (maxSelected && prev.length >= maxSelected) return prev;
            next = multiSelect ? [...prev, name] : [name];
            send({ type: 'SELECT', name });
          }
          onSelectionChange?.(next);
          if (!multiSelect && !isSelected) {
            send({ type: 'CLOSE' });
          }
          return next;
        });
      },
      [multiSelect, maxSelected, onSelectionChange],
    );

    const handleFilter = useCallback(
      (value: string) => {
        setFilterValue(value);
        const matches = labels.filter((l) =>
          l.name.toLowerCase().includes(value.toLowerCase()),
        );
        if (matches.length === 0) {
          send({ type: 'FILTER_EMPTY' });
        } else {
          send({ type: 'FILTER', value });
        }
      },
      [labels],
    );

    const handleCreate = useCallback(() => {
      if (!filterValue.trim()) return;
      onCreate?.(filterValue.trim());
      send({ type: 'CREATE', name: filterValue.trim() });
      setFilterValue('');
    }, [filterValue, onCreate]);

    const handleSearchKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') { e.preventDefault(); send({ type: 'ESCAPE' }); setFilterValue(''); }
        if (e.key === 'Enter' && state === 'empty' && allowCreate) { e.preventDefault(); handleCreate(); }
      },
      [state, allowCreate, handleCreate],
    );

    return (
      <div
        ref={ref}
        data-surface-widget=""
        data-widget-name="color-label-picker"
        data-part="color-label-picker"
        data-state={isOpen ? 'open' : 'closed'}
        data-readonly={readOnly ? 'true' : 'false'}
        {...rest}
      >
        <button
          type="button"
          role="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          data-part="trigger"
          data-selected-count={selected.length}
          onClick={() => !readOnly && send({ type: 'OPEN' })}
        >
          {trigger ?? `${ariaLabel} (${selected.length})`}
        </button>

        {isOpen && (
          <div data-part="panel" role="dialog" aria-label="Label picker" data-state={state}>
            <input
              ref={searchRef}
              type="text"
              data-part="search"
              aria-label="Filter labels"
              value={filterValue}
              placeholder="Filter labels..."
              onChange={(e) => handleFilter(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />

            <div
              role="listbox"
              aria-label="Available labels"
              aria-multiselectable={multiSelect || undefined}
              data-part="options"
              data-count={filtered.length}
            >
              {filtered.map((label) => {
                const isSelected = selected.includes(label.name);
                return (
                  <div
                    key={label.name}
                    role="option"
                    aria-selected={isSelected}
                    data-part="option"
                    data-label={label.name}
                    data-color={label.color}
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={() => toggleLabel(label.name)}
                  >
                    <span
                      data-part="color-swatch"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    <span data-part="option-label">{label.name}</span>
                  </div>
                );
              })}
            </div>

            {allowCreate && filtered.length === 0 && filterValue && (
              <button
                type="button"
                role="button"
                aria-label={`Create label: ${filterValue}`}
                data-part="create"
                data-visible="true"
                onClick={handleCreate}
              >
                Create &quot;{filterValue}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

ColorLabelPicker.displayName = 'ColorLabelPicker';
export { ColorLabelPicker };
export default ColorLabelPicker;
