// UISchema — Data-to-UI control mapping, layout hints, and form layout generation
// Maps concept fields to appropriate UI controls and resolves display configuration.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  UISchemaStorage,
  UISchemaInspectInput,
  UISchemaInspectOutput,
  UISchemaOverrideInput,
  UISchemaOverrideOutput,
  UISchemaGetSchemaInput,
  UISchemaGetSchemaOutput,
  UISchemaGetElementsInput,
  UISchemaGetElementsOutput,
} from './types.js';

import {
  inspectOk,
  inspectParseError,
  overrideOk,
  overrideNotfound,
  overrideInvalid,
  getSchemaOk,
  getSchemaNotfound,
  getElementsOk,
  getElementsNotfound,
} from './types.js';

export interface UISchemaError {
  readonly code: string;
  readonly message: string;
}

export interface UISchemaHandler {
  readonly inspect: (
    input: UISchemaInspectInput,
    storage: UISchemaStorage,
  ) => TE.TaskEither<UISchemaError, UISchemaInspectOutput>;
  readonly override: (
    input: UISchemaOverrideInput,
    storage: UISchemaStorage,
  ) => TE.TaskEither<UISchemaError, UISchemaOverrideOutput>;
  readonly getSchema: (
    input: UISchemaGetSchemaInput,
    storage: UISchemaStorage,
  ) => TE.TaskEither<UISchemaError, UISchemaGetSchemaOutput>;
  readonly getElements: (
    input: UISchemaGetElementsInput,
    storage: UISchemaStorage,
  ) => TE.TaskEither<UISchemaError, UISchemaGetElementsOutput>;
}

// --- Helpers ---

const toError = (error: unknown): UISchemaError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON concept spec and derive field-to-control mappings. */
const deriveUISchemaFromSpec = (
  schemaName: string,
  conceptSpec: string,
): UISchemaInspectOutput => {
  try {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(conceptSpec) as Record<string, unknown>;
    } catch {
      // Non-JSON concept spec: parse as simple concept declaration
      // e.g. "concept Test [T] { state { name: T -> String } }"
      const fields: Record<string, unknown> = {};
      const stateMatch = conceptSpec.match(/state\s*\{([^}]+)\}/);
      if (stateMatch) {
        const stateBody = stateMatch[1];
        const fieldMatches = stateBody.matchAll(/(\w+)\s*:/g);
        for (const m of fieldMatches) {
          fields[m[1]] = { type: 'string' };
        }
      }
      parsed = { fields };
    }
    const fields = (parsed['fields'] ?? parsed['properties'] ?? {}) as Record<string, unknown>;
    const controls: Record<string, string> = {};
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const def = typeof fieldDef === 'object' && fieldDef !== null ? fieldDef as Record<string, unknown> : { type: 'string' };
      const fieldType = String(def['type'] ?? 'string');
      controls[fieldName] = mapFieldTypeToControl(fieldType);
    }
    const uiSchema = JSON.stringify({
      schema: schemaName,
      controls,
      layout: 'vertical',
    });
    return inspectOk(uiSchema);
  } catch {
    return inspectParseError(`Failed to parse concept spec for schema '${schemaName}'`);
  }
};

/** Map a field type string to its default UI control identifier. */
const mapFieldTypeToControl = (fieldType: string): string => {
  switch (fieldType) {
    case 'string': return 'text-input';
    case 'number': case 'integer': return 'number-input';
    case 'boolean': return 'checkbox';
    case 'date': return 'date-picker';
    case 'datetime': return 'datetime-picker';
    case 'enum': return 'select';
    case 'array': return 'multi-select';
    case 'text': case 'richtext': return 'textarea';
    case 'file': return 'file-upload';
    default: return 'text-input';
  }
};

// --- Implementation ---

export const uISchemaHandler: UISchemaHandler = {
  // Inspect a concept spec and derive the UI schema (field-to-control mapping)
  inspect: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const result = deriveUISchemaFromSpec(input.schema, input.conceptSpec);
          if (result.variant === 'ok') {
            // result.schema contains the JSON UI schema string
            const uiSchemaJson = result.schema;
            await storage.put('uischema', input.schema, {
              schema: input.schema,
              uiSchema: uiSchemaJson,
              conceptSpec: input.conceptSpec,
            });
            // Return the schema name, not the JSON string
            return inspectOk(input.schema);
          }
          return result;
        },
        toError,
      ),
    ),

  // Apply overrides to an existing UI schema (e.g., change a field's control type)
  override: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('uischema', input.schema),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(overrideNotfound(`UI schema '${input.schema}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  try {
                    const baseSchema = JSON.parse(String(existing['uiSchema'] ?? '{}'));
                    const overrides = JSON.parse(input.overrides);
                    const merged = { ...baseSchema, ...overrides, controls: { ...baseSchema.controls, ...overrides.controls } };
                    const mergedStr = JSON.stringify(merged);
                    await storage.put('uischema', input.schema, {
                      ...existing,
                      uiSchema: mergedStr,
                    });
                    return overrideOk(mergedStr);
                  } catch {
                    return overrideInvalid(`Override JSON is malformed for schema '${input.schema}'`);
                  }
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Retrieve the stored UI schema for a given schema name
  getSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('uischema', input.schema),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getSchemaNotfound(`UI schema '${input.schema}' not found`)),
            (found) =>
              TE.right(getSchemaOk(
                input.schema,
                String(found['uiSchema'] ?? '{}'),
              )),
          ),
        ),
      ),
    ),

  // Retrieve the ordered UI elements for rendering a form
  getElements: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('uischema', input.schema),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getElementsNotfound(`UI schema '${input.schema}' not found`)),
            (found) => {
              try {
                const uiSchema = JSON.parse(String(found['uiSchema'] ?? '{}'));
                const controls = uiSchema.controls ?? {};
                const elements = Object.entries(controls).map(([field, control]) => ({
                  field,
                  control,
                  order: Object.keys(controls).indexOf(field),
                }));
                return TE.right(getElementsOk(JSON.stringify(elements)));
              } catch {
                return TE.right(getElementsOk('[]'));
              }
            },
          ),
        ),
      ),
    ),
};
