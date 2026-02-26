// ============================================================
// SchemaEvolution Handler
//
// Manage versioned structural definitions with compatibility
// guarantees. Supports backward, forward, and full compatibility
// modes with upcast transformations between schema versions.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
    // New schema must be readable by old consumers
    // New required fields without defaults break backward compatibility
    for (const [name, field] of newFieldMap) {
      if (!oldFieldMap.has(name) && field.required && field.default === undefined) {
        reasons.push(`New required field '${name}' without default breaks backward compatibility`);
      }
    }
  }

  if (mode === 'forward' || mode === 'full') {
    // Old schema must be readable by new consumers
    // Removed required fields break forward compatibility
    for (const [name, field] of oldFieldMap) {
      if (!newFieldMap.has(name) && field.required) {
        reasons.push(`Removed required field '${name}' breaks forward compatibility`);
      }
    }
  }

  // Type changes break both directions
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

export const schemaEvolutionHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const subject = input.subject as string;
    const schema = input.schema as string;
    const compatibility = input.compatibility as string;

    if (!VALID_COMPATIBILITY_MODES.includes(compatibility)) {
      return {
        variant: 'invalidCompatibility',
        message: `Compatibility mode '${compatibility}' is not valid. Allowed: ${VALID_COMPATIBILITY_MODES.join(', ')}`,
      };
    }

    // Find existing schemas for this subject
    const existingSchemas = await storage.find('schema-evolution', { subject });

    // Determine next version
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

    // Check compatibility with previous version
    if (latestSchema !== null) {
      const mode = latestCompatibility || compatibility;
      const { compatible, reasons } = checkCompatibility(latestSchema, schema, mode);
      if (!compatible) {
        return { variant: 'incompatible', reasons };
      }
    }

    const schemaId = nextId();
    await storage.put('schema-evolution', schemaId, {
      id: schemaId,
      subject,
      version: nextVersion,
      schema,
      compatibility,
    });

    return { variant: 'ok', version: nextVersion, schemaId };
  },

  async check(input: Record<string, unknown>, storage: ConceptStorage) {
    const oldSchema = input.oldSchema as string;
    const newSchema = input.newSchema as string;
    const mode = input.mode as string;

    const { compatible, reasons } = checkCompatibility(oldSchema, newSchema, mode);

    if (compatible) {
      return { variant: 'compatible' };
    }

    return { variant: 'incompatible', reasons };
  },

  async upcast(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;
    const subject = input.subject as string;

    // Find schemas for both versions
    const allSchemas = await storage.find('schema-evolution', { subject });

    const fromSchema = allSchemas.find(s => (s.version as number) === fromVersion);
    if (!fromSchema) {
      return { variant: 'notFound', message: `Subject '${subject}' version ${fromVersion} not found` };
    }

    const toSchema = allSchemas.find(s => (s.version as number) === toVersion);
    if (!toSchema) {
      return { variant: 'notFound', message: `Subject '${subject}' version ${toVersion} not found` };
    }

    if (fromVersion > toVersion) {
      return { variant: 'noPath', message: `Cannot downcast from version ${fromVersion} to ${toVersion}` };
    }

    // Simple upcast: parse data, add default values for new fields
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

      return { variant: 'ok', transformed: JSON.stringify(dataObj) };
    } catch {
      return { variant: 'ok', transformed: data };
    }
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const readerSchema = input.readerSchema as string;
    const writerSchema = input.writerSchema as string;

    const readerFields = parseSchema(readerSchema);
    const writerFields = parseSchema(writerSchema);

    if (!readerFields || !writerFields) {
      return { variant: 'incompatible', reasons: ['Unable to parse one or both schemas'] };
    }

    // Merge: reader fields take precedence, include writer-only fields
    const readerFieldMap = new Map(readerFields.map(f => [f.name, f]));
    const mergedFields: SchemaField[] = [...readerFields];

    for (const writerField of writerFields) {
      if (!readerFieldMap.has(writerField.name)) {
        mergedFields.push({ ...writerField, required: false });
      }
    }

    return { variant: 'ok', resolved: JSON.stringify(mergedFields) };
  },

  async getSchema(input: Record<string, unknown>, storage: ConceptStorage) {
    const subject = input.subject as string;
    const version = input.version as number;

    const allSchemas = await storage.find('schema-evolution', { subject });
    const match = allSchemas.find(s => (s.version as number) === version);

    if (!match) {
      return { variant: 'notFound', message: `Subject '${subject}' version ${version} not found` };
    }

    return {
      variant: 'ok',
      schema: match.schema as string,
      compatibility: match.compatibility as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSchemaEvolutionCounter(): void {
  idCounter = 0;
}
