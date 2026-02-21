// Schema Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const schemaHandler: ConceptHandler = {
  async defineSchema(input, storage) {
    const schema = input.schema as string;
    const fields = input.fields as string;

    const existing = await storage.get('schema', schema);
    if (existing) {
      return { variant: 'exists', message: 'Schema already exists' };
    }

    await storage.put('schema', schema, {
      schema,
      fields: JSON.stringify(fields.split(',')),
      extends: '',
      associations: JSON.stringify([]),
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

  async applyTo(input, storage) {
    const entity = input.entity as string;
    const schema = input.schema as string;

    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const associations: string[] = JSON.parse(existing.associations as string);

    if (!associations.includes(entity)) {
      associations.push(entity);
    }

    await storage.put('schema', schema, {
      ...existing,
      associations: JSON.stringify(associations),
    });

    return { variant: 'ok' };
  },

  async removeFrom(input, storage) {
    const entity = input.entity as string;
    const schema = input.schema as string;

    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const associations: string[] = JSON.parse(existing.associations as string);

    if (!associations.includes(entity)) {
      return { variant: 'notfound', message: 'Entity is not associated with this schema' };
    }

    const updated = associations.filter(a => a !== entity);

    await storage.put('schema', schema, {
      ...existing,
      associations: JSON.stringify(updated),
    });

    return { variant: 'ok' };
  },

  async getAssociations(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('schema', schema);
    if (!existing) {
      return { variant: 'notfound', message: 'Schema does not exist' };
    }

    const associations: string[] = JSON.parse(existing.associations as string);

    return { variant: 'ok', associations: JSON.stringify(associations) };
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

    const data = {
      schema,
      fields: allFields,
      extends: parentSchema || null,
      associations: JSON.parse(existing.associations as string),
    };

    return { variant: 'ok', data: JSON.stringify(data) };
  },
};
