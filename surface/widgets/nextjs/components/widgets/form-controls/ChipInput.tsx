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
import { interactionReducer, type InteractionState, type InteractionAction } from './ChipInput.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ChipInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current chip values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
  /** Allow creating custom values */
  allowCreate?: boolean;
  /** Maximum number of chips */
  maxItems?: number;
  /** Separator character (default comma) */
  separator?: string;
  /** Visible label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Autocomplete suggestions */
  suggestions?: string[];
  /** Value validator (regex pattern) */
  validateValue?: string;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ChipInput = forwardRef<HTMLDivElement, ChipInputProps>(function ChipInput(
  {
    values: valuesProp,
    defaultValues = [],
    allowCreate = true,
    maxItems,
    separator = ',',
    label,
    placeholder = 'Type and press Enter...',
    disabled = false,
    required = false,
    name,
    suggestions: suggestionsListProp = [],
    validateValue,
    onChange,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const suggestionsId = `${uid}-suggestions`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useControllableState({
    value: valuesProp,
    defaultValue: defaultValues,
    onChange,
  });

  const [inputText, setInputText] = useState('');
  const [interactionState, dispatch] = useReducer(interactionReducer, 'idle');
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

  const isSuggesting = interactionState === 'suggesting';

  const filteredSuggestions = useMemo(
    () =>
      suggestionsListProp.filter(
        (s) =>
          s.toLowerCase().includes(inputText.toLowerCase()) &&
          !values.includes(s),
      ),
    [suggestionsListProp, inputText, values],
  );

  // Show/hide suggestions based on input text
  useEffect(() => {
    if (interactionState === 'typing' && inputText && filteredSuggestions.length > 0) {
      dispatch({ type: 'SUGGEST' });
      setHighlightedSuggestion(0);
    } else if (interactionState === 'suggesting' && filteredSuggestions.length === 0 && !inputText) {
      dispatch({ type: 'CLOSE' });
    }
  }, [inputText, filteredSuggestions.length, interactionState]);

  // Close on outside click
  useEffect(() => {
    if (!isSuggesting) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        dispatch({ type: 'BLUR' });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSuggesting]);

  const isValid = useCallback(
    (val: string): boolean => {
      if (!val.trim()) return false;
      if (values.includes(val.trim())) return false;
      if (validateValue) {
        try {
          return new RegExp(validateValue).test(val.trim());
        } catch {
          return true;
        }
      }
      return true;
    },
    [values, validateValue],
  );

  const addChip = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      if (maxItems !== undefined && values.length >= maxItems) return;
      if (values.includes(trimmed)) return;
      if (!isValid(trimmed)) return;
      setValues([...values, trimmed]);
      setInputText('');
    },
    [values, maxItems, isValid, setValues],
  );

  const removeChip = useCallback(
    (index: number) => {
      setValues(values.filter((_, i) => i !== index));
    },
    [values, setValues],
  );

  const removeLast = useCallback(() => {
    if (values.length > 0) {
      setValues(values.slice(0, -1));
    }
  }, [values, setValues]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (isSuggesting && highlightedSuggestion >= 0 && filteredSuggestions[highlightedSuggestion]) {
            addChip(filteredSuggestions[highlightedSuggestion]);
            dispatch({ type: 'SELECT_SUGGESTION' });
          } else if (inputText.trim()) {
            addChip(inputText);
            dispatch({ type: 'CREATE' });
          }
          break;
        case separator:
          if (separator === ',') {
            e.preventDefault();
            if (inputText.trim()) {
              addChip(inputText);
              dispatch({ type: 'CREATE' });
            }
          }
          break;
        case 'Backspace':
          if (inputText === '') {
            removeLast();
          }
          break;
        case 'ArrowDown':
          if (isSuggesting) {
            e.preventDefault();
            setHighlightedSuggestion((prev) => (prev + 1) % filteredSuggestions.length);
          } else if (filteredSuggestions.length > 0) {
            dispatch({ type: 'SUGGEST' });
            setHighlightedSuggestion(0);
          }
          break;
        case 'ArrowUp':
          if (isSuggesting) {
            e.preventDefault();
            setHighlightedSuggestion((prev) =>
              prev <= 0 ? filteredSuggestions.length - 1 : prev - 1,
            );
          }
          break;
        case 'Escape':
          e.preventDefault();
          dispatch({ type: 'CLOSE' });
          break;
      }
    },
    [
      isSuggesting,
      highlightedSuggestion,
      filteredSuggestions,
      inputText,
      separator,
      addChip,
      removeLast,
    ],
  );

  const isAtMax = maxItems !== undefined && values.length >= maxItems;

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
      data-widget-name="chip-input"
      data-part="root"
      data-state={interactionState}
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
        data-state={interactionState}
        data-focus={interactionState !== 'idle' ? 'true' : 'false'}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {values.length > 0 && (
          <div data-part="chipList" role="list" aria-label="Entered values" aria-live="polite">
            {values.map((val, index) => (
              <span
                key={`${val}-${index}`}
                data-part="chip"
                data-value={val}
                role="listitem"
                aria-label={`Remove ${val}`}
              >
                {val}
                <button
                  type="button"
                  aria-label={`Remove ${val}`}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(index);
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
          value={inputText}
          placeholder={values.length === 0 ? placeholder : ''}
          disabled={disabled || isAtMax}
          name={name}
          aria-label={label}
          aria-expanded={isSuggesting ? 'true' : 'false'}
          aria-haspopup="listbox"
          aria-controls={suggestionsId}
          aria-activedescendant={
            isSuggesting && highlightedSuggestion >= 0 && filteredSuggestions[highlightedSuggestion]
              ? `${uid}-sug-${highlightedSuggestion}`
              : undefined
          }
          aria-autocomplete="list"
          aria-disabled={disabled ? 'true' : 'false'}
          aria-labelledby={labelId}
          autoComplete="off"
          onChange={handleInputChange}
          onFocus={() => dispatch({ type: 'FOCUS' })}
          onBlur={() => {
            // Small delay to allow click on suggestions
            setTimeout(() => dispatch({ type: 'BLUR' }), 150);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {isSuggesting && filteredSuggestions.length > 0 && (
        <div data-part="positioner">
          <div
            id={suggestionsId}
            data-part="suggestions"
            role="listbox"
            aria-labelledby={labelId}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                id={`${uid}-sug-${index}`}
                data-part="suggestion"
                data-highlighted={index === highlightedSuggestion ? 'true' : 'false'}
                role="option"
                aria-label={suggestion}
                onClick={() => {
                  addChip(suggestion);
                  dispatch({ type: 'SELECT_SUGGESTION' });
                  inputRef.current?.focus();
                }}
                onPointerEnter={() => setHighlightedSuggestion(index)}
              >
                {suggestion}
              </div>
            ))}

            {allowCreate &&
              inputText.trim() &&
              !filteredSuggestions.includes(inputText.trim()) && (
                <div
                  data-part="createOption"
                  role="option"
                  aria-label={`Create "${inputText}"`}
                  onClick={() => {
                    addChip(inputText.trim());
                    dispatch({ type: 'CREATE' });
                    inputRef.current?.focus();
                  }}
                >
                  Create &quot;{inputText}&quot;
                </div>
              )}
          </div>
        </div>
      )}

      {name &&
        values.map((val, i) => (
          <input key={`${val}-${i}`} type="hidden" name={`${name}[]`} value={val} />
        ))}
    </div>
  );
});

ChipInput.displayName = 'ChipInput';
export default ChipInput;
