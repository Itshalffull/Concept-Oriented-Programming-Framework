// ============================================================
// Clef Surface Ink Widget — UISchemaForm
//
// Terminal form renderer driven by Clef Surface UISchema using
// Ink. Generates labeled inputs, selection prompts, and submit
// handling from schema definitions. Manages focus traversal,
// validation, and value collection across form fields.
// ============================================================

import React, { useState, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
} from '../../shared/types.js';
import { ElementRenderer, type ElementRendererProps } from './ElementRenderer.js';

// --------------- Props ---------------

export interface UISchemaFormProps {
  /** Clef Surface UI Schema definition. */
  schema: UISchema;
  /** Which view to render. */
  viewName?: 'list' | 'detail' | 'create' | 'edit';
  /** Current form values. */
  values?: Record<string, unknown>;
  /** Validation errors keyed by field name. */
  errors?: Record<string, string>;
  /** Width in columns. */
  width?: number;
  /** Title override. */
  title?: string;
  /** Whether to show the submit button. */
  showSubmit?: boolean;
  /** Submit button label. */
  submitLabel?: string;
  /** Whether to show field indices. */
  showFieldNumbers?: boolean;
  /** Options for selection fields, keyed by field name. */
  fieldOptions?: Record<string, Array<{ label: string; value: string }>>;
  /** Accent color. */
  accentColor?: string;
  /** Whether this component is focused. */
  isFocused?: boolean;
  /** Callback on form submit. */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Callback on field value change. */
  onChange?: (fieldName: string, value: unknown) => void;
  /** Validator function. */
  onValidate?: (fieldName: string, value: unknown) => string | undefined;
}

// --------------- Component ---------------

export const UISchemaForm: React.FC<UISchemaFormProps> = ({
  schema,
  viewName = 'create',
  values: initialValues = {},
  errors: initialErrors = {},
  width = 50,
  title,
  showSubmit = true,
  submitLabel = 'Submit',
  showFieldNumbers = false,
  fieldOptions = {},
  accentColor = 'cyan',
  isFocused = true,
  onSubmit,
  onChange,
  onValidate,
}) => {
  const view = schema.views[viewName];
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!view) {
    return (
      <Box>
        <Text color="red">
          View "{viewName}" not found in schema for {schema.concept}
        </Text>
      </Box>
    );
  }

  const totalItems = view.fields.length + (showSubmit ? 1 : 0);

  const validateAll = useCallback((): boolean => {
    let valid = true;
    const newErrors: Record<string, string> = {};

    for (const field of view.fields) {
      if (field.required) {
        const value = values[field.name];
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label} is required`;
          valid = false;
          continue;
        }
      }
      if (onValidate) {
        const error = onValidate(field.name, values[field.name]);
        if (error) {
          newErrors[field.name] = error;
          valid = false;
        }
      }
    }

    setErrors(newErrors);
    return valid;
  }, [view.fields, values, onValidate]);

  useInput(
    (input, key) => {
      if (submitting) return;

      if (key.tab || key.downArrow) {
        setFocusedIndex((i) => (i + 1) % totalItems);
      } else if (key.upArrow) {
        setFocusedIndex((i) => (i - 1 + totalItems) % totalItems);
      } else if (key.return && focusedIndex === view.fields.length) {
        // Submit button
        if (validateAll()) {
          setSubmitting(true);
          onSubmit?.({ ...values });
        }
      } else if (focusedIndex < view.fields.length) {
        // Delegate to focused field
        const field = view.fields[focusedIndex];
        handleFieldInput(field, input, key);
      }
    },
    { isActive: isFocused },
  );

  const handleFieldInput = useCallback(
    (field: UISchemaField, input: string, key: any) => {
      switch (field.element) {
        case 'input-bool': {
          if (input === ' ') {
            const newVal = !values[field.name];
            setValues((v) => ({ ...v, [field.name]: newVal }));
            onChange?.(field.name, newVal);
          }
          break;
        }
        case 'input-number': {
          const num = Number(values[field.name]) || 0;
          if (key.upArrow || key.rightArrow) {
            setValues((v) => ({ ...v, [field.name]: num + 1 }));
            onChange?.(field.name, num + 1);
          } else if (key.downArrow || key.leftArrow) {
            setValues((v) => ({ ...v, [field.name]: num - 1 }));
            onChange?.(field.name, num - 1);
          }
          break;
        }
        case 'input-text': {
          if (input.length === 1 && input >= ' ') {
            const current = String(values[field.name] || '');
            const newVal = current + input;
            setValues((v) => ({ ...v, [field.name]: newVal }));
            onChange?.(field.name, newVal);
          } else if (key.backspace || key.delete) {
            const current = String(values[field.name] || '');
            const newVal = current.slice(0, -1);
            setValues((v) => ({ ...v, [field.name]: newVal }));
            onChange?.(field.name, newVal);
          }
          break;
        }
      }
    },
    [values, onChange],
  );

  const formTitle = title || `${schema.concept} - ${view.name}`;
  const innerWidth = width - 4;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      width={width}
      paddingX={1}
    >
      {/* Header */}
      <Text bold color={accentColor}>{formTitle}</Text>

      {/* Fields */}
      {view.fields.map((field, i) => {
        const isFocused = i === focusedIndex;

        return (
          <React.Fragment key={field.name}>
            {i > 0 && <Text dimColor>├{'─'.repeat(innerWidth)}┤</Text>}
            <Box>
              {showFieldNumbers && (
                <Text dimColor>{String(i + 1).padStart(2)} </Text>
              )}
              <ElementRenderer
                element={{
                  id: `${schema.concept}-${field.name}`,
                  kind: field.element,
                  label: field.label,
                  dataType: field.dataType,
                  required: field.required,
                  constraints: field.constraints,
                }}
                value={values[field.name]}
                focused={isFocused}
                error={errors[field.name]}
                options={fieldOptions[field.name]}
                width={innerWidth}
              />
            </Box>
          </React.Fragment>
        );
      })}

      {/* Submit */}
      {showSubmit && (
        <>
          <Text dimColor>├{'─'.repeat(innerWidth)}┤</Text>
          <Box>
            {submitting ? (
              <Text color="yellow">◔ Submitting...</Text>
            ) : (
              <Text
                inverse={focusedIndex === view.fields.length}
                bold
              >
                [ ⏎ {submitLabel} ]
              </Text>
            )}
            {Object.keys(errors).length > 0 && (
              <Text color="red">
                {'  '}{Object.keys(errors).length} error
                {Object.keys(errors).length > 1 ? 's' : ''}
              </Text>
            )}
          </Box>
          <Text dimColor>Tab: next field  Shift+Tab: prev  Enter: submit</Text>
        </>
      )}
    </Box>
  );
};

UISchemaForm.displayName = 'UISchemaForm';
export default UISchemaForm;
