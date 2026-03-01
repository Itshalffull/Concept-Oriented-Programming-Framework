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
import { openCloseReducer, filterReducer, type OpenCloseState, type OpenCloseAction, type FilterState, type FilterAction } from './Combobox.reducer.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ComboboxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Current input value */
  inputValue?: string;
  /** Available options */
  options: OptionItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Allow creating custom values */
  allowCustom?: boolean;
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: string) => void;
  /** Input change callback */
  onInputChange?: (inputValue: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Combobox = forwardRef<HTMLDivElement, ComboboxProps>(function Combobox(
  {
    value: valueProp,
    defaultValue = '',
    inputValue: inputValueProp,
    options,
    placeholder = 'Search...',
    allowCustom = false,
    label,
    disabled = false,
    required = false,
    name,
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
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [localInputValue, setLocalInputValue] = useState(
    inputValueProp ?? options.find((o) => o.value === value)?.label ?? '',
  );
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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

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

  const handleSelect = useCallback(
    (optionValue: string) => {
      const opt = options.find((o) => o.value === optionValue);
      setValue(optionValue);
      setLocalInputValue(opt?.label ?? optionValue);
      onInputChange?.(opt?.label ?? optionValue);
      dispatchOpen({ type: 'SELECT' });
      dispatchFilter({ type: 'END_FILTER' });
      inputRef.current?.focus();
    },
    [options, setValue, onInputChange],
  );

  const handleClear = useCallback(() => {
    setValue('');
    setLocalInputValue('');
    onInputChange?.('');
    inputRef.current?.focus();
  }, [setValue, onInputChange]);

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
            handleSelect(filteredOptions[highlightedIndex].value);
          } else if (allowCustom && inputValue.trim()) {
            handleSelect(inputValue.trim());
          }
          break;
        case 'Escape':
          e.preventDefault();
          dispatchOpen({ type: 'CLOSE' });
          dispatchFilter({ type: 'END_FILTER' });
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
    [isOpen, filteredOptions, highlightedIndex, handleSelect, allowCustom, inputValue],
  );

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  return (
    <div
      ref={setRootRef}
      data-surface-widget=""
      data-widget-name="combobox"
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
      >
        <input
          ref={inputRef}
          id={uid}
          data-part="input"
          type="text"
          role="combobox"
          value={inputValue}
          placeholder={placeholder}
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

        <button
          type="button"
          data-part="trigger"
          data-state={isOpen ? 'open' : 'closed'}
          aria-label="Toggle options"
          aria-hidden="true"
          disabled={disabled}
          tabIndex={-1}
          onClick={() => {
            if (isOpen) {
              dispatchOpen({ type: 'CLOSE' });
              dispatchFilter({ type: 'END_FILTER' });
            } else {
              dispatchOpen({ type: 'OPEN' });
              dispatchFilter({ type: 'BEGIN_FILTER' });
              inputRef.current?.focus();
            }
          }}
        />

        {value && (
          <button
            type="button"
            data-part="clearButton"
            aria-label="Clear selection"
            tabIndex={-1}
            onClick={handleClear}
          >
            &times;
          </button>
        )}
      </div>

      {isOpen && (
        <div data-part="positioner">
          <div
            ref={contentRef}
            id={contentId}
            data-part="content"
            role="listbox"
            aria-labelledby={labelId}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
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
                    aria-disabled={option.disabled ? 'true' : 'false'}
                    aria-label={option.label}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    onPointerEnter={() => setHighlightedIndex(index)}
                  >
                    <span data-part="itemLabel">{option.label}</span>
                  </div>
                );
              })
            ) : (
              <div
                data-part="empty"
                role="status"
                aria-live="polite"
                onClick={() => {
                  if (allowCustom && inputValue.trim()) {
                    handleSelect(inputValue.trim());
                  }
                }}
              >
                {allowCustom ? `Create "${inputValue}"` : 'No results found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

Combobox.displayName = 'Combobox';
export default Combobox;
