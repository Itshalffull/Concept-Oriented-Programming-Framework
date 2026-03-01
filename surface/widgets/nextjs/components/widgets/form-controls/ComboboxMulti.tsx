'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useState,
  useEffect,
  useId,
  useMemo,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { openCloseReducer, filterReducer, type OpenCloseState, type OpenCloseAction, type FilterState, type FilterAction } from './ComboboxMulti.reducer.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OptionItem {
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ComboboxMultiProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
  /** Current input/filter value */
  inputValue?: string;
  /** Available options */
  options: OptionItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Maximum number of selections */
  maxSelections?: number;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Input change callback */
  onInputChange?: (inputValue: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ComboboxMulti = forwardRef<HTMLDivElement, ComboboxMultiProps>(
  function ComboboxMulti(
    {
      values: valuesProp,
      defaultValues = [],
      inputValue: inputValueProp,
      options,
      placeholder = 'Search...',
      label,
      disabled = false,
      required = false,
      name,
      maxSelections,
      onChange,
      onInputChange,
      size = 'md',
      className,
      ...rest
    },
    ref,
  ) {
    const uid = useId();
    const labelId = `${uid}-label`;
    const contentId = `${uid}-content`;
    const inputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const [values, setValues] = useControllableState({
      value: valuesProp,
      defaultValue: defaultValues,
      onChange,
    });

    const [localInputValue, setLocalInputValue] = useState(inputValueProp ?? '');
    const inputValue = inputValueProp ?? localInputValue;

    const [openState, dispatchOpen] = useReducer(openCloseReducer, 'closed');
    const [_filterState, dispatchFilter] = useReducer(filterReducer, 'idle');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const isOpen = openState === 'open';

    const filteredOptions = useMemo(
      () =>
        options.filter((o) =>
          o.label.toLowerCase().includes(inputValue.toLowerCase()),
        ),
      [options, inputValue],
    );

    // Close on outside click
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          dispatchOpen({ type: 'BLUR' });
          dispatchFilter({ type: 'END_FILTER' });
          setLocalInputValue('');
          onInputChange?.('');
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onInputChange]);

    const toggleValue = useCallback(
      (optionValue: string) => {
        const isSelected = values.includes(optionValue);
        if (isSelected) {
          setValues(values.filter((v) => v !== optionValue));
        } else {
          if (maxSelections !== undefined && values.length >= maxSelections) return;
          setValues([...values, optionValue]);
        }
        setLocalInputValue('');
        onInputChange?.('');
        inputRef.current?.focus();
      },
      [values, maxSelections, setValues, onInputChange],
    );

    const removeValue = useCallback(
      (optionValue: string) => {
        setValues(values.filter((v) => v !== optionValue));
      },
      [values, setValues],
    );

    const removeLast = useCallback(() => {
      if (values.length > 0) {
        setValues(values.slice(0, -1));
      }
    }, [values, setValues]);

    const getLabelForValue = useCallback(
      (val: string) => options.find((o) => o.value === val)?.label ?? val,
      [options],
    );

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setLocalInputValue(next);
        onInputChange?.(next);
        dispatchOpen({ type: 'INPUT' });
        dispatchFilter({ type: 'BEGIN_FILTER' });
        setHighlightedIndex(0);
      },
      [onInputChange],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            if (!isOpen) {
              dispatchOpen({ type: 'OPEN' });
              dispatchFilter({ type: 'BEGIN_FILTER' });
            }
            setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev <= 0 ? filteredOptions.length - 1 : prev - 1,
            );
            break;
          case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
              toggleValue(filteredOptions[highlightedIndex].value);
            }
            break;
          case 'Escape':
            e.preventDefault();
            dispatchOpen({ type: 'CLOSE' });
            dispatchFilter({ type: 'END_FILTER' });
            setLocalInputValue('');
            onInputChange?.('');
            break;
          case 'Backspace':
            if (inputValue === '') {
              removeLast();
            }
            break;
          case 'Home':
            if (isOpen) {
              e.preventDefault();
              setHighlightedIndex(0);
            }
            break;
          case 'End':
            if (isOpen) {
              e.preventDefault();
              setHighlightedIndex(filteredOptions.length - 1);
            }
            break;
        }
      },
      [isOpen, filteredOptions, highlightedIndex, toggleValue, inputValue, removeLast, onInputChange],
    );

    const setRefCallback = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    return (
      <div
        ref={setRefCallback}
        data-surface-widget=""
        data-widget-name="combobox-multi"
        data-part="root"
        data-state={isOpen ? 'open' : 'closed'}
        data-disabled={disabled ? 'true' : 'false'}
        data-size={size}
        className={className}
        {...rest}
      >
        <label data-part="label" id={labelId} htmlFor={uid}>
          {label}
        </label>

        <div
          data-part="inputWrapper"
          data-state={isOpen ? 'open' : 'closed'}
          data-focus={isOpen ? 'true' : 'false'}
          onClick={() => {
            if (!disabled) {
              dispatchOpen({ type: 'OPEN' });
              inputRef.current?.focus();
            }
          }}
        >
          {values.length > 0 && (
            <div data-part="chipList" role="list" aria-label="Selected values" aria-live="polite">
              {values.map((val) => (
                <span
                  key={val}
                  data-part="chip"
                  data-value={val}
                  role="listitem"
                  aria-label={`Remove ${getLabelForValue(val)}`}
                >
                  {getLabelForValue(val)}
                  <button
                    type="button"
                    aria-label={`Remove ${getLabelForValue(val)}`}
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(val);
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={inputRef}
            id={uid}
            data-part="input"
            type="text"
            role="combobox"
            value={inputValue}
            placeholder={values.length === 0 ? placeholder : ''}
            disabled={disabled}
            required={required}
            name={name}
            aria-label={label}
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-haspopup="listbox"
            aria-controls={contentId}
            aria-activedescendant={
              isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]
                ? `${uid}-opt-${filteredOptions[highlightedIndex].value}`
                : undefined
            }
            aria-autocomplete="list"
            aria-multiselectable="true"
            aria-disabled={disabled ? 'true' : 'false'}
            aria-required={required ? 'true' : 'false'}
            aria-labelledby={labelId}
            autoComplete="off"
            onChange={handleInputChange}
            onFocus={() => {
              dispatchOpen({ type: 'OPEN' });
              dispatchFilter({ type: 'BEGIN_FILTER' });
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {isOpen && (
          <div data-part="positioner">
            <div
              id={contentId}
              data-part="content"
              role="listbox"
              aria-labelledby={labelId}
              aria-multiselectable="true"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isSelected = values.includes(option.value);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={option.value}
                      id={`${uid}-opt-${option.value}`}
                      data-part="item"
                      data-state={isSelected ? 'selected' : 'unselected'}
                      data-highlighted={isHighlighted ? 'true' : 'false'}
                      role="option"
                      aria-selected={isSelected ? 'true' : 'false'}
                      aria-label={option.label}
                      onClick={() => toggleValue(option.value)}
                      onPointerEnter={() => setHighlightedIndex(index)}
                    >
                      <span data-part="itemLabel">{option.label}</span>
                    </div>
                  );
                })
              ) : (
                <div data-part="empty" role="status" aria-live="polite">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}

        {name &&
          values.map((val) => (
            <input key={val} type="hidden" name={`${name}[]`} value={val} />
          ))}
      </div>
    );
  },
);

ComboboxMulti.displayName = 'ComboboxMulti';
export default ComboboxMulti;
