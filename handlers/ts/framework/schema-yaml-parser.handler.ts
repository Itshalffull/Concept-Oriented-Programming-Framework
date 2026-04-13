// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SchemaYamlParser — Provider on SpecParser concept
//
// Parses schema.yaml files that map concept state fields to
// ContentNode Schema Properties. Validates field types against
// TypeSystem, validates primary_set references, manifest values,
// and produces structured intermediate representations consumed
// by ConceptBrowser and the shared pool provider.
//
// See Architecture doc Sections 2.1.1, 3.1.1
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { parse as parseYaml } from 'yaml';

type Result = { variant: string; [key: string]: unknown };

/** Valid TypeSystem field types (Section 2.4.2) */
const VALID_FIELD_TYPES = new Set([
  'String', 'RichText', 'Int', 'Float', 'Decimal', 'Boolean', 'Bool',
  'Date', 'DateTime', 'Enum', 'Reference', 'File', 'Image',
  'Color', 'URL', 'Email', 'Geo', 'JSON', 'Formula', 'Bytes',
  'list String', 'list Reference', 'list Int', 'list Float',
  'option String', 'option Reference', 'option Int',
]);

/** Valid manifest placements */
const VALID_MANIFESTS = new Set(['content', 'config']);

/** Valid mutability values (Section 2.4.1) */
const VALID_MUTABILITIES = new Set(['editable', 'readonly', 'system']);

/** Valid removal policies (Section 2.4.2) */
const VALID_REMOVAL_POLICIES = new Set(['detach', 'prevent', 'cascade']);

/** Valid hook names (Section 2.1.3) */
const VALID_HOOKS = new Set(['on_save', 'on_apply', 'on_remove', 'on_delete']);

export interface SchemaFieldDef {
  name: string;
  from?: string;
  type?: string;
  mutability?: string;
  required?: boolean;
  cardinality?: number | 'unlimited';
  default?: string;
  unique_within_schema?: boolean;
  target_schema?: string;
  target_vocabulary?: string;
  hidden?: boolean;
}

export interface SchemaHooks {
  on_save?: string;
  on_apply?: string;
  on_remove?: string;
  on_delete?: string;
}

export interface SchemaDef {
  name: string;
  concept?: string;
  primary_set?: string;
  manifest: string;
  extends?: string;
  includes?: string[];
  fields: Record<string, SchemaFieldDef>;
  hooks?: SchemaHooks;
  constraints?: {
    unique?: string[][];
    required_schemas?: string[];
    incompatible_schemas?: string[];
    max_instances?: number | null;
    max_per_user?: number | null;
  };
  removal?: {
    policy?: string;
    warn?: boolean;
  };
}

export interface SchemaYamlParseResult {
  schemas: SchemaDef[];
  errors: Array<{ message: string; path: string }>;
}

/**
 * Parse a raw YAML object (already deserialized) into validated SchemaDefs.
 */
export function parseSchemaYaml(raw: Record<string, unknown>): SchemaYamlParseResult {
  const errors: Array<{ message: string; path: string }> = [];
  const schemas: SchemaDef[] = [];

  if (!raw || typeof raw !== 'object') {
    errors.push({ message: 'schema.yaml must be a YAML object', path: '' });
    return { schemas, errors };
  }

  const schemasRaw = raw.schemas as Record<string, unknown> | undefined;
  if (!schemasRaw || typeof schemasRaw !== 'object') {
    errors.push({ message: 'schema.yaml must have a top-level "schemas" key', path: '' });
    return { schemas, errors };
  }

  for (const [schemaName, schemaDef] of Object.entries(schemasRaw)) {
    if (!schemaDef || typeof schemaDef !== 'object') {
      errors.push({ message: `Schema "${schemaName}" must be an object`, path: `schemas.${schemaName}` });
      continue;
    }

    const def = schemaDef as Record<string, unknown>;
    const path = `schemas.${schemaName}`;

    const manifest = def.manifest as string | undefined;
    if (!manifest) {
      errors.push({ message: `Schema "${schemaName}" must declare a "manifest" (content or config)`, path });
      continue;
    }
    if (!VALID_MANIFESTS.has(manifest)) {
      errors.push({ message: `Schema "${schemaName}" has invalid manifest "${manifest}". Must be "content" or "config"`, path: `${path}.manifest` });
    }

    const fieldsRaw = def.fields as Record<string, unknown> | undefined;
    const parsedFields: Record<string, SchemaFieldDef> = {};

    if (fieldsRaw && typeof fieldsRaw === 'object') {
      for (const [fieldName, fieldDef] of Object.entries(fieldsRaw)) {
        if (!fieldDef || typeof fieldDef !== 'object') {
          errors.push({ message: `Field "${fieldName}" must be an object`, path: `${path}.fields.${fieldName}` });
          continue;
        }
        const fd = fieldDef as Record<string, unknown>;
        const parsed: SchemaFieldDef = { name: fieldName };

        if (fd.from !== undefined) {
          parsed.from = fd.from as string;
        }
        if (fd.type !== undefined) {
          const fieldType = fd.type as string;
          if (!VALID_FIELD_TYPES.has(fieldType) && !fieldType.startsWith('list ') && !fieldType.startsWith('option ')) {
            errors.push({ message: `Field "${fieldName}" has unknown type "${fieldType}"`, path: `${path}.fields.${fieldName}.type` });
          }
          parsed.type = fieldType;
        }
        if (fd.mutability !== undefined) {
          if (!VALID_MUTABILITIES.has(fd.mutability as string)) {
            errors.push({ message: `Field "${fieldName}" has invalid mutability "${fd.mutability}"`, path: `${path}.fields.${fieldName}.mutability` });
          }
          parsed.mutability = fd.mutability as string;
        }

        if (!parsed.from && !parsed.type && def.concept) {
          errors.push({ message: `Field "${fieldName}" on concept-mapped schema must have "from" or "type"`, path: `${path}.fields.${fieldName}` });
        }

        if (fd.required !== undefined) parsed.required = fd.required as boolean;
        if (fd.cardinality !== undefined) parsed.cardinality = fd.cardinality as number | 'unlimited';
        if (fd.default !== undefined) parsed.default = fd.default as string;
        if (fd.unique_within_schema !== undefined) parsed.unique_within_schema = fd.unique_within_schema as boolean;
        if (fd.target_schema !== undefined) parsed.target_schema = fd.target_schema as string;
        if (fd.target_vocabulary !== undefined) parsed.target_vocabulary = fd.target_vocabulary as string;
        if (fd.hidden !== undefined) parsed.hidden = fd.hidden as boolean;

        parsedFields[fieldName] = parsed;
      }
    }

    const hooksRaw = def.hooks as Record<string, unknown> | undefined;
    let parsedHooks: SchemaHooks | undefined;
    if (hooksRaw && typeof hooksRaw === 'object') {
      if (!def.concept) {
        errors.push({ message: `Schema "${schemaName}" declares hooks but has no associated concept`, path: `${path}.hooks` });
      }
      parsedHooks = {};
      for (const [hookName, hookAction] of Object.entries(hooksRaw)) {
        if (!VALID_HOOKS.has(hookName)) {
          errors.push({ message: `Unknown hook "${hookName}". Valid hooks: ${[...VALID_HOOKS].join(', ')}`, path: `${path}.hooks.${hookName}` });
          continue;
        }
        if (typeof hookAction !== 'string' || !hookAction.includes('/')) {
          errors.push({ message: `Hook "${hookName}" must be a Concept/action string (e.g., "MediaAsset/processIfNeeded")`, path: `${path}.hooks.${hookName}` });
          continue;
        }
        (parsedHooks as Record<string, string>)[hookName] = hookAction as string;
      }
    }

    const includes = def.includes as string[] | undefined;
    if (includes && !Array.isArray(includes)) {
      errors.push({ message: `Schema "${schemaName}" includes must be an array`, path: `${path}.includes` });
    }

    const constraintsRaw = def.constraints as Record<string, unknown> | undefined;
    let parsedConstraints: SchemaDef['constraints'] | undefined;
    if (constraintsRaw && typeof constraintsRaw === 'object') {
      parsedConstraints = {};
      if (constraintsRaw.unique) parsedConstraints.unique = constraintsRaw.unique as string[][];
      if (constraintsRaw.required_schemas) parsedConstraints.required_schemas = constraintsRaw.required_schemas as string[];
      if (constraintsRaw.incompatible_schemas) parsedConstraints.incompatible_schemas = constraintsRaw.incompatible_schemas as string[];
      if (constraintsRaw.max_instances !== undefined) parsedConstraints.max_instances = constraintsRaw.max_instances as number | null;
      if (constraintsRaw.max_per_user !== undefined) parsedConstraints.max_per_user = constraintsRaw.max_per_user as number | null;
    }

    const removalRaw = def.removal as Record<string, unknown> | undefined;
    let parsedRemoval: SchemaDef['removal'] | undefined;
    if (removalRaw && typeof removalRaw === 'object') {
      parsedRemoval = {};
      if (removalRaw.policy) {
        if (!VALID_REMOVAL_POLICIES.has(removalRaw.policy as string)) {
          errors.push({ message: `Invalid removal policy "${removalRaw.policy}". Must be detach, prevent, or cascade`, path: `${path}.removal.policy` });
        }
        parsedRemoval.policy = removalRaw.policy as string;
      }
      if (removalRaw.warn !== undefined) parsedRemoval.warn = removalRaw.warn as boolean;
    }

    schemas.push({
      name: schemaName,
      concept: def.concept as string | undefined,
      primary_set: def.primary_set as string | undefined,
      manifest: manifest || 'content',
      extends: def.extends as string | undefined,
      includes: Array.isArray(includes) ? includes : undefined,
      fields: parsedFields,
      hooks: parsedHooks,
      constraints: parsedConstraints,
      removal: parsedRemoval,
    });
  }

  const schemaNames = new Set(schemas.map(s => s.name));
  for (const schema of schemas) {
    if (schema.includes) {
      for (const inc of schema.includes) {
        if (!schemaNames.has(inc)) {
          errors.push({
            message: `Schema "${schema.name}" includes "${inc}" which is not defined in this file`,
            path: `schemas.${schema.name}.includes`,
          });
        }
      }
    }
  }

  return { schemas, errors };
}

/**
 * Parse a schema.yaml source string. Wraps parseSchemaYaml with a YAML
 * deserialization step so callers (e.g. the clef-framework-parse meta
 * provider, VPR-09) can pass raw file text.
 */
export function parseSchemaYamlSource(source: string): SchemaYamlParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      schemas: [],
      errors: [{ message: `YAML parse error: ${message}`, path: '' }],
    };
  }
  return parseSchemaYaml((raw ?? {}) as Record<string, unknown>);
}

let counter = 0;
export function resetSchemaYamlParserCounter(): void { counter = 0; }

const _handler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      const p = createProgram();
      return complete(p, 'error', { message: 'source must be a parsed YAML object', errors: [] }) as StorageProgram<Result>;
    }

    const result = parseSchemaYaml(source);

    if (result.errors.length > 0) {
      const p = createProgram();
      return complete(p, 'error', {
        message: `schema.yaml has ${result.errors.length} validation error(s)`,
        errors: result.errors,
      }) as StorageProgram<Result>;
    }

    const id = `schema-yaml-${++counter}`;
    let p = createProgram();
    p = put(p, 'parsed_schemas', id, {
      id,
      schemas: result.schemas,
    });

    return complete(p, 'ok', { id, schemas: result.schemas }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      const p = createProgram();
      return complete(p, 'error', { message: 'source must be a parsed YAML object', errors: [] }) as StorageProgram<Result>;
    }

    const result = parseSchemaYaml(source);

    if (result.errors.length > 0) {
      const p = createProgram();
      return complete(p, 'invalid', { errors: result.errors }) as StorageProgram<Result>;
    }

    const p = createProgram();
    return complete(p, 'ok', { schema_count: result.schemas.length }) as StorageProgram<Result>;
  },

  scaffold(input: Record<string, unknown>) {
    const conceptName = input.concept_name as string | undefined;
    const fields = input.fields as string[] | undefined;
    const manifest = (input.manifest as string) || 'content';

    if (!conceptName) {
      const p = createProgram();
      return complete(p, 'error', { message: 'concept_name is required' }) as StorageProgram<Result>;
    }

    const schemaName = conceptName;
    const fieldEntries: Record<string, { from: string }> = {};
    if (fields && Array.isArray(fields)) {
      for (const f of fields) {
        fieldEntries[f] = { from: f };
      }
    }

    const scaffold = {
      schemas: {
        [schemaName]: {
          concept: conceptName,
          primary_set: 'items',
          manifest,
          fields: fieldEntries,
        },
      },
    };

    const p = createProgram();
    return complete(p, 'ok', { scaffold }) as StorageProgram<Result>;
  },
};

export const schemaYamlParserHandler = autoInterpret(_handler);
