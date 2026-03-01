// FormBuilder — handler.ts
// Dynamic form schema generation from concept schema definitions.
// Produces field definitions with widget types, validation rules,
// conditional visibility, and layout hints.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FormBuilderStorage,
  FormBuilderBuildFormInput,
  FormBuilderBuildFormOutput,
} from './types.js';

import {
  buildFormOk,
  buildFormError,
} from './types.js';

export interface FormBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface FormBuilderHandler {
  readonly buildForm: (
    input: FormBuilderBuildFormInput,
    storage: FormBuilderStorage,
  ) => TE.TaskEither<FormBuilderError, FormBuilderBuildFormOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): FormBuilderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Infer the appropriate form widget type from a field's type. */
const inferWidget = (fieldType: string): string => {
  switch (fieldType.toLowerCase()) {
    case 'string':
      return 'textfield';
    case 'text':
    case 'longtext':
      return 'textarea';
    case 'number':
    case 'integer':
    case 'float':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'checkbox';
    case 'date':
      return 'datepicker';
    case 'datetime':
      return 'datetimepicker';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'password':
      return 'password';
    case 'select':
    case 'enum':
      return 'select';
    case 'multiselect':
      return 'multiselect';
    case 'file':
      return 'file_upload';
    case 'image':
      return 'image_upload';
    case 'reference':
    case 'entity_reference':
      return 'autocomplete';
    case 'rich_text':
    case 'html':
      return 'wysiwyg';
    case 'color':
      return 'colorpicker';
    case 'range':
      return 'slider';
    default:
      return 'textfield';
  }
};

/** Build validation rules from field metadata. */
const buildValidation = (
  field: Record<string, unknown>,
): Record<string, unknown> => {
  const rules: Record<string, unknown> = {};

  if (field['required'] === true) {
    rules['required'] = true;
  }

  if (typeof field['minLength'] === 'number') {
    rules['minLength'] = field['minLength'];
  }

  if (typeof field['maxLength'] === 'number') {
    rules['maxLength'] = field['maxLength'];
  }

  if (typeof field['min'] === 'number') {
    rules['min'] = field['min'];
  }

  if (typeof field['max'] === 'number') {
    rules['max'] = field['max'];
  }

  if (typeof field['pattern'] === 'string') {
    rules['pattern'] = field['pattern'];
  }

  return rules;
};

interface FormFieldDefinition {
  readonly name: string;
  readonly label: string;
  readonly widget: string;
  readonly type: string;
  readonly required: boolean;
  readonly validation: Record<string, unknown>;
  readonly defaultValue: unknown;
  readonly weight: number;
  readonly visible: boolean;
  readonly conditions: readonly Record<string, unknown>[];
}

// --- Implementation ---

export const formBuilderHandler: FormBuilderHandler = {
  /**
   * Build a form definition from a schema.
   * Fetches the schema definition, iterates over its fields, and generates
   * a form structure with widget assignments, validation rules, and layout weights.
   * Stores the generated definition for caching (idempotent per invariant).
   */
  buildForm: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        storageErr,
      ),
      TE.chain((schemaRec) =>
        pipe(
          O.fromNullable(schemaRec),
          O.fold(
            () =>
              TE.right(
                buildFormError(
                  `Schema '${input.schema}' not found`,
                ),
              ),
            (found) => {
              // Parse schema fields
              const fieldsRaw = found['fields'];
              let fields: Record<string, Record<string, unknown>>;
              try {
                fields =
                  typeof fieldsRaw === 'string'
                    ? JSON.parse(fieldsRaw)
                    : typeof fieldsRaw === 'object' && fieldsRaw !== null
                      ? (fieldsRaw as Record<string, Record<string, unknown>>)
                      : {};
              } catch {
                return TE.right(
                  buildFormError(
                    `Failed to parse fields from schema '${input.schema}'`,
                  ),
                );
              }

              if (Object.keys(fields).length === 0) {
                return TE.right(
                  buildFormError(
                    `Schema '${input.schema}' has no fields defined`,
                  ),
                );
              }

              // Generate form field definitions
              const formFields: FormFieldDefinition[] = [];
              let weight = 0;

              for (const [fieldName, fieldDef] of Object.entries(fields)) {
                const fieldType = String(fieldDef['type'] ?? 'string');
                const isRequired = fieldDef['required'] === true;
                const label =
                  typeof fieldDef['label'] === 'string'
                    ? fieldDef['label']
                    : fieldName
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (s) => s.toUpperCase())
                        .trim();

                const conditions: readonly Record<string, unknown>[] =
                  Array.isArray(fieldDef['conditions'])
                    ? (fieldDef['conditions'] as readonly Record<
                        string,
                        unknown
                      >[])
                    : [];

                formFields.push({
                  name: fieldName,
                  label,
                  widget: String(fieldDef['widget'] ?? inferWidget(fieldType)),
                  type: fieldType,
                  required: isRequired,
                  validation: buildValidation(fieldDef),
                  defaultValue: fieldDef['default'] ?? null,
                  weight,
                  visible: fieldDef['hidden'] !== true,
                  conditions,
                });

                weight += 1;
              }

              const definition = JSON.stringify({
                formId: input.form,
                schema: input.schema,
                fields: formFields,
                fieldCount: formFields.length,
              });

              // Cache the generated form definition
              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('form_definitions', input.form, {
                      formId: input.form,
                      schema: input.schema,
                      definition,
                      generatedAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => buildFormOk(definition)),
              );
            },
          ),
        ),
      ),
    ),
};
