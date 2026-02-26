// ============================================================
// Clef Surface Ink Widget — UISchemaForm
//
// Terminal form renderer driven by Clef Surface UISchema. Generates
// labeled inputs, selection prompts, and submit handling
// from schema definitions. Manages focus traversal, validation,
// and value collection across form fields.
// ============================================================

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
  ElementKind,
} from '../../shared/types.js';

import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';
import {
  createElementRenderer,
  type ElementRendererProps,
} from './ElementRenderer.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';
const ANSI_GREEN_FG = '\x1b[32m';
const ANSI_RED_FG = '\x1b[31m';
const ANSI_YELLOW_FG = '\x1b[33m';
const ANSI_CYAN_FG = '\x1b[36m';

// --- Border Characters ---

const BORDER = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', vertical: '\u2502',
  teeLeft: '\u251c', teeRight: '\u2524',
};

const DOUBLE_BORDER = {
  topLeft: '\u2554', topRight: '\u2557',
  bottomLeft: '\u255a', bottomRight: '\u255d',
  horizontal: '\u2550', vertical: '\u2551',
};

// --- UISchemaForm Props ---

export interface UISchemaFormProps {
  /** Clef Surface UI Schema definition. */
  schema: UISchema;
  /** Which view to render (list, detail, create, edit). */
  viewName?: 'list' | 'detail' | 'create' | 'edit';
  /** Current form values. */
  values?: Record<string, unknown>;
  /** Validation errors keyed by field name. */
  errors?: Record<string, string>;
  /** Currently focused field index. */
  focusedIndex?: number;
  /** Width in columns. */
  width?: number;
  /** Title override. */
  title?: string;
  /** Whether to show the submit button. */
  showSubmit?: boolean;
  /** Submit button label. */
  submitLabel?: string;
  /** Whether the form is in a submitting state. */
  submitting?: boolean;
  /** Whether to show field indices for keyboard navigation. */
  showFieldNumbers?: boolean;
  /** Options for selection fields, keyed by field name. */
  fieldOptions?: Record<string, Array<{ label: string; value: string }>>;
  /** Accent color (hex). */
  accentColor?: string;
}

/**
 * Creates a UISchemaForm terminal node.
 *
 * Renders a complete form from Clef Surface UISchema definition
 * with labeled inputs, validation display, and submit action.
 */
export function createUISchemaForm(props: UISchemaFormProps): TerminalNode {
  const {
    schema,
    viewName = 'create',
    values = {},
    errors = {},
    focusedIndex = -1,
    width = 50,
    title,
    showSubmit = true,
    submitLabel = 'Submit',
    submitting = false,
    showFieldNumbers = false,
    fieldOptions = {},
    accentColor,
  } = props;

  const view = schema.views[viewName];
  if (!view) {
    return {
      type: 'box',
      props: { role: 'ui-schema-form', error: true },
      children: [{
        type: 'text',
        props: {},
        children: [`${ANSI_RED_FG}View "${viewName}" not found in schema for ${schema.concept}${ANSI_RESET}`],
      }],
    };
  }

  const accentAnsi = accentColor ? hexToAnsiFg(accentColor) : ANSI_CYAN_FG;
  const innerWidth = width - 4;
  const children: (TerminalNode | string)[] = [];

  // Form header
  const formTitle = title || `${schema.concept} - ${view.name}`;
  const headerLine = `${DOUBLE_BORDER.topLeft}${DOUBLE_BORDER.horizontal.repeat(2)} ${accentAnsi}${ANSI_BOLD}${formTitle}${ANSI_RESET} ${DOUBLE_BORDER.horizontal.repeat(Math.max(1, innerWidth - formTitle.length - 3))}${DOUBLE_BORDER.topRight}`;
  children.push({
    type: 'text',
    props: { role: 'form-header' },
    children: [headerLine],
  });

  // Render each field
  for (let i = 0; i < view.fields.length; i++) {
    const field = view.fields[i];
    const isFocused = i === focusedIndex;
    const fieldValue = values[field.name];
    const fieldError = errors[field.name];
    const options = fieldOptions[field.name];

    // Field number prefix
    const numberPrefix = showFieldNumbers
      ? `${ANSI_DIM}${(i + 1).toString().padStart(2)}${ANSI_RESET} `
      : '';

    // Separator between fields
    if (i > 0) {
      children.push({
        type: 'text',
        props: {},
        children: [`${ANSI_DIM}${BORDER.teeLeft}${BORDER.horizontal.repeat(innerWidth + 2)}${BORDER.teeRight}${ANSI_RESET}`],
      });
    }

    // Render the field using ElementRenderer
    const elementProps: ElementRendererProps = {
      element: {
        id: `${schema.concept}-${field.name}`,
        kind: field.element,
        label: field.label,
        dataType: field.dataType,
        required: field.required,
        constraints: field.constraints,
      },
      value: fieldValue,
      focused: isFocused,
      error: fieldError,
      options,
      width: innerWidth,
    };

    const fieldNode = createElementRenderer(elementProps);

    children.push({
      type: 'box',
      props: {
        role: 'form-field',
        fieldName: field.name,
        fieldIndex: i,
        focused: isFocused,
        prefixStr: `${DOUBLE_BORDER.vertical} `,
        suffixStr: ` ${DOUBLE_BORDER.vertical}`,
      },
      children: [
        typeof numberPrefix === 'string' && numberPrefix
          ? { type: 'text', props: {}, children: [numberPrefix] }
          : '',
        fieldNode,
      ].filter(Boolean) as (TerminalNode | string)[],
    });
  }

  // Form footer with submit
  if (showSubmit) {
    children.push({
      type: 'text',
      props: {},
      children: [`${ANSI_DIM}${BORDER.teeLeft}${BORDER.horizontal.repeat(innerWidth + 2)}${BORDER.teeRight}${ANSI_RESET}`],
    });

    const isSubmitFocused = focusedIndex === view.fields.length;
    const submitStyle = isSubmitFocused ? '\x1b[7m' : '';
    const submitIcon = submitting ? '\u25d4' : '\u23ce';

    const submitText = submitting
      ? `${ANSI_YELLOW_FG}${submitIcon} Submitting...${ANSI_RESET}`
      : `${submitStyle}${ANSI_BOLD}[ ${submitIcon} ${submitLabel} ]${ANSI_RESET}`;

    // Error summary
    const errorCount = Object.keys(errors).length;
    const errorSummary = errorCount > 0
      ? `  ${ANSI_RED_FG}${errorCount} error${errorCount > 1 ? 's' : ''}${ANSI_RESET}`
      : '';

    children.push({
      type: 'box',
      props: {
        role: 'form-submit',
        focused: isSubmitFocused,
        prefixStr: `${DOUBLE_BORDER.vertical} `,
        suffixStr: ` ${DOUBLE_BORDER.vertical}`,
      },
      children: [{
        type: 'text',
        props: {},
        children: [`${submitText}${errorSummary}`],
      }],
    });

    // Navigation hints
    children.push({
      type: 'box',
      props: {
        role: 'form-hints',
        prefixStr: `${DOUBLE_BORDER.vertical} `,
        suffixStr: ` ${DOUBLE_BORDER.vertical}`,
      },
      children: [{
        type: 'text',
        props: {},
        children: [`${ANSI_DIM}Tab: next field  Shift+Tab: prev  Enter: submit${ANSI_RESET}`],
      }],
    });
  }

  // Bottom border
  children.push({
    type: 'text',
    props: { role: 'form-footer' },
    children: [`${DOUBLE_BORDER.bottomLeft}${DOUBLE_BORDER.horizontal.repeat(innerWidth + 2)}${DOUBLE_BORDER.bottomRight}`],
  });

  return {
    type: 'box',
    props: {
      role: 'ui-schema-form',
      concept: schema.concept,
      viewName,
      fieldCount: view.fields.length,
      flexDirection: 'column',
      width,
    },
    children,
  };
}

// --- Interactive UISchemaForm ---

export class UISchemaFormInteractive {
  private schema: UISchema;
  private viewName: 'list' | 'detail' | 'create' | 'edit';
  private values: Record<string, unknown>;
  private errors: Record<string, string>;
  private focusedIndex: number;
  private submitting: boolean;
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private onSubmit?: (values: Record<string, unknown>) => void;
  private onValidate?: (field: string, value: unknown) => string | undefined;
  private destroyed = false;
  private props: UISchemaFormProps;

  constructor(
    props: UISchemaFormProps,
    callbacks?: {
      onSubmit?: (values: Record<string, unknown>) => void;
      onValidate?: (field: string, value: unknown) => string | undefined;
    },
  ) {
    this.props = props;
    this.schema = props.schema;
    this.viewName = props.viewName || 'create';
    this.values = { ...(props.values ?? {}) };
    this.errors = { ...(props.errors ?? {}) };
    this.focusedIndex = props.focusedIndex ?? 0;
    this.submitting = props.submitting || false;
    this.onSubmit = callbacks?.onSubmit;
    this.onValidate = callbacks?.onValidate;
  }

  /** Handle keyboard input for form navigation and editing. */
  handleKey(key: string): boolean {
    if (this.destroyed || this.submitting) return false;

    const view = this.schema.views[this.viewName];
    if (!view) return false;

    const totalItems = view.fields.length + (this.props.showSubmit !== false ? 1 : 0);

    switch (key) {
      case 'tab':
      case 'down': {
        this.focusedIndex = (this.focusedIndex + 1) % totalItems;
        this.notify();
        return true;
      }
      case 'shift-tab':
      case 'up': {
        this.focusedIndex = (this.focusedIndex - 1 + totalItems) % totalItems;
        this.notify();
        return true;
      }
      case 'return':
      case 'enter': {
        if (this.focusedIndex === view.fields.length) {
          // Submit button is focused
          this.submit();
          return true;
        }
        return false;
      }
      default: {
        // Delegate to focused field
        return this.handleFieldKey(key);
      }
    }
  }

  /** Get current form values. */
  getValues(): Record<string, unknown> {
    return { ...this.values };
  }

  /** Set a field value programmatically. */
  setValue(fieldName: string, value: unknown): void {
    this.values[fieldName] = value;

    // Run validation if validator is provided
    if (this.onValidate) {
      const error = this.onValidate(fieldName, value);
      if (error) {
        this.errors[fieldName] = error;
      } else {
        delete this.errors[fieldName];
      }
    }

    this.notify();
  }

  /** Get current validation errors. */
  getErrors(): Record<string, string> {
    return { ...this.errors };
  }

  /** Set a validation error for a field. */
  setError(fieldName: string, message: string): void {
    this.errors[fieldName] = message;
    this.notify();
  }

  /** Clear a field's error. */
  clearError(fieldName: string): void {
    delete this.errors[fieldName];
    this.notify();
  }

  /** Get the index of the currently focused field. */
  getFocusedIndex(): number {
    return this.focusedIndex;
  }

  /** Get the name of the currently focused field. */
  getFocusedFieldName(): string | null {
    const view = this.schema.views[this.viewName];
    if (!view || this.focusedIndex >= view.fields.length) return null;
    return view.fields[this.focusedIndex].name;
  }

  /** Focus a specific field by index. */
  focusField(index: number): void {
    const view = this.schema.views[this.viewName];
    if (!view) return;
    const max = view.fields.length + (this.props.showSubmit !== false ? 1 : 0);
    this.focusedIndex = Math.max(0, Math.min(index, max - 1));
    this.notify();
  }

  /** Focus a field by name. */
  focusFieldByName(name: string): void {
    const view = this.schema.views[this.viewName];
    if (!view) return;
    const index = view.fields.findIndex(f => f.name === name);
    if (index >= 0) this.focusField(index);
  }

  /** Validate all fields. Returns true if all valid. */
  validateAll(): boolean {
    const view = this.schema.views[this.viewName];
    if (!view) return true;

    let valid = true;

    for (const field of view.fields) {
      // Check required
      if (field.required) {
        const value = this.values[field.name];
        if (value === undefined || value === null || value === '') {
          this.errors[field.name] = `${field.label} is required`;
          valid = false;
          continue;
        }
      }

      // Run custom validation
      if (this.onValidate) {
        const error = this.onValidate(field.name, this.values[field.name]);
        if (error) {
          this.errors[field.name] = error;
          valid = false;
        } else {
          delete this.errors[field.name];
        }
      }
    }

    this.notify();
    return valid;
  }

  /** Reset the form to initial values. */
  reset(): void {
    this.values = { ...(this.props.values ?? {}) };
    this.errors = {};
    this.focusedIndex = 0;
    this.submitting = false;
    this.notify();
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    return createUISchemaForm({
      ...this.props,
      values: this.values,
      errors: this.errors,
      focusedIndex: this.focusedIndex,
      submitting: this.submitting,
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  private submit(): void {
    if (!this.validateAll()) return;

    this.submitting = true;
    this.notify();

    if (this.onSubmit) {
      this.onSubmit({ ...this.values });
    }
  }

  /** Mark submission as complete. */
  completeSubmit(): void {
    this.submitting = false;
    this.notify();
  }

  private handleFieldKey(key: string): boolean {
    const view = this.schema.views[this.viewName];
    if (!view || this.focusedIndex >= view.fields.length) return false;

    const field = view.fields[this.focusedIndex];

    // Handle based on field element kind
    switch (field.element) {
      case 'input-bool': {
        if (key === 'space') {
          this.values[field.name] = !this.values[field.name];
          this.notify();
          return true;
        }
        return false;
      }
      case 'input-number': {
        const num = Number(this.values[field.name]) || 0;
        if (key === 'up' || key === 'right') {
          this.values[field.name] = num + 1;
          this.notify();
          return true;
        }
        if (key === 'down' || key === 'left') {
          this.values[field.name] = num - 1;
          this.notify();
          return true;
        }
        return false;
      }
      case 'input-text': {
        if (key.length === 1 && key >= ' ') {
          const current = String(this.values[field.name] || '');
          this.values[field.name] = current + key;
          this.notify();
          return true;
        }
        if (key === 'backspace') {
          const current = String(this.values[field.name] || '');
          this.values[field.name] = current.slice(0, -1);
          this.notify();
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  private notify(): void {
    const node = this.render();
    for (const listener of this.listeners) {
      listener(node);
    }
  }
}
