/* ---------------------------------------------------------------------------
 * State machine
 * Content: empty (initial) -> editing
 * Interaction: idle (initial) -> focused -> editing -> autocompleting
 * Previewing: idle (initial) -> showing
 * Validation: valid (initial) -> invalid
 * Events: INPUT, FOCUS, BLUR, SHOW_AC, SELECT_SUGGESTION, etc.
 * ------------------------------------------------------------------------- */

export type ContentState = 'empty' | 'editing';
export type InteractionState = 'idle' | 'focused' | 'editing' | 'autocompleting';
export type PreviewState = 'idle' | 'showing';
export type ValidationState = 'valid' | 'invalid';

export interface FormulaMachine {
  content: ContentState;
  interaction: InteractionState;
  previewing: PreviewState;
  validation: ValidationState;
  activeIndex: number;
  errorMessage: string;
  previewResult: string;
}

export type FormulaEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'TYPE_CHAR' }
  | { type: 'SHOW_AC' }
  | { type: 'DISMISS_AC' }
  | { type: 'SELECT_SUGGESTION' }
  | { type: 'ACCEPT_SUGGESTION' }
  | { type: 'ESCAPE' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'NAVIGATE_UP' }
  | { type: 'HIGHLIGHT'; index: number }
  | { type: 'TRIGGER_AC' }
  | { type: 'EVALUATE'; result: string }
  | { type: 'SYNTAX_ERROR'; message: string }
  | { type: 'TYPE_ERROR'; message: string }
  | { type: 'VALIDATE' };

export function formulaReducer(state: FormulaMachine, event: FormulaEvent): FormulaMachine {
  const s = { ...state };

  switch (event.type) {
    case 'INPUT':
    case 'PASTE':
      if (s.content === 'empty') s.content = 'editing';
      if (s.interaction === 'focused' || s.interaction === 'editing') s.interaction = 'editing';
      if (s.validation === 'invalid') s.validation = 'valid';
      if (s.previewing === 'showing') s.previewing = 'idle';
      break;
    case 'CLEAR':
      s.content = 'empty';
      break;
    case 'FOCUS':
      if (s.interaction === 'idle') s.interaction = 'focused';
      break;
    case 'BLUR':
      s.interaction = 'idle';
      break;
    case 'TYPE_CHAR':
      if (s.interaction === 'focused') s.interaction = 'editing';
      break;
    case 'SHOW_AC':
    case 'TRIGGER_AC':
      s.interaction = 'autocompleting';
      s.activeIndex = 0;
      break;
    case 'SELECT_SUGGESTION':
    case 'ACCEPT_SUGGESTION':
      s.interaction = 'editing';
      s.activeIndex = 0;
      break;
    case 'DISMISS_AC':
    case 'ESCAPE':
      if (s.interaction === 'autocompleting') s.interaction = 'editing';
      break;
    case 'NAVIGATE_DOWN':
      s.activeIndex++;
      break;
    case 'NAVIGATE_UP':
      s.activeIndex = Math.max(0, s.activeIndex - 1);
      break;
    case 'HIGHLIGHT':
      s.activeIndex = event.index;
      break;
    case 'EVALUATE':
      s.previewing = 'showing';
      s.previewResult = event.result;
      break;
    case 'SYNTAX_ERROR':
    case 'TYPE_ERROR':
      s.validation = 'invalid';
      s.errorMessage = event.message;
      s.previewing = 'idle';
      break;
    case 'VALIDATE':
      s.validation = 'valid';
      s.errorMessage = '';
      break;
  }

  return s;
}


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
import { formulaReducer } from './FormulaEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface FormulaFunction {
  name: string;
  category: string;
  signature: string;
}

export interface FormulaSuggestion {
  id: string;
  name: string;
  category: string;
  signature: string;
  isActive?: boolean;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface FormulaEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current formula text. */
  value?: string;
  /** Default (uncontrolled) formula. */
  defaultValue?: string;
  /** Schema definition string for property resolution. */
  schema?: string;
  /** Available functions for autocomplete. */
  functions?: FormulaFunction[];
  /** Input placeholder. */
  placeholder?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when formula changes. */
  onChange?: (value: string) => void;
  /** Callback to evaluate a formula and return result. */
  onEvaluate?: (formula: string) => string | null;
  /** Callback to validate formula and return error or null. */
  onValidate?: (formula: string) => string | null;
  /** Callback to get autocomplete suggestions. */
  onSuggest?: (query: string) => FormulaSuggestion[];
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const FormulaEditor = forwardRef<HTMLDivElement, FormulaEditorProps>(function FormulaEditor(
  {
    value: controlledValue,
    defaultValue = '',
    schema: _schema,
    functions: _functions = [],
    placeholder = 'Enter formula...',
    disabled = false,
    readOnly = false,
    label = 'Formula',
    size = 'md',
    onChange,
    onEvaluate,
    onValidate,
    onSuggest,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(formulaReducer, {
    content: defaultValue ? 'editing' : 'empty',
    interaction: 'idle',
    previewing: 'idle',
    validation: 'valid',
    activeIndex: 0,
    errorMessage: '',
    previewResult: '',
  });

  const inputRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const autocompleteId = useId();
  const previewId = useId();
  const errorId = useId();
  const textRef = useRef(controlledValue ?? defaultValue);

  useFloatingPosition(inputRef, autocompleteRef, {
    placement: 'bottom-start',
    enabled: machine.interaction === 'autocompleting',
  });

  // Get suggestions
  const suggestions: FormulaSuggestion[] = (() => {
    if (machine.interaction !== 'autocompleting' || !onSuggest) return [];
    return onSuggest(textRef.current);
  })();

  const activeIndex = suggestions.length > 0 ? machine.activeIndex % suggestions.length : 0;
  const activeSuggestionId = suggestions[activeIndex]
    ? `formula-suggestion-${suggestions[activeIndex].id}`
    : undefined;

  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const text = el.textContent ?? '';
    textRef.current = text;
    onChange?.(text);

    if (text === '') {
      send({ type: 'CLEAR' });
    } else {
      send({ type: 'INPUT' });
    }

    // Validate
    if (onValidate && text) {
      const error = onValidate(text);
      if (error) {
        send({ type: 'SYNTAX_ERROR', message: error });
      } else {
        send({ type: 'VALIDATE' });
      }
    }

    // Check for autocomplete triggers (function names, property accessors)
    if (onSuggest && text) {
      const lastChar = text[text.length - 1];
      if (lastChar === '(' || lastChar === '.' || /[a-zA-Z]/.test(lastChar)) {
        const results = onSuggest(text);
        if (results.length > 0) {
          send({ type: 'SHOW_AC' });
        }
      }
    }
  }, [onChange, onValidate, onSuggest]);

  const selectSuggestion = useCallback(
    (suggestion: FormulaSuggestion) => {
      const el = inputRef.current;
      if (!el) return;
      // Simple: append the suggestion name
      const text = textRef.current;
      // Find the last partial token and replace
      const match = text.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      let newText = text;
      if (match) {
        newText = text.slice(0, text.length - match[1].length) + suggestion.name;
      } else {
        newText = text + suggestion.name;
      }
      textRef.current = newText;
      el.textContent = newText;
      onChange?.(newText);
      send({ type: 'SELECT_SUGGESTION' });
      el.focus();
    },
    [onChange],
  );

  const handleEvaluate = useCallback(() => {
    if (!onEvaluate) return;
    const result = onEvaluate(textRef.current);
    if (result !== null) {
      send({ type: 'EVALUATE', result });
    }
  }, [onEvaluate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return;

      if (machine.interaction === 'autocompleting') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            send({ type: 'NAVIGATE_DOWN' });
            return;
          case 'ArrowUp':
            e.preventDefault();
            send({ type: 'NAVIGATE_UP' });
            return;
          case 'Tab':
            if (suggestions[activeIndex]) {
              e.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            }
            return;
          case 'Enter':
            if (suggestions[activeIndex]) {
              e.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            }
            return;
          case 'Escape':
            e.preventDefault();
            send({ type: 'ESCAPE' });
            return;
        }
      }

      // Ctrl+Space to trigger autocomplete
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        send({ type: 'TRIGGER_AC' });
        return;
      }

      // Ctrl+Enter or just Enter to evaluate
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleEvaluate();
        return;
      }

      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
      }
    },
    [readOnly, disabled, machine.interaction, suggestions, activeIndex, selectSuggestion, handleEvaluate],
  );

  const isAutocompleting = machine.interaction === 'autocompleting';
  const isEmpty = machine.content === 'empty';
  const isInvalid = machine.validation === 'invalid';
  const isPreviewShowing = machine.previewing === 'showing';

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Formula editor"
      data-part="root"
      data-state={isEmpty ? 'empty' : 'filled'}
      data-disabled={disabled ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      data-valid={!isInvalid ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="formula-editor"
      {...rest}
    >
      {/* Input */}
      <div
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={isAutocompleting ? 'true' : 'false'}
        aria-controls={autocompleteId}
        aria-activedescendant={isAutocompleting ? activeSuggestionId : undefined}
        aria-invalid={isInvalid ? 'true' : 'false'}
        aria-describedby={isInvalid ? errorId : previewId}
        aria-label="Formula input"
        contentEditable={!readOnly && !disabled}
        spellCheck={false}
        data-part="input"
        data-empty={isEmpty ? 'true' : 'false'}
        tabIndex={disabled ? -1 : 0}
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        onPaste={() => send({ type: 'PASTE' })}
        onKeyDown={handleKeyDown}
      />

      {/* Autocomplete suggestions */}
      <div
        ref={autocompleteRef}
        id={autocompleteId}
        role="listbox"
        aria-label="Suggestions"
        data-part="autocomplete"
        data-state={isAutocompleting ? 'open' : 'closed'}
        data-visible={isAutocompleting ? 'true' : 'false'}
      >
        {isAutocompleting && suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            id={`formula-suggestion-${suggestion.id}`}
            role="option"
            aria-selected={index === activeIndex ? 'true' : 'false'}
            aria-label={`${suggestion.name} - ${suggestion.signature}`}
            data-part="suggestion"
            data-active={index === activeIndex ? 'true' : 'false'}
            data-category={suggestion.category}
            onClick={() => selectSuggestion(suggestion)}
            onMouseEnter={() => send({ type: 'HIGHLIGHT', index })}
          >
            <span data-part="suggestion-name">{suggestion.name}</span>
            <span data-part="suggestion-signature">{suggestion.signature}</span>
          </div>
        ))}
      </div>

      {/* Function browser */}
      <div
        role="tree"
        aria-label="Function browser"
        data-part="function-browser"
      />

      {/* Preview */}
      <div
        id={previewId}
        role="status"
        aria-live="polite"
        aria-label="Formula result"
        data-part="preview"
        data-visible={isPreviewShowing ? 'true' : 'false'}
      >
        {isPreviewShowing ? machine.previewResult : ''}
      </div>

      {/* Error */}
      <span
        id={errorId}
        role="alert"
        aria-live="assertive"
        data-part="error"
        data-visible={isInvalid ? 'true' : 'false'}
      >
        {isInvalid ? machine.errorMessage : ''}
      </span>
    </div>
  );
});

FormulaEditor.displayName = 'FormulaEditor';
export { FormulaEditor };
export default FormulaEditor;
