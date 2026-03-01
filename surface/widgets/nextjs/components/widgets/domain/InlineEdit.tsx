'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { inlineEditReducer } from './InlineEdit.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface InlineEditProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current value displayed / edited. */
  value: string;
  /** Placeholder when value is empty. */
  placeholder?: string;
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** Whether the field is disabled. */
  disabled?: boolean;
  /** Show confirm/cancel buttons. */
  showButtons?: boolean;
  /** Maximum character length. */
  maxLength?: number;
  /** Select text on focus. */
  selectOnFocus?: boolean;
  /** Submit on blur. */
  submitOnBlur?: boolean;
  /** Called when a new value is confirmed. */
  onConfirm?: (value: string) => void;
  /** Called when editing is cancelled. */
  onCancel?: () => void;
  /** Render prop for the edit button icon. */
  editIcon?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const InlineEdit = forwardRef<HTMLDivElement, InlineEditProps>(function InlineEdit(
  {
    value,
    placeholder = 'Click to edit',
    ariaLabel = 'Editable field',
    required = false,
    disabled = false,
    showButtons = false,
    maxLength,
    selectOnFocus = true,
    submitOnBlur = true,
    onConfirm,
    onCancel,
    editIcon,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(inlineEditReducer, 'displaying');
  const inputRef = useRef<HTMLInputElement>(null);
  const editValueRef = useRef(value);

  useEffect(() => {
    if (state === 'editing' && inputRef.current) {
      inputRef.current.focus();
      if (selectOnFocus) {
        inputRef.current.select();
      }
    }
  }, [state, selectOnFocus]);

  useEffect(() => {
    editValueRef.current = value;
  }, [value]);

  const handleConfirm = useCallback(() => {
    const newVal = editValueRef.current;
    if (required && !newVal.trim()) return;
    onConfirm?.(newVal);
    send({ type: 'CONFIRM' });
  }, [required, onConfirm]);

  const handleCancel = useCallback(() => {
    editValueRef.current = value;
    onCancel?.();
    send({ type: 'CANCEL' });
  }, [value, onCancel]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
      if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
    },
    [handleConfirm, handleCancel],
  );

  const handleDisplayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        send({ type: 'ACTIVATE' });
      }
    },
    [disabled],
  );

  const isEditing = state === 'editing';

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-roledescription="inline editor"
      data-surface-widget=""
      data-widget-name="inline-edit"
      data-state={isEditing ? 'editing' : 'displaying'}
      data-disabled={disabled ? 'true' : 'false'}
      data-empty={!value ? 'true' : 'false'}
      {...rest}
    >
      {!isEditing && (
        <div
          role="button"
          aria-label={`${ariaLabel}: ${value || placeholder}. Click to edit.`}
          data-part="display"
          data-visible="true"
          data-empty={!value ? 'true' : 'false'}
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && send({ type: 'ACTIVATE' })}
          onKeyDown={handleDisplayKeyDown}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
        >
          <span
            data-part="display-text"
            data-placeholder={!value ? 'true' : 'false'}
          >
            {value || placeholder}
          </span>
        </div>
      )}

      {showButtons && !isEditing && !disabled && (
        <button
          type="button"
          role="button"
          aria-label={`Edit ${ariaLabel}`}
          data-part="edit-button"
          data-visible="true"
          tabIndex={-1}
          onClick={() => send({ type: 'ACTIVATE' })}
        >
          {editIcon ?? '\u270E'}
        </button>
      )}

      {isEditing && (
        <>
          <input
            ref={inputRef}
            type="text"
            data-part="input"
            data-visible="true"
            defaultValue={value}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-label={ariaLabel}
            aria-required={required || undefined}
            onChange={(e) => { editValueRef.current = e.target.value; }}
            onKeyDown={handleInputKeyDown}
            onBlur={() => submitOnBlur ? handleConfirm() : handleCancel()}
          />
          {showButtons && (
            <>
              <button
                type="button"
                role="button"
                aria-label="Confirm edit"
                data-part="confirm"
                data-visible="true"
                tabIndex={-1}
                onClick={handleConfirm}
              >
                &#x2713;
              </button>
              <button
                type="button"
                role="button"
                aria-label="Cancel edit"
                data-part="cancel"
                data-visible="true"
                tabIndex={-1}
                onClick={handleCancel}
              >
                &#x2715;
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
});

InlineEdit.displayName = 'InlineEdit';
export { InlineEdit };
export default InlineEdit;
