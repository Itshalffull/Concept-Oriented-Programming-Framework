/* ---------------------------------------------------------------------------
 * ExpressionToggleInput — Dual-mode input (literal vs expression)
 *
 * Switches between a fixed-value form widget and an expression/code editor.
 * In fixed mode, renders the appropriate field widget (text, number, boolean).
 * In expression mode, shows an expression editor with variable autocomplete
 * and live preview of the evaluated result.
 * ------------------------------------------------------------------------- */

export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT'; value?: string }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT'; variable?: string }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ExpressionToggleInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  /** Current value (for fixed mode) */
  value: string;
  /** Current mode identifier */
  mode: string;
  /** Type of the fixed-value input */
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  /** Available upstream variables for autocomplete */
  variables?: string[];
  /** Current expression string (for expression mode) */
  expression?: string;
  /** Preview of the evaluated expression */
  previewValue?: string;
  /** Whether the expression is valid */
  expressionValid?: boolean;
  /** Called when fixed value changes */
  onChange?: (value: string) => void;
  /** Called when expression changes */
  onExpressionChange?: (expression: string) => void;
  /** Called when mode is toggled */
  onToggleMode?: (mode: 'fixed' | 'expression') => void;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ExpressionToggleInput = forwardRef<HTMLDivElement, ExpressionToggleInputProps>(function ExpressionToggleInput(
  {
    value,
    mode: _modeProp,
    fieldType = 'text',
    variables = [],
    expression: expressionProp = '',
    previewValue,
    expressionValid,
    onChange,
    onExpressionChange,
    onToggleMode,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(expressionToggleInputReducer, 'fixed');
  const [fixedValue, setFixedValue] = useState(value);
  const [expressionValue, setExpressionValue] = useState(expressionProp);
  const [acQuery, setAcQuery] = useState('');
  const [acIndex, setAcIndex] = useState(0);
  const expressionRef = useRef<HTMLTextAreaElement>(null);
  const fixedRef = useRef<HTMLInputElement>(null);

  // Sync value prop
  useEffect(() => {
    setFixedValue(value);
  }, [value]);

  useEffect(() => {
    setExpressionValue(expressionProp);
  }, [expressionProp]);

  // Focus expression input when switching to expression mode
  useEffect(() => {
    if (state === 'expression' || state === 'autocompleting') {
      expressionRef.current?.focus();
    }
  }, [state]);

  const isExpressionMode = state !== 'fixed';

  // Filtered autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!acQuery) return variables;
    const q = acQuery.toLowerCase();
    return variables.filter((v) => v.toLowerCase().includes(q));
  }, [variables, acQuery]);

  const handleToggle = useCallback(() => {
    const newMode = state === 'fixed' ? 'expression' : 'fixed';
    send({ type: 'TOGGLE' });
    onToggleMode?.(newMode as 'fixed' | 'expression');
  }, [state, onToggleMode]);

  const handleFixedChange = useCallback((newValue: string) => {
    setFixedValue(newValue);
    send({ type: 'INPUT', value: newValue });
    onChange?.(newValue);
  }, [onChange]);

  const handleExpressionChange = useCallback((newExpr: string) => {
    setExpressionValue(newExpr);
    send({ type: 'INPUT', value: newExpr });
    onExpressionChange?.(newExpr);

    // Detect if user is typing a variable reference
    const lastWord = newExpr.split(/[\s()+\-*/,]+/).pop() ?? '';
    if (lastWord.length > 0 && variables.some((v) => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
      setAcQuery(lastWord);
      setAcIndex(0);
      send({ type: 'SHOW_AC' });
    }
  }, [onExpressionChange, variables]);

  const handleSelectSuggestion = useCallback((variable: string) => {
    // Replace the last partial word with the selected variable
    const parts = expressionValue.split(/[\s()+\-*/,]+/);
    const lastPart = parts[parts.length - 1] ?? '';
    const newExpr = expressionValue.slice(0, expressionValue.length - lastPart.length) + variable;
    setExpressionValue(newExpr);
    onExpressionChange?.(newExpr);
    send({ type: 'SELECT', variable });
    expressionRef.current?.focus();
  }, [expressionValue, onExpressionChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      handleToggle();
      return;
    }

    if (state === 'autocompleting') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = suggestions[acIndex];
        if (selected) handleSelectSuggestion(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        send({ type: 'DISMISS' });
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      send({ type: 'DISMISS' });
    }
  }, [state, handleToggle, suggestions, acIndex, handleSelectSuggestion]);

  // Render the appropriate fixed-mode input
  const renderFixedInput = () => {
    switch (fieldType) {
      case 'boolean':
        return (
          <label data-part="boolean-label">
            <input
              ref={fixedRef as React.RefObject<HTMLInputElement>}
              type="checkbox"
              data-part="fixed-checkbox"
              checked={fixedValue === 'true'}
              onChange={(e) => handleFixedChange(String(e.target.checked))}
              aria-label="Fixed boolean value"
            />
            {fixedValue === 'true' ? 'true' : 'false'}
          </label>
        );
      case 'number':
        return (
          <input
            ref={fixedRef}
            type="number"
            data-part="fixed-number"
            value={fixedValue}
            onChange={(e) => handleFixedChange(e.target.value)}
            aria-label="Fixed number value"
          />
        );
      case 'object':
        return (
          <textarea
            data-part="fixed-object"
            value={fixedValue}
            onChange={(e) => handleFixedChange(e.target.value)}
            aria-label="Fixed object value (JSON)"
            rows={4}
          />
        );
      case 'text':
      default:
        return (
          <input
            ref={fixedRef}
            type="text"
            data-part="fixed-text"
            value={fixedValue}
            onChange={(e) => handleFixedChange(e.target.value)}
            aria-label="Fixed text value"
          />
        );
    }
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Expression toggle input"
      data-surface-widget=""
      data-widget-name="expression-toggle-input"
      data-part="root"
      data-state={state}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...rest}
    >
      {/* Mode toggle switch */}
      <button
        type="button"
        data-part="mode-toggle"
        role="switch"
        aria-label="Expression mode"
        aria-checked={isExpressionMode}
        onClick={handleToggle}
      >
        {isExpressionMode ? 'Expression' : 'Fixed'}
      </button>

      {/* Fixed value input */}
      <div
        data-part="fixed-input"
        data-visible={!isExpressionMode ? 'true' : 'false'}
        aria-hidden={isExpressionMode}
      >
        {!isExpressionMode && renderFixedInput()}
      </div>

      {/* Expression editor */}
      <div
        data-part="expression-input"
        data-visible={isExpressionMode ? 'true' : 'false'}
        aria-hidden={!isExpressionMode}
      >
        {isExpressionMode && (
          <textarea
            ref={expressionRef}
            data-part="expression-textarea"
            role="textbox"
            aria-label="Expression editor"
            value={expressionValue}
            onChange={(e) => handleExpressionChange(e.target.value)}
            rows={3}
            spellCheck={false}
          />
        )}
      </div>

      {/* Autocomplete dropdown */}
      <div
        data-part="autocomplete"
        data-visible={state === 'autocompleting' ? 'true' : 'false'}
        role="listbox"
        aria-label="Variable suggestions"
      >
        {state === 'autocompleting' && suggestions.map((variable, index) => (
          <div
            key={variable}
            data-part="autocomplete-item"
            role="option"
            aria-selected={acIndex === index}
            data-focused={acIndex === index ? 'true' : 'false'}
            onClick={() => handleSelectSuggestion(variable)}
            onMouseEnter={() => setAcIndex(index)}
          >
            {variable}
          </div>
        ))}
        {state === 'autocompleting' && suggestions.length === 0 && (
          <div data-part="autocomplete-empty" role="option" aria-disabled="true">
            No matching variables
          </div>
        )}
      </div>

      {/* Live preview */}
      <div data-part="preview" role="status" aria-live="polite">
        {isExpressionMode && previewValue !== undefined && (
          <span
            data-part="preview-value"
            data-valid={expressionValid !== false ? 'true' : 'false'}
          >
            {previewValue}
          </span>
        )}
        {isExpressionMode && previewValue === undefined && expressionValue && (
          <span data-part="preview-placeholder">Enter expression to preview</span>
        )}
      </div>

      {children}
    </div>
  );
});

ExpressionToggleInput.displayName = 'ExpressionToggleInput';
export { ExpressionToggleInput };
export default ExpressionToggleInput;
