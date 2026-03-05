export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT'; value?: string }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useRef,
  useEffect,
  useCallback,
  useId,
  type HTMLAttributes,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

export interface PromptInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSubmit'> {
  value: string;
  onSubmit?: (value: string) => void | Promise<void>;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number | undefined;
  showModelSelector?: boolean;
  showAttach?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

const PromptInput = forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
  {
    value,
    onSubmit,
    onChange,
    placeholder = 'Type a message...',
    maxLength,
    showModelSelector = true,
    showAttach = true,
    disabled = false,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(promptInputReducer, value ? 'composing' : 'empty');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();

  // Auto-resize textarea to fit content
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Resize on value change
  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange?.(newValue);

      if (newValue.length === 0) {
        send({ type: 'CLEAR' });
      } else {
        send({ type: 'INPUT', value: newValue });
      }
    },
    [onChange],
  );

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || disabled || state === 'submitting') return;
    send({ type: 'SUBMIT' });
    try {
      await onSubmit?.(value);
      send({ type: 'SUBMIT_COMPLETE' });
    } catch {
      send({ type: 'SUBMIT_ERROR' });
    }
  }, [value, disabled, state, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onChange?.('');
        send({ type: 'CLEAR' });
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        send({ type: 'ATTACH' });
      }
    },
    [handleSubmit, onChange],
  );

  const isSubmitDisabled = state === 'empty' || state === 'submitting' || disabled;
  const isInputDisabled = state === 'submitting' || disabled;

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Message input"
      data-surface-widget=""
      data-widget-name="prompt-input"
      data-part="root"
      data-state={state}
      data-disabled={disabled ? 'true' : 'false'}
      {...restProps}
    >
      <textarea
        ref={textareaRef}
        data-part="textarea"
        data-state={state}
        data-empty={state === 'empty' ? 'true' : 'false'}
        role="textbox"
        aria-multiline="true"
        aria-label="Type your message"
        aria-describedby={counterId}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        disabled={isInputDisabled}
        rows={1}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={() => {
          if (state === 'empty') send({ type: 'PASTE' });
        }}
        style={{ resize: 'none', overflow: 'auto' }}
      />

      {showAttach && (
        <button
          type="button"
          data-part="attach-button"
          data-state={state}
          data-visible="true"
          aria-label="Attach file"
          tabIndex={0}
          disabled={isInputDisabled}
          onClick={() => send({ type: 'ATTACH' })}
        >
          Attach
        </button>
      )}

      {showModelSelector && (
        <div data-part="model-selector" data-state={state} data-visible="true">
          {children}
        </div>
      )}

      <span
        id={counterId}
        data-part="counter"
        data-state={state}
        role="status"
        aria-live="polite"
      >
        {value.length}{maxLength != null ? ` / ${maxLength}` : ''}
      </span>

      <button
        type="button"
        data-part="submit-button"
        data-state={state}
        aria-label="Send message"
        aria-disabled={isSubmitDisabled ? 'true' : 'false'}
        tabIndex={0}
        disabled={isSubmitDisabled}
        onClick={handleSubmit}
      >
        {state === 'submitting' ? (
          <span data-part="spinner" aria-hidden="true" />
        ) : (
          'Send'
        )}
      </button>

      <div data-part="toolbar" data-state={state} role="toolbar">
        {/* Toolbar slot for toggles and actions */}
      </div>
    </div>
  );
});

PromptInput.displayName = 'PromptInput';
export { PromptInput };
export default PromptInput;
