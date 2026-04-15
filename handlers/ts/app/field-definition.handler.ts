// @clef-handler style=functional concept=FieldDefinition
// ============================================================
// FieldDefinition Concept Implementation — Functional (StorageProgram) style
//
// Manages typed field definitions within schemas.
// Each field has an immutable machine ID (fieldId) and a mutable label.
// Storage key: `${schema}::${fieldId}`.
// See Architecture doc §1.1 (schema-editor-plan.md).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  putFrom,
  del,
  complete,
  completeFrom,
  branch,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// --- Valid field types ---

const VALID_FIELD_TYPES = new Set([
  'text', 'number', 'select', 'multi-select', 'date', 'checkbox',
  'person', 'url', 'email', 'file', 'rich-text', 'media', 'relation',
  'formula', 'rollup', 'json', 'created-time', 'created-by', 'auto-number',
]);

// --- Storage record shape ---

interface FieldRecord {
  id: string;
  fieldId: string;
  schema: string;
  label: string;
  description: string;
  fieldType: string;
  cardinality: string;
  typeConfig: string;
  required: boolean;
  unique: boolean;
  validations: string;
  defaultValue: string;
  widget: string;
  formatter: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

function storageKey(schema: string, fieldId: string): string {
  return `${schema}::${fieldId}`;
}

function now(): string {
  return new Date().toISOString();
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'FieldDefinition' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const label = input.label as string;
    const fieldType = input.fieldType as string;
    const cardinality = (input.cardinality as string) || 'single';
    const typeConfig = (input.typeConfig as string) || '{}';
    const required = input.required === true || input.required === 'true';
    const unique = input.unique === true || input.unique === 'true';
    const validations = (input.validations as string) || '[]';
    const defaultValue = (input.defaultValue as string) || '';
    const widget = (input.widget as string) || '';
    const formatter = (input.formatter as string) || '';
    const sortOrder = typeof input.sortOrder === 'number' ? input.sortOrder : parseInt(input.sortOrder as string, 10) || 0;

    if (!VALID_FIELD_TYPES.has(fieldType)) {
      return complete(createProgram(), 'invalid_type', {
        fieldType,
      }) as StorageProgram<Result>;
    }

    const key = storageKey(schema, fieldId);
    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) => complete(b, 'duplicate', { fieldId }),
      // existing == null — store
      (b) => {
        const record: FieldRecord = {
          id: key,
          fieldId,
          schema,
          label,
          description: '',
          fieldType,
          cardinality,
          typeConfig,
          required,
          unique,
          validations,
          defaultValue,
          widget,
          formatter,
          sortOrder,
          createdAt: now(),
          updatedAt: now(),
        };
        const b2 = put(b, 'field', key, record);
        return complete(b2, 'ok', { id: key });
      },
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = putFrom(b, 'field', key, (bindings) => {
          const r = bindings.existing as FieldRecord;
          return {
            ...r,
            label: (input.label as string) ?? r.label,
            description: (input.description as string) ?? r.description,
            required: input.required !== undefined ? (input.required === true || input.required === 'true') : r.required,
            unique: input.unique !== undefined ? (input.unique === true || input.unique === 'true') : r.unique,
            validations: (input.validations as string) ?? r.validations,
            defaultValue: (input.defaultValue as string) ?? r.defaultValue,
            widget: (input.widget as string) ?? r.widget,
            formatter: (input.formatter as string) ?? r.formatter,
            sortOrder: input.sortOrder !== undefined ? (typeof input.sortOrder === 'number' ? input.sortOrder : parseInt(input.sortOrder as string, 10)) : r.sortOrder,
            updatedAt: now(),
          };
        });
        return complete(b2, 'ok', { id: key });
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  changeType(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const newType = input.newType as string;
    const newTypeConfig = (input.newTypeConfig as string) || '{}';
    const migrationStrategy = (input.migrationStrategy as string) || '';

    if (!VALID_FIELD_TYPES.has(newType)) {
      return complete(createProgram(), 'invalid_type', {
        fieldType: newType,
      }) as StorageProgram<Result>;
    }

    const key = storageKey(schema, fieldId);
    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const existingRecord = (b as unknown as { bindings?: Record<string, unknown> })?.bindings;
        // Always return data_loss_warning — the sync layer is responsible for
        // counting actual data before this action is confirmed. The handler
        // signals that a type change is inherently lossy and must be confirmed.
        // If migrationStrategy is "acknowledge", apply the change.
        if (migrationStrategy === 'acknowledge') {
          const b2 = putFrom(b, 'field', key, (bindings) => {
            const r = bindings.existing as FieldRecord;
            return {
              ...r,
              fieldType: newType,
              typeConfig: newTypeConfig,
              updatedAt: now(),
            };
          });
          return complete(b2, 'ok', { id: key });
        }
        // Return warning — caller must retry with migrationStrategy: "acknowledge"
        return complete(b, 'data_loss_warning', {
          affectedCount: 0,
          lossDescription: `Changing field type from existing type to "${newType}" may cause data loss. Retry with migrationStrategy "acknowledge" to proceed.`,
        });
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  rename(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const newLabel = input.newLabel as string;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = putFrom(b, 'field', key, (bindings) => {
          const r = bindings.existing as FieldRecord;
          return { ...r, label: newLabel, updatedAt: now() };
        });
        return complete(b2, 'ok', { id: key });
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = del(b, 'field', key);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  reorder(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const newSortOrder = typeof input.newSortOrder === 'number' ? input.newSortOrder : parseInt(input.newSortOrder as string, 10) || 0;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = putFrom(b, 'field', key, (bindings) => {
          const r = bindings.existing as FieldRecord;
          return { ...r, sortOrder: newSortOrder, updatedAt: now() };
        });
        return complete(b2, 'ok', { id: key });
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const r = bindings.existing as FieldRecord;
          return {
            id: r.id,
            fieldId: r.fieldId,
            schema: r.schema,
            label: r.label,
            description: r.description,
            fieldType: r.fieldType,
            cardinality: r.cardinality,
            typeConfig: r.typeConfig,
            required: r.required,
            unique: r.unique,
            validations: r.validations,
            defaultValue: r.defaultValue,
            widget: r.widget,
            formatter: r.formatter,
            sortOrder: r.sortOrder,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        }),
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = find(p, 'field', {}, 'allFields');
    return completeFrom(p, 'ok', (bindings) => {
      const allFields = (bindings.allFields as FieldRecord[]) ?? [];
      const schemaFields = allFields
        .filter((f) => f.schema === schema)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => ({
          id: f.id,
          fieldId: f.fieldId,
          schema: f.schema,
          label: f.label,
          description: f.description,
          type: f.fieldType,
          fieldType: f.fieldType,
          order: f.sortOrder,
          required: f.required,
          unique: f.unique,
          defaultValue: f.defaultValue,
          typeConfig: f.typeConfig,
          widget: f.widget,
        }));
      return { items: JSON.stringify(schemaFields), fields: '' };
    }) as StorageProgram<Result>;
  },

  promote(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const fieldId = input.fieldId as string;
    const key = storageKey(schema, fieldId);

    let p = createProgram();
    p = get(p, 'field', key, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        // Mark the field as promoted — syncs propagate this to a shared registry
        const b2 = putFrom(b, 'field', key, (bindings) => {
          const r = bindings.existing as FieldRecord;
          return { ...r, promoted: true, updatedAt: now() };
        });
        return complete(b2, 'ok', { id: key });
      },
      (b) => complete(b, 'not_found', { message: `Field "${fieldId}" not found in schema "${schema}"` }),
    ) as StorageProgram<Result>;
  },
};

export const fieldDefinitionHandler = autoInterpret(_handler);
