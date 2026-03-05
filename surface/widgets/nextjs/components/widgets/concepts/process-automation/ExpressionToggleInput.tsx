/* ---------------------------------------------------------------------------
 * ExpressionToggleInput — Server Component
 *
 * Dual-mode input field that switches between a fixed-value form widget
 * and an expression/code editor with variable autocomplete and live preview.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface ExpressionToggleInputProps {
  /** Current value (for fixed mode). */
  value: string;
  /** Current mode identifier. */
  mode: string;
  /** Type of the fixed-value input. */
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  /** Available upstream variables for autocomplete. */
  variables?: string[];
  /** Current expression string (for expression mode). */
  expression?: string;
  /** Preview of the evaluated expression. */
  previewValue?: string;
  /** Whether the expression is valid. */
  expressionValid?: boolean;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function ExpressionToggleInput({
  value,
  mode,
  fieldType = 'text',
  variables = [],
  expression = '',
  previewValue,
  expressionValid,
  children,
}: ExpressionToggleInputProps) {
  const isExpressionMode = mode === 'expression';
  const state = isExpressionMode ? 'expression' : 'fixed';

  function renderFixedInput() {
    switch (fieldType) {
      case 'boolean':
        return (
          <label data-part="boolean-label">
            <input
              type="checkbox"
              data-part="fixed-checkbox"
              defaultChecked={value === 'true'}
              aria-label="Fixed boolean value"
            />
            {value === 'true' ? 'true' : 'false'}
          </label>
        );
      case 'number':
        return (
          <input
            type="number"
            data-part="fixed-number"
            defaultValue={value}
            aria-label="Fixed number value"
          />
        );
      case 'object':
        return (
          <textarea
            data-part="fixed-object"
            defaultValue={value}
            aria-label="Fixed object value (JSON)"
            rows={4}
          />
        );
      case 'text':
      default:
        return (
          <input
            type="text"
            data-part="fixed-text"
            defaultValue={value}
            aria-label="Fixed text value"
          />
        );
    }
  }

  return (
    <div
      role="group"
      aria-label="Expression toggle input"
      data-surface-widget=""
      data-widget-name="expression-toggle-input"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* Mode toggle switch */}
      <button
        type="button"
        data-part="mode-toggle"
        role="switch"
        aria-label="Expression mode"
        aria-checked={isExpressionMode}
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
            data-part="expression-textarea"
            role="textbox"
            aria-label="Expression editor"
            defaultValue={expression}
            rows={3}
            spellCheck={false}
          />
        )}
      </div>

      {/* Autocomplete dropdown (static placeholder) */}
      <div
        data-part="autocomplete"
        data-visible="false"
        role="listbox"
        aria-label="Variable suggestions"
      >
        {variables.map((variable) => (
          <div
            key={variable}
            data-part="autocomplete-item"
            role="option"
            aria-selected={false}
            data-focused="false"
          >
            {variable}
          </div>
        ))}
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
        {isExpressionMode && previewValue === undefined && expression && (
          <span data-part="preview-placeholder">Enter expression to preview</span>
        )}
      </div>

      {children}
    </div>
  );
}

export { ExpressionToggleInput };
