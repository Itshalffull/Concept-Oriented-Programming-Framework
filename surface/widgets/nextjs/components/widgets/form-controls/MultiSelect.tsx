'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useState,
  useEffect,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { openCloseReducer, type OpenCloseState, type OpenCloseAction } from './MultiSelect.reducer.js';

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

export interface MultiSelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
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
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const MultiSelect = forwardRef<HTMLDivElement, MultiSelectProps>(function MultiSelect(
  {
    values: valuesProp,
    defaultValues = [],
    options,
    placeholder = 'Select...',
    label,
    disabled = false,
    required = false,
    name,
    maxSelections,
    onChange,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const contentId = `${uid}-content`;
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useControllableState({
    value: valuesProp,
    defaultValue: defaultValues,
    onChange,
  });

  const [openState, dispatchOpen] = useReducer(openCloseReducer, 'closed');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const isOpen = openState === 'open';

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        dispatchOpen({ type: 'CLOSE' });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const toggleValue = useCallback(
    (optionValue: string) => {
      const isSelected = values.includes(optionValue);
      if (isSelected) {
        setValues(values.filter((v) => v !== optionValue));
      } else {
        if (maxSelections !== undefined && values.length >= maxSelections) return;
        setValues([...values, optionValue]);
      }
    },
    [values, maxSelections, setValues],
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

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          dispatchOpen({ type: 'TOGGLE' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) dispatchOpen({ type: 'OPEN' });
          setHighlightedIndex(0);
          break;
        case 'Escape':
          e.preventDefault();
          dispatchOpen({ type: 'CLOSE' });
          break;
        case 'Backspace':
          removeLast();
          break;
      }
    },
    [isOpen, removeLast],
  );

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % options.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev <= 0 ? options.length - 1 : prev - 1,
          );
          break;
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            toggleValue(options[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          dispatchOpen({ type: 'CLOSE' });
          triggerRef.current?.focus();
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(options.length - 1);
          break;
      }
    },
    [options, highlightedIndex, toggleValue],
  );

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="multi-select"
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      className={className}
      {...rest}
    >
      <span data-part="label" id={labelId}>
        {label}
      </span>

      <div
        ref={triggerRef}
        data-part="trigger"
        data-state={isOpen ? 'open' : 'closed'}
        data-placeholder={values.length === 0 ? 'true' : 'false'}
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-controls={contentId}
        aria-multiselectable="true"
        aria-disabled={disabled ? 'true' : 'false'}
        aria-required={required ? 'true' : 'false'}
        aria-labelledby={labelId}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && dispatchOpen({ type: 'TOGGLE' })}
        onKeyDown={handleTriggerKeyDown}
      >
        {values.length > 0 ? (
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
        ) : (
          <span data-placeholder="true">{placeholder}</span>
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
            aria-multiselectable="true"
            onKeyDown={handleContentKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = values.includes(option.value);
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={option.value}
                  data-part="item"
                  data-state={isSelected ? 'selected' : 'unselected'}
                  data-highlighted={isHighlighted ? 'true' : 'false'}
                  data-disabled={option.disabled ? 'true' : 'false'}
                  role="option"
                  aria-selected={isSelected ? 'true' : 'false'}
                  aria-disabled={option.disabled ? 'true' : 'false'}
                  aria-label={option.label}
                  onClick={() => !option.disabled && toggleValue(option.value)}
                  onPointerEnter={() => setHighlightedIndex(index)}
                >
                  <span
                    data-part="itemIndicator"
                    data-state={isSelected ? 'selected' : 'unselected'}
                    aria-hidden="true"
                  />
                  <span data-part="itemLabel">{option.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {name &&
        values.map((val) => (
          <input key={val} type="hidden" name={`${name}[]`} value={val} />
        ))}
    </div>
  );
});

MultiSelect.displayName = 'MultiSelect';
export default MultiSelect;
