'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { useFloatingPosition } from '../shared/useFloatingPosition.js';
import { mentionReducer } from './MentionInput.reducer.js';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface MentionTrigger {
  char: string;
  dataSource: string;
}

export interface MentionSuggestion {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

export interface MentionChip {
  label: string;
  value: string;
  triggerChar: string;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MentionInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Trigger character configurations. */
  triggers: MentionTrigger[];
  /** Current text value. */
  value?: string;
  /** Default (uncontrolled) text value. */
  defaultValue?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Maximum number of suggestions shown. */
  maxSuggestions?: number;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when text changes. */
  onChange?: (value: string) => void;
  /** Callback to fetch suggestions for a trigger and query. */
  onQuerySuggestions?: (trigger: string, query: string) => MentionSuggestion[];
  /** Callback when a mention is selected. */
  onMentionSelect?: (mention: MentionChip) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const MentionInput = forwardRef<HTMLDivElement, MentionInputProps>(function MentionInput(
  {
    triggers,
    value: controlledValue,
    defaultValue = '',
    placeholder = '',
    disabled = false,
    readOnly = false,
    maxSuggestions = 10,
    size = 'md',
    onChange,
    onQuerySuggestions,
    onMentionSelect,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(mentionReducer, {
    trigger: 'idle',
    focus: 'unfocused',
    navigation: 'none',
    activeTriggerChar: '',
    query: '',
    activeIndex: 0,
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionsListId = useId();
  const textRef = useRef(controlledValue ?? defaultValue);
  const triggerChars = triggers.map((t) => t.char);

  useFloatingPosition(inputRef, suggestionsRef, {
    placement: 'bottom-start',
    enabled: machine.trigger === 'suggesting',
  });

  // Get current suggestions
  const suggestions: MentionSuggestion[] = (() => {
    if (machine.trigger !== 'suggesting' || !onQuerySuggestions) return [];
    return onQuerySuggestions(machine.activeTriggerChar, machine.query).slice(0, maxSuggestions);
  })();

  // Wrap active index
  const activeIndex = suggestions.length > 0 ? machine.activeIndex % suggestions.length : 0;

  const activeSuggestionId = suggestions[activeIndex]
    ? `mention-suggestion-${suggestions[activeIndex].id}`
    : undefined;

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      textRef.current = text;
      onChange?.(text);

      // Check for trigger character
      const cursorPos = e.target.selectionStart ?? text.length;
      const charBeforeCursor = text[cursorPos - 1];

      if (charBeforeCursor && triggerChars.includes(charBeforeCursor)) {
        const charBeforeTrigger = text[cursorPos - 2];
        if (!charBeforeTrigger || charBeforeTrigger === ' ' || charBeforeTrigger === '\n') {
          send({ type: 'TRIGGER_CHAR', char: charBeforeCursor });
          return;
        }
      }

      // Update query if in triggered/suggesting state
      if (machine.trigger === 'triggered' || machine.trigger === 'suggesting') {
        // Find the trigger position
        const textUpToCursor = text.slice(0, cursorPos);
        const lastTriggerIdx = textUpToCursor.lastIndexOf(machine.activeTriggerChar);
        if (lastTriggerIdx >= 0) {
          const query = textUpToCursor.slice(lastTriggerIdx + 1);
          if (query.includes(' ') || query.includes('\n')) {
            send({ type: 'ESCAPE' });
          } else {
            send({ type: 'QUERY_CHANGE', query });
          }
        }
      }
    },
    [onChange, triggerChars, machine.trigger, machine.activeTriggerChar],
  );

  const selectSuggestion = useCallback(
    (suggestion: MentionSuggestion) => {
      const input = inputRef.current;
      if (!input) return;
      const text = textRef.current;
      const cursorPos = input.selectionStart ?? text.length;
      const textUpToCursor = text.slice(0, cursorPos);
      const lastTriggerIdx = textUpToCursor.lastIndexOf(machine.activeTriggerChar);

      if (lastTriggerIdx >= 0) {
        const before = text.slice(0, lastTriggerIdx);
        const after = text.slice(cursorPos);
        const newText = `${before}${machine.activeTriggerChar}${suggestion.label} ${after}`;
        textRef.current = newText;
        onChange?.(newText);
        onMentionSelect?.({
          label: suggestion.label,
          value: suggestion.value,
          triggerChar: machine.activeTriggerChar,
        });
      }

      send({ type: 'SELECT' });
      input.focus();
    },
    [machine.activeTriggerChar, onChange, onMentionSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (machine.trigger === 'suggesting') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            send({ type: 'NAVIGATE_DOWN' });
            break;
          case 'ArrowUp':
            e.preventDefault();
            send({ type: 'NAVIGATE_UP' });
            break;
          case 'Enter':
            if (suggestions[activeIndex]) {
              e.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            }
            break;
          case 'Tab':
            if (suggestions[activeIndex]) {
              e.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            send({ type: 'ESCAPE' });
            break;
        }
      }
    },
    [machine.trigger, suggestions, activeIndex, selectSuggestion],
  );

  const isSuggesting = machine.trigger === 'suggesting';

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Mention input"
      data-part="root"
      data-state={isSuggesting ? 'suggesting' : machine.trigger === 'triggered' ? 'triggered' : 'idle'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="mention-input"
      {...rest}
    >
      <textarea
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={isSuggesting ? 'true' : 'false'}
        aria-controls={suggestionsListId}
        aria-activedescendant={isSuggesting ? activeSuggestionId : undefined}
        value={controlledValue ?? textRef.current}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        data-part="input"
        tabIndex={disabled ? -1 : 0}
        onInput={handleInput as unknown as React.FormEventHandler<HTMLTextAreaElement>}
        onChange={handleInput}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => {
          // Delay blur to allow click on suggestion
          setTimeout(() => send({ type: 'BLUR' }), 200);
        }}
        onKeyDown={handleKeyDown}
      />

      {/* Suggestions list */}
      <div
        ref={suggestionsRef}
        id={suggestionsListId}
        role="listbox"
        aria-label="Suggestions"
        data-part="suggestions"
        data-state={isSuggesting ? 'open' : 'closed'}
        data-visible={isSuggesting ? 'true' : 'false'}
        data-trigger={machine.activeTriggerChar}
      >
        {isSuggesting && suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            id={`mention-suggestion-${suggestion.id}`}
            role="option"
            aria-selected={index === activeIndex ? 'true' : 'false'}
            aria-label={suggestion.label}
            data-part="suggestion"
            data-active={index === activeIndex ? 'true' : 'false'}
            data-index={index}
            onClick={() => selectSuggestion(suggestion)}
            onMouseEnter={() => send({ type: 'HIGHLIGHT', index })}
          >
            {suggestion.icon && (
              <span data-part="suggestion-icon" aria-hidden="true" />
            )}
            <span data-part="suggestion-label">{suggestion.label}</span>
            {suggestion.description && (
              <span data-part="suggestion-description" data-visible="true">
                {suggestion.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

MentionInput.displayName = 'MentionInput';
export { MentionInput };
export default MentionInput;
