'use client';

// ============================================================
// UISchemaForm — Next.js client component that, given a
// UISchema, renders a complete auto-generated form using
// ElementRenderer for each field.
//
// Supports "create" and "edit" views. Field values are managed
// internally via useState; changes can be observed via an
// onChange callback or submitted via onSubmit.
//
// 'use client' required for form state management and event
// handlers. Functional component only — no classes.
// ============================================================

import {
  useState,
  useCallback,
  useMemo,
  type FormEvent,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type {
  UISchema,
  UISchemaField,
  UISchemaView,
  ElementConfig,
  ElementKind,
} from '../../shared/types.js';
import { ElementRenderer } from './ElementRenderer.js';

// --------------- Props ---------------

export interface UISchemaFormProps {
  /** The Clef Surface UI schema describing the concept's presentation. */
  readonly schema: UISchema;
  /**
   * Which view to render.
   * @default "create"
   */
  readonly view?: 'create' | 'edit' | 'list' | 'detail';
  /** Initial field values (keyed by field name). */
  readonly initialValues?: Record<string, unknown>;
  /** Called on every field change. */
  readonly onChange?: (values: Record<string, unknown>) => void;
  /** Called when the form is submitted. */
  readonly onSubmit?: (values: Record<string, unknown>) => void;
  /** Called when the user cancels/resets. */
  readonly onCancel?: () => void;
  /** Whether the entire form is disabled. */
  readonly disabled?: boolean;
  /** Whether the entire form is read-only (useful for "detail" view). */
  readonly readOnly?: boolean;
  /** Submit button label. @default "Submit" */
  readonly submitLabel?: string;
  /** Cancel button label. @default "Cancel" */
  readonly cancelLabel?: string;
  /** Hide the action buttons (submit/cancel). */
  readonly hideActions?: boolean;
  /** Additional class name. */
  readonly className?: string;
  /** Additional inline styles. */
  readonly style?: CSSProperties;
  /**
   * Custom field renderer override. When provided, called for
   * each field instead of the default ElementRenderer.
   */
  readonly renderField?: (
    field: UISchemaField,
    value: unknown,
    onChange: (value: unknown) => void,
    elementConfig: ElementConfig
  ) => ReactNode;
}

// --------------- Helpers ---------------

/**
 * Convert a UISchemaField to an ElementConfig that
 * ElementRenderer understands.
 */
const fieldToElementConfig = (field: UISchemaField): ElementConfig => ({
  id: field.name,
  kind: field.element as ElementKind,
  label: field.label,
  dataType: field.dataType,
  required: field.required,
  constraints: field.constraints as Record<string, unknown> | undefined,
});

/**
 * Derive selection options from field constraints for
 * selection-single / selection-multi elements.
 */
const getFieldOptions = (
  field: UISchemaField
): Array<{ label: string; value: string }> | undefined => {
  const opts = field.constraints?.options;
  if (!opts || !Array.isArray(opts)) return undefined;

  return opts.map((opt: unknown) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    if (typeof opt === 'object' && opt !== null) {
      const o = opt as Record<string, unknown>;
      return {
        label: String(o.label ?? o.value ?? ''),
        value: String(o.value ?? o.label ?? ''),
      };
    }
    return { label: String(opt), value: String(opt) };
  });
};

/**
 * Validate a set of values against the schema fields.
 * Returns a map of field name -> error message.
 */
const validateFields = (
  fields: UISchemaField[],
  values: Record<string, unknown>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.name];

    // Required check
    if (field.required) {
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        errors[field.name] = `${field.label} is required.`;
        continue;
      }
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') continue;

    const constraints = field.constraints as Record<string, unknown> | undefined;
    if (!constraints) continue;

    // String length constraints
    if (typeof value === 'string') {
      if (
        constraints.minLength !== undefined &&
        value.length < (constraints.minLength as number)
      ) {
        errors[field.name] =
          `${field.label} must be at least ${constraints.minLength} characters.`;
      }
      if (
        constraints.maxLength !== undefined &&
        value.length > (constraints.maxLength as number)
      ) {
        errors[field.name] =
          `${field.label} must be at most ${constraints.maxLength} characters.`;
      }
      if (constraints.pattern !== undefined) {
        const regex = new RegExp(constraints.pattern as string);
        if (!regex.test(value)) {
          errors[field.name] =
            `${field.label} does not match the required pattern.`;
        }
      }
    }

    // Numeric range constraints
    if (typeof value === 'number') {
      if (constraints.min !== undefined && value < (constraints.min as number)) {
        errors[field.name] = `${field.label} must be at least ${constraints.min}.`;
      }
      if (constraints.max !== undefined && value > (constraints.max as number)) {
        errors[field.name] = `${field.label} must be at most ${constraints.max}.`;
      }
    }
  }

  return errors;
};

// --------------- Component ---------------

export const UISchemaForm = ({
  schema,
  view = 'create',
  initialValues = {},
  onChange,
  onSubmit,
  onCancel,
  disabled = false,
  readOnly = false,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  hideActions = false,
  className,
  style,
  renderField,
}: UISchemaFormProps): ReactNode => {
  // --- Resolve the active view ---
  const activeView = useMemo<UISchemaView | null>(() => {
    const viewConfig = schema.views[view];
    if (viewConfig) return viewConfig;

    // Fallback chain: edit -> create -> detail -> list
    const fallbacks: Array<keyof typeof schema.views> = ['edit', 'create', 'detail', 'list'];
    for (const fb of fallbacks) {
      if (schema.views[fb]) return schema.views[fb]!;
    }
    return null;
  }, [schema, view]);

  // --- Form state ---
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    if (activeView) {
      for (const field of activeView.fields) {
        init[field.name] = initialValues[field.name] ?? '';
      }
    }
    return init;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleFieldChange = useCallback(
    (fieldId: string, value: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [fieldId]: value };
        onChange?.(next);
        return next;
      });

      // Clear field error on change
      setErrors((prev) => {
        if (!prev[fieldId]) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [onChange]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);

      if (!activeView) return;

      const validationErrors = validateFields(activeView.fields, values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});
      onSubmit?.(values);
    },
    [activeView, values, onSubmit]
  );

  const handleCancel = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setSubmitted(false);
    onCancel?.();
  }, [initialValues, onCancel]);

  // Determine if the view is read-only by nature
  const isReadOnly = readOnly || view === 'detail' || view === 'list';

  if (!activeView) {
    return (
      <div
        data-surface-form=""
        data-surface-adapter="nextjs"
        data-form-error="no-view"
        className={className}
        style={style}
      >
        <p>No view &ldquo;{view}&rdquo; defined for concept &ldquo;{schema.concept}&rdquo;.</p>
      </div>
    );
  }

  return (
    <form
      className={className}
      style={style}
      data-surface-form=""
      data-surface-adapter="nextjs"
      data-form-view={view}
      data-form-concept={schema.concept}
      onSubmit={handleSubmit}
      noValidate
    >
      {activeView.fields.map((field) => {
        const elementConfig = fieldToElementConfig(field);
        const fieldValue = values[field.name];
        const fieldError = errors[field.name];
        const fieldOptions = getFieldOptions(field);

        const fieldOnChange = (val: unknown) =>
          handleFieldChange(field.name, val);

        // Custom renderer override
        if (renderField) {
          return (
            <div
              key={field.name}
              data-surface-form-field=""
              data-field-name={field.name}
              data-field-error={fieldError ? '' : undefined}
            >
              {renderField(field, fieldValue, fieldOnChange, elementConfig)}
              {fieldError && (
                <span
                  data-surface-form-error=""
                  role="alert"
                  style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.85em' }}
                >
                  {fieldError}
                </span>
              )}
            </div>
          );
        }

        return (
          <div
            key={field.name}
            data-surface-form-field=""
            data-field-name={field.name}
            data-field-error={fieldError ? '' : undefined}
            style={{ marginBottom: '12px' }}
          >
            <ElementRenderer
              element={elementConfig}
              value={fieldValue}
              onChange={(_, val) => handleFieldChange(field.name, val)}
              options={fieldOptions}
              disabled={disabled}
              readOnly={isReadOnly}
            />
            {fieldError && (
              <span
                data-surface-form-error=""
                role="alert"
                style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.85em' }}
              >
                {fieldError}
              </span>
            )}
          </div>
        );
      })}

      {!hideActions && !isReadOnly && (
        <div data-surface-form-actions="" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            type="submit"
            disabled={disabled}
            data-surface-form-submit=""
          >
            {submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={disabled}
              data-surface-form-cancel=""
            >
              {cancelLabel}
            </button>
          )}
        </div>
      )}
    </form>
  );
};

UISchemaForm.displayName = 'UISchemaForm';
export default UISchemaForm;
