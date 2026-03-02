// ============================================================
// Clef Surface NativeScript Widget — UISchemaForm
//
// Schema-driven form renderer for NativeScript. Generates
// native input fields, labels, and validation from UISchema
// definitions. Manages focus traversal and value collection.
// ============================================================

import {
  StackLayout,
  ScrollView,
  Label,
  Button,
  Color,
} from '@nativescript/core';

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
} from '../../shared/types.js';
import { createElementRenderer } from './ElementRenderer.js';

// --------------- Props ---------------

export interface UISchemaFormProps {
  schema: UISchema;
  viewName?: 'list' | 'detail' | 'create' | 'edit';
  values?: Record<string, unknown>;
  errors?: Record<string, string>;
  width?: number;
  title?: string;
  showSubmit?: boolean;
  submitLabel?: string;
  showFieldNumbers?: boolean;
  fieldOptions?: Record<string, Array<{ label: string; value: string }>>;
  accentColor?: string;
  onSubmit?: (values: Record<string, unknown>) => void;
  onChange?: (fieldName: string, value: unknown) => void;
  onValidate?: (fieldName: string, value: unknown) => string | undefined;
}

// --------------- Component ---------------

export function createUISchemaForm(props: UISchemaFormProps): ScrollView {
  const {
    schema,
    viewName = 'create',
    values: initialValues = {},
    errors: initialErrors = {},
    width,
    title,
    showSubmit = true,
    submitLabel = 'Submit',
    showFieldNumbers = false,
    fieldOptions = {},
    accentColor = '#06b6d4',
    onSubmit,
    onChange,
    onValidate,
  } = props;

  const view = schema.views[viewName];
  const values = { ...initialValues };
  const errors = { ...initialErrors };

  const scrollView = new ScrollView();
  const container = new StackLayout();
  container.className = 'clef-uischema-form';
  container.padding = 8;
  if (width) container.width = width;

  if (!view) {
    const errLabel = new Label();
    errLabel.text = `View "${viewName}" not found in schema for ${schema.concept}`;
    errLabel.color = new Color('#ef4444');
    container.addChild(errLabel);
    scrollView.content = container;
    return scrollView;
  }

  // Title
  if (title || schema.concept) {
    const titleLabel = new Label();
    titleLabel.text = title || `${schema.concept} — ${viewName}`;
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 18;
    titleLabel.color = new Color(accentColor);
    titleLabel.marginBottom = 8;
    container.addChild(titleLabel);
  }

  // Fields
  view.fields.forEach((field: UISchemaField, index: number) => {
    const fieldContainer = new StackLayout();
    fieldContainer.marginBottom = 12;

    // Field number
    if (showFieldNumbers) {
      const numLabel = new Label();
      numLabel.text = `${index + 1}.`;
      numLabel.opacity = 0.5;
      numLabel.fontSize = 11;
      fieldContainer.addChild(numLabel);
    }

    // Map UISchema field to ElementConfig
    const elementConfig = {
      id: field.name,
      kind: mapFieldKind(field) as any,
      label: field.label,
      required: field.required,
      dataType: field.dataType || 'string',
      constraints: field.constraints,
    };

    const element = createElementRenderer({
      element: elementConfig,
      value: values[field.name],
      error: errors[field.name],
      hint: field.hint,
      options: fieldOptions[field.name],
      onChange: (value) => {
        values[field.name] = value;
        onChange?.(field.name, value);
        // Run validation
        if (onValidate) {
          const err = onValidate(field.name, value);
          if (err) {
            errors[field.name] = err;
          } else {
            delete errors[field.name];
          }
        }
      },
    });

    fieldContainer.addChild(element);
    container.addChild(fieldContainer);
  });

  // Submit button
  if (showSubmit) {
    const submitBtn = new Button();
    submitBtn.text = submitLabel;
    submitBtn.className = 'clef-form-submit';
    submitBtn.marginTop = 8;
    submitBtn.on('tap', () => {
      // Validate required fields
      let valid = true;
      for (const field of view.fields) {
        if (field.required) {
          const value = values[field.name];
          if (value === undefined || value === null || value === '') {
            errors[field.name] = `${field.label} is required`;
            valid = false;
          }
        }
        if (onValidate) {
          const err = onValidate(field.name, values[field.name]);
          if (err) {
            errors[field.name] = err;
            valid = false;
          }
        }
      }
      if (valid) {
        onSubmit?.(values);
      }
    });
    container.addChild(submitBtn);
  }

  scrollView.content = container;
  return scrollView;
}

// --------------- Field Kind Mapping ---------------

function mapFieldKind(field: UISchemaField): string {
  const dt = field.dataType || 'string';
  if (field.options && field.options.length > 0) {
    return field.multiple ? 'selection-multi' : 'selection-single';
  }
  switch (dt) {
    case 'boolean': return 'input-bool';
    case 'number':
    case 'integer': return 'input-number';
    case 'date':
    case 'datetime': return 'input-date';
    default: return 'input-text';
  }
}

export default createUISchemaForm;
