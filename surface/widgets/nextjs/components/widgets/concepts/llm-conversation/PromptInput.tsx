/* ---------------------------------------------------------------------------
 * PromptInput — Server Component
 *
 * Auto-expanding textarea for composing LLM prompts with file attachment
 * and model selection slots.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PromptInputProps {
  /** Current input value. */
  value: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Maximum character length. */
  maxLength?: number | undefined;
  /** Show the model selector slot. */
  showModelSelector?: boolean;
  /** Show the attach button. */
  showAttach?: boolean;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Children rendered in the model selector slot. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function PromptInput({
  value,
  placeholder = 'Type a message...',
  maxLength,
  showModelSelector = true,
  showAttach = true,
  disabled = false,
  children,
}: PromptInputProps) {
  const state = value ? 'composing' : 'empty';
  const isSubmitDisabled = state === 'empty' || disabled;
  const isInputDisabled = disabled;

  return (
    <div
      role="group"
      aria-label="Message input"
      data-surface-widget=""
      data-widget-name="prompt-input"
      data-part="root"
      data-state={state}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <textarea
        data-part="textarea"
        data-state={state}
        data-empty={state === 'empty' ? 'true' : 'false'}
        role="textbox"
        aria-multiline="true"
        aria-label="Type your message"
        placeholder={placeholder}
        defaultValue={value}
        maxLength={maxLength}
        disabled={isInputDisabled}
        rows={1}
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
      >
        Send
      </button>

      <div data-part="toolbar" data-state={state} role="toolbar">
        {/* Toolbar slot for toggles and actions */}
      </div>
    </div>
  );
}

export { PromptInput };
