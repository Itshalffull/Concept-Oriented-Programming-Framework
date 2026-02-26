import type { ConceptHandler } from '@clef/runtime';

export const typeSystemHandler: ConceptHandler = {
  async registerType(input, storage) {
    const type = input.type as string;
    const schema = input.schema as string;
    const constraints = input.constraints as string;
    const existing = await storage.get('type', type);
    if (existing) return { variant: 'exists', message: 'already exists' };
    await storage.put('type', type, {
      type,
      schema,
      constraints,
      parent: '',
    });
    return { variant: 'ok', type };
  },

  async resolve(input, storage) {
    const type = input.type as string;
    const record = await storage.get('type', type);
    if (!record) return { variant: 'notfound', message: 'Type not found' };
    let schema = JSON.parse(record.schema as string);
    let parentId = record.parent as string;
    while (parentId) {
      const parentRecord = await storage.get('type', parentId);
      if (!parentRecord) break;
      const parentSchema = JSON.parse(parentRecord.schema as string);
      schema = { ...parentSchema, ...schema };
      parentId = parentRecord.parent as string;
    }
    return { variant: 'ok', type, schema: JSON.stringify(schema) };
  },

  async validate(input, storage) {
    const type = input.type as string;
    const value = input.value as string;
    const record = await storage.get('type', type);
    if (!record) return { variant: 'notfound', message: 'Type not found' };
    const schema = JSON.parse(record.schema as string);
    let valid = true;
    if (schema.type) {
      const actualType = typeof JSON.parse(value);
      if (actualType !== schema.type) valid = false;
    }
    return { variant: 'ok', valid };
  },

  async navigate(input, storage) {
    const type = input.type as string;
    const path = input.path as string;
    const record = await storage.get('type', type);
    if (!record) return { variant: 'notfound', message: 'Type not found' };
    const schema = JSON.parse(record.schema as string);
    const segments = path.split('.');
    let current = schema;
    for (const segment of segments) {
      if (current.properties && current.properties[segment]) {
        current = current.properties[segment];
      } else {
        return { variant: 'notfound', message: `Path segment '${segment}' not found` };
      }
    }
    return { variant: 'ok', type, schema: JSON.stringify(current) };
  },

  async serialize(input, storage) {
    const type = input.type as string;
    const value = input.value as string;
    const record = await storage.get('type', type);
    if (!record) return { variant: 'notfound', message: 'Type not found' };
    const parsed = JSON.parse(value);
    return { variant: 'ok', serialized: JSON.stringify(parsed) };
  },
};
