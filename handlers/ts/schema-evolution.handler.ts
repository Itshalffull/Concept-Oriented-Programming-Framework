// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SchemaEvolution Handler
//
// Manage versioned structural definitions with compatibility
// guarantees. Supports backward, forward, and full compatibility
// modes with upcast transformations between schema versions.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `schema-evolution-${++idCounter}`;
}

const VALID_COMPATIBILITY_MODES = ['backward', 'forward', 'full', 'none'];

interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
}

/** Parse schema from JSON bytes */
function parseSchema(schemaStr: string): SchemaField[] | null {
  try {
    const parsed = JSON.parse(schemaStr);
    if (Array.isArray(parsed)) return parsed as SchemaField[];
    if (parsed && typeof parsed === 'object' && parsed.fields) {
      return parsed.fields as SchemaField[];
    }
    return [parsed] as SchemaField[];
  } catch {
    return null;
  }
}

/** Check compatibility between two schemas under a given mode */
function checkCompatibility(
  oldSchema: string,
  newSchema: string,
  mode: string,
): { compatible: boolean; reasons: string[] } {
  const oldFields = parseSchema(oldSchema);
  const newFields = parseSchema(newSchema);

  if (!oldFields || !newFields) {
    return { compatible: true, reasons: [] };
  }

  const reasons: string[] = [];
  const oldFieldMap = new Map(oldFields.map(f => [f.name, f]));
  const newFieldMap = new Map(newFields.map(f => [f.name, f]));

  if (mode === 'backward' || mode === 'full') {
    for (const [name, field] of newFieldMap) {
      if (!oldFieldMap.has(name) && field.required && field.default === undefined) {
        reasons.push(`New required field '${name}' without default breaks backward compatibility`);
      }
    }
  }

  if (mode === 'forward' || mode === 'full') {
    for (const [name, field] of oldFieldMap) {
      if (!newFieldMap.has(name) && field.required) {
        reasons.push(`Removed required field '${name}' breaks forward compatibility`);
      }
    }
  }

  if (mode !== 'none') {
    for (const [name, newField] of newFieldMap) {
      const oldField = oldFieldMap.get(name);
      if (oldField && oldField.type !== newField.type) {
        reasons.push(`Type change for field '${name}': '${oldField.type}' -> '${newField.type}'`);
      }
    }
  }

  return { compatible: reasons.length === 0, reasons };
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const subject = input.subject as string;
    const schema = input.schema as string;
    const compatibility = input.compatibility as string;

    if (!VALID_COMPATIBILITY_MODES.includes(compatibility)) {
      const p = createProgram();
      return complete(p, 'invalidCompatibility', {
        message: `Compatibility mode '${compatibility}' is not valid. Allowed: ${VALID_COMPATIBILITY_MODES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'schema-evolution', { subject }, 'existingSchemas');

    p = mapBindings(p, (bindings) => {
      const existingSchemas = bindings.existingSchemas as Record<string, unknown>[];

      let nextVersion = 1;
      let latestSchema: string | null = null;
      let latestCompatibility: string | null = null;

      for (const existing of existingSchemas) {
        const v = existing.version as number;
        if (v >= nextVersion) {
          nextVersion = v + 1;
          latestSchema = existing.schema as string;
          latestCompatibility = existing.compatibility as string;
        }
      }

      if (latestSchema !== null) {
        const mode = latestCompatibility || compatibility;
        const { compatible, reasons } = checkCompatibility(latestSchema, schema, mode);
        if (!compatible) {
          return { decision: 'incompatible', reasons };
        }
      }

      return { decision: 'ok', nextVersion };
    }, 'registerResult');

    return branch(p,
      (b) => (b.registerResult as Record<string, unknown>).decision === 'incompatible',
      (thenP) => completeFrom(thenP, 'incompatible', (b) => {
        const res = b.registerResult as Record<string, unknown>;
        return { reasons: res.reasons };
      }),
      (elseP) => {
        const schemaId = nextId();
        elseP = putFrom(elseP, 'schema-evolution', schemaId, (bindings) => {
          const res = bindings.registerResult as Record<string, unknown>;
          return {
            id: schemaId,
            subject,
            schema,
            compatibility,
            version: res.nextVersion,
          };
        });
        return completeFrom(elseP, 'ok', (b) => {
          const res = b.registerResult as Record<string, unknown>;
          return { version: res.nextVersion, schemaId };
        });
      },
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    if (!input.mode || (typeof input.mode === 'string' && (input.mode as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'mode is required' }) as StorageProgram<Result>;
    }
    const oldSchema = input.oldSchema as string;
    const newSchema = input.newSchema as string;
    const mode = input.mode as string;

    const { compatible, reasons } = checkCompatibility(oldSchema, newSchema, mode);

    const p = createProgram();
    if (compatible) {
      return complete(p, 'compatible', {}) as StorageProgram<Result>;
    }

    return complete(p, 'incompatible', { reasons }) as StorageProgram<Result>;
  },

  upcast(input: Record<string, unknown>) {
    if (!input.subject || (typeof input.subject === 'string' && (input.subject as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'subject is required' }) as StorageProgram<Result>;
    }
    const data = input.data as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;
    const subject = input.subject as string;

    let p = createProgram();
    p = find(p, 'schema-evolution', { subject }, 'allSchemas');

    return completeFrom(p, 'ok', (bindings) => {
      const allSchemas = bindings.allSchemas as Record<string, unknown>[];

      const fromSchema = allSchemas.find(s => (s.version as number) === fromVersion);
      if (!fromSchema) {
        return { message: `Subject '${subject}' version ${fromVersion} not found` };
      }

      const toSchema = allSchemas.find(s => (s.version as number) === toVersion);
      if (!toSchema) {
        return { message: `Subject '${subject}' version ${toVersion} not found` };
      }

      if (fromVersion > toVersion) {
        return { message: `Cannot downcast from version ${fromVersion} to ${toVersion}` };
      }

      try {
        const dataObj = JSON.parse(data);
        const targetFields = parseSchema(toSchema.schema as string);

        if (targetFields) {
          for (const field of targetFields) {
            if (!(field.name in dataObj) && field.default !== undefined) {
              dataObj[field.name] = field.default;
            }
          }
        }

        return { transformed: JSON.stringify(dataObj) };
      } catch {
        return { transformed: data };
      }
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const readerSchema = input.readerSchema as string;
    const writerSchema = input.writerSchema as string;

    const readerFields = parseSchema(readerSchema);
    const writerFields = parseSchema(writerSchema);

    if (!readerFields || !writerFields) {
      const p = createProgram();
      return complete(p, 'incompatible', { reasons: ['Unable to parse one or both schemas'] }) as StorageProgram<Result>;
    }

    const readerFieldMap = new Map(readerFields.map(f => [f.name, f]));
    const mergedFields: SchemaField[] = [...readerFields];

    for (const writerField of writerFields) {
      if (!readerFieldMap.has(writerField.name)) {
        mergedFields.push({ ...writerField, required: false });
      }
    }

    const p = createProgram();
    return complete(p, 'ok', { resolved: JSON.stringify(mergedFields) }) as StorageProgram<Result>;
  },

  getSchema(input: Record<string, unknown>) {
    const subject = input.subject as string;
    const version = input.version as number;

    let p = createProgram();
    p = find(p, 'schema-evolution', { subject }, 'allSchemas');

    return completeFrom(p, 'ok', (bindings) => {
      const allSchemas = bindings.allSchemas as Record<string, unknown>[];
      const match = allSchemas.find(s => (s.version as number) === version);

      if (!match) {
        return { message: `Subject '${subject}' version ${version} not found` };
      }

      return {
        schema: match.schema as string,
        compatibility: match.compatibility as string,
      };
    }) as StorageProgram<Result>;
  },
};

export const schemaEvolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSchemaEvolutionCounter(): void {
  idCounter = 0;
}
