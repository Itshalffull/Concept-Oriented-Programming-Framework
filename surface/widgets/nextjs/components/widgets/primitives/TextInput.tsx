'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { textInputReducer, type TextInputState, type TextInputEvent } from './TextInput.reducer.js';

// Props from text-input.widget spec
export interface TextInputProps {
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  pattern?: string;
  name?: string;
  autocomplete?: string;
  label?: string;
  description?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export const TextInput = forwardRef<HTMLDivElement, TextInputProps>(
  function TextInput(
    {
      value = '',
      placeholder = '',
      required = false,
      disabled = false,
      readOnly = false,
      maxLength,
      pattern,
      name,
      autocomplete,
      label,
      description,
      error,
      prefix,
      suffix,
      onChange,
      onClear,
      className,
    },
    ref
  ) {
    const generatedId = useId();
    const inputId = name || generatedId;
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;
    const labelId = `${inputId}-label`;

    const [state, send] = useReducer(textInputReducer, {
      fill: value.length > 0 ? 'filled' : 'empty',
      focus: 'idle',
      validity: error ? 'invalid' : 'valid',
    });

    const isInvalid = state.validity === 'invalid' || !!error;
    const isFocused = state.focus === 'focused';
    const isFilled = state.fill === 'filled' || value.length > 0;

    const handleInput = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        send({ type: 'INPUT', value: val });
        onChange?.(val);
      },
      [onChange]
    );

    const handleClear = useCallback(() => {
      send({ type: 'CLEAR' });
      onChange?.('');
      onClear?.();
    }, [onChange, onClear]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
          handleClear();
        }
      },
      [handleClear]
    );

    const rootDataState = disabled ? 'disabled' : readOnly ? 'readonly' : 'default';

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="text-input"
        data-part="root"
        data-state={rootDataState}
        data-focus={isFocused ? 'true' : 'false'}
        data-invalid={isInvalid ? 'true' : 'false'}
      >
        {label && (
          <label
            id={labelId}
            htmlFor={inputId}
            data-part="label"
            data-required={required ? 'true' : 'false'}
          >
            {label}
          </label>
        )}
        {prefix && (
          <span data-part="prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type="text"
          role="textbox"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          pattern={pattern}
          name={name}
          autoComplete={autocomplete}
          aria-invalid={isInvalid ? 'true' : 'false'}
          aria-required={required ? 'true' : 'false'}
          aria-disabled={disabled ? 'true' : 'false'}
          aria-readonly={readOnly ? 'true' : 'false'}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={isInvalid ? errorId : description ? descriptionId : undefined}
          onChange={handleInput}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
          onKeyDown={handleKeyDown}
          data-part="input"
        />
        {suffix && (
          <span data-part="suffix" aria-hidden="true">
            {suffix}
          </span>
        )}
        {isFilled && !disabled && !readOnly && (
          <button
            type="button"
            data-part="clear-button"
            role="button"
            aria-label="Clear input"
            tabIndex={-1}
            data-visible={isFilled ? 'true' : 'false'}
            onClick={handleClear}
          >
            {/* clear icon rendered via CSS */}
          </button>
        )}
        {description && (
          <span id={descriptionId} data-part="description">
            {description}
          </span>
        )}
        {error && (
          <span
            id={errorId}
            data-part="error"
            role="alert"
            aria-live="polite"
            data-visible={isInvalid ? 'true' : 'false'}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';
export default TextInput;
