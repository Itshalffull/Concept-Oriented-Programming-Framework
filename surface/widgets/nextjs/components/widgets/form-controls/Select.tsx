'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useState,
  useId,
  useEffect,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { openCloseReducer, focusReducer, type OpenCloseState, type OpenCloseAction, type FocusState, type FocusAction } from './Select.reducer.js';

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

export interface SelectProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
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
  /** Change callback */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  {
    value: valueProp,
    defaultValue = '',
    options,
    placeholder = 'Select...',
    label,
    disabled = false,
    required = false,
    name,
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [openState, dispatchOpen] = useReducer(openCloseReducer, 'closed');
  const [_focusState, dispatchFocus] = useReducer(focusReducer, 'idle');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const isOpen = openState === 'open';

  const selectedLabel = options.find((o) => o.value === value)?.label;

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

  const handleSelect = useCallback(
    (optionValue: string) => {
      setValue(optionValue);
      dispatchOpen({ type: 'SELECT' });
      triggerRef.current?.focus();
    },
    [setValue],
  );

  const enabledOptions = options.filter((o) => !o.disabled);

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
          if (!isOpen) {
            dispatchOpen({ type: 'OPEN' });
          }
          setHighlightedIndex(0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev <= 0 ? enabledOptions.length - 1 : prev - 1,
            );
          }
          break;
        case 'Escape':
          e.preventDefault();
          dispatchOpen({ type: 'CLOSE' });
          break;
      }
    },
    [isOpen, enabledOptions.length],
  );

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % enabledOptions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev <= 0 ? enabledOptions.length - 1 : prev - 1,
          );
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(enabledOptions.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && enabledOptions[highlightedIndex]) {
            handleSelect(enabledOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          dispatchOpen({ type: 'CLOSE' });
          triggerRef.current?.focus();
          break;
      }
    },
    [enabledOptions, highlightedIndex, handleSelect],
  );

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="select"
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

      <button
        ref={triggerRef}
        type="button"
        data-part="trigger"
        data-state={isOpen ? 'open' : 'closed'}
        data-placeholder={!value ? 'true' : 'false'}
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-controls={contentId}
        aria-labelledby={labelId}
        aria-disabled={disabled ? 'true' : 'false'}
        aria-required={required ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => dispatchOpen({ type: 'TOGGLE' })}
        onFocus={() => dispatchFocus({ type: 'FOCUS' })}
        onBlur={() => dispatchFocus({ type: 'BLUR' })}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          data-part="valueDisplay"
          data-placeholder={!value ? 'true' : 'false'}
        >
          {selectedLabel ?? placeholder}
        </span>
        <span data-part="indicator" data-state={isOpen ? 'open' : 'closed'} aria-hidden="true" />
      </button>

      {isOpen && (
        <div data-part="positioner">
          <div
            ref={contentRef}
            id={contentId}
            data-part="content"
            role="listbox"
            aria-labelledby={labelId}
            onKeyDown={handleContentKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
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
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onPointerEnter={() => setHighlightedIndex(index)}
                >
                  <span data-part="itemLabel">{option.label}</span>
                  {isSelected && (
                    <span data-part="itemIndicator" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
