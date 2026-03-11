// Schema Concept Implementation
// Per spec §2.1, §2.4: Schema is a composable mixin applied to ContentNodes.
// A ContentNode's identity is the set of Schemas currently applied to it.
// Schema manages: definitions (fields, constraints, inheritance) and
// entity↔schema membership (applyTo, removeFrom, getSchemasFor).
import type { ConceptHandler } from '@clef/runtime';

export const schemaHandler: ConceptHandler = {
  async list(_input, storage) {
    const items = await storage.find('schema', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async get(input, storage) {
    const schema = input.schema as string;
    const existing = await storage.get('schema', schema);
    if (!existing) return { variant: 'notfound', message: 'Schema does not exist' };
    return { variant: 'ok', ...existing };
  },

  async defineSchema(input, storage) {
    const schema = input.schema as string;
    const fields = input.fields as string;
    const label = (input.label as string | undefined) ?? schema;
    const category = (input.category as string | undefined) ?? '';
    const icon = (input.icon as string | undefined) ?? '';

    const existing = await storage.get('schema', schema);
    if (existing) {
      return { variant: 'exists', message: 'Schema already exists' };
    }

    await storage.put('schema', schema, {
      schema,
      label,
      category,
      icon,
      fields: JSON.stringify(fields.split(',')),
      extends: '',
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async addField(input, storage) {
    const schema = input.schema as string;
    const field = input.field as string;

    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const fields: string[] = JSON.parse(existing.fields as string);

    if (!fields.includes(field)) {
      fields.push(field);
    }

    await storage.put('schema', schema, {
      ...existing,
      fields: JSON.stringify(fields),
    });

    return { variant: 'ok' };
  },

  async extendSchema(input, storage) {
    const schema = input.schema as string;
    const parent = input.parent as string;

    const schemaRecord = await storage.get('schema', schema);
    if (!schemaRecord) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const parentRecord = await storage.get('schema', parent);
    if (!parentRecord) {
      return { variant: 'notfound', message: 'Parent schema does not exist' };
    }

    await storage.put('schema', schema, {
      ...schemaRecord,
      extends: parent,
    });

    return { variant: 'ok' };
  },

  // Apply a schema to a ContentNode — the core membership operation.
  // Stored as membership records keyed by "entity_id::schema_name".
  async applyTo(input, storage) {
    const entity_id = input.entity_id as string;
    const schema = input.schema as string;

    // Verify schema exists
    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const membershipKey = `${entity_id}::${schema}`;
    const alreadyApplied = await storage.get('membership', membershipKey);
    if (alreadyApplied) {
      return { variant: 'ok', message: 'Already applied' };
    }

    await storage.put('membership', membershipKey, {
      entity_id,
      schema,
      appliedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  // Remove a schema from a ContentNode.
  async removeFrom(input, storage) {
    const entity_id = input.entity_id as string;
    const schema = input.schema as string;

    const membershipKey = `${entity_id}::${schema}`;
    const existing = await storage.get('membership', membershipKey);
    if (!existing) {
      return { variant: 'notfound', message: 'Entity does not have this schema applied' };
    }

    await storage.del('membership', membershipKey);

    return { variant: 'ok' };
  },

  // Get all schemas applied to a given ContentNode.
  async getSchemasFor(input, storage) {
    const entity_id = input.entity_id as string;
    const allMemberships = await storage.find('membership', {});
    const memberships = Array.isArray(allMemberships) ? allMemberships : [];
    const schemas = memberships
      .filter((m: Record<string, unknown>) => m.entity_id === entity_id)
      .map((m: Record<string, unknown>) => m.schema as string);

    return { variant: 'ok', schemas: JSON.stringify(schemas) };
  },

  // Get all entity IDs that have a given schema applied.
  async getEntitiesFor(input, storage) {
    const schema = input.schema as string;
    const allMemberships = await storage.find('membership', {});
    const memberships = Array.isArray(allMemberships) ? allMemberships : [];
    const entities = memberships
      .filter((m: Record<string, unknown>) => m.schema === schema)
      .map((m: Record<string, unknown>) => m.entity_id as string);

    return { variant: 'ok', entities: JSON.stringify(entities) };
  },

  // List all membership records (for debugging / admin views).
  async listMemberships(_input, storage) {
    const items = await storage.find('membership', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async export(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const fields: string[] = JSON.parse(existing.fields as string);
    const parentSchema = existing.extends as string;

    // If extending a parent, collect inherited fields
    let allFields = [...fields];
    if (parentSchema) {
      const parentRecord = await storage.get('schema', parentSchema);
      if (parentRecord) {
        const parentFields: string[] = JSON.parse(parentRecord.fields as string);
        allFields = [...new Set([...parentFields, ...fields])];
      }
    }

    // Collect entities with this schema
    const allMemberships = await storage.find('membership', {});
    const memberships = Array.isArray(allMemberships) ? allMemberships : [];
    const entities = memberships
      .filter((m: Record<string, unknown>) => m.schema === schema)
      .map((m: Record<string, unknown>) => m.entity_id as string);

    const data = {
      schema,
      fields: allFields,
      extends: parentSchema || null,
      entities,
    };

    return { variant: 'ok', data: JSON.stringify(data) };
  },
};
