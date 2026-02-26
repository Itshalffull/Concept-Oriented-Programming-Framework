import type { ConceptHandler } from '@clef/kernel';

export const propertyHandler: ConceptHandler = {
  async set(input, storage) {
    const entity = input.entity as string;
    const key = input.key as string;
    const value = input.value as string;
    const typeRecord = await storage.get('propertyType', key);
    if (typeRecord) {
      const schema = JSON.parse(typeRecord.schema as string);
      if (schema.type === 'number' && isNaN(Number(value))) {
        return { variant: 'invalid', message: 'Value does not match the registered type' };
      }
    }
    const propsRecord = await storage.get('property', entity);
    const properties: Record<string, string> = propsRecord
      ? JSON.parse(propsRecord.properties as string)
      : {};
    properties[key] = value;
    await storage.put('property', entity, {
      entity,
      properties: JSON.stringify(properties),
    });
    return { variant: 'ok', entity };
  },

  async get(input, storage) {
    const entity = input.entity as string;
    const key = input.key as string;
    const propsRecord = await storage.get('property', entity);
    if (!propsRecord) return { variant: 'notfound', message: 'not found' };
    const properties: Record<string, string> = JSON.parse(propsRecord.properties as string);
    if (!(key in properties)) return { variant: 'notfound', message: 'not found' };
    return { variant: 'ok', value: properties[key] };
  },

  async delete(input, storage) {
    const entity = input.entity as string;
    const key = input.key as string;
    const propsRecord = await storage.get('property', entity);
    if (!propsRecord) return { variant: 'notfound', message: 'not found' };
    const properties: Record<string, string> = JSON.parse(propsRecord.properties as string);
    if (!(key in properties)) return { variant: 'notfound', message: 'not found' };
    delete properties[key];
    await storage.put('property', entity, {
      entity,
      properties: JSON.stringify(properties),
    });
    return { variant: 'ok', entity };
  },

  async defineType(input, storage) {
    const name = input.name as string;
    const schema = input.schema as string;
    const existing = await storage.get('propertyType', name);
    if (existing) return { variant: 'exists', message: 'already exists' };
    await storage.put('propertyType', name, { name, schema });
    return { variant: 'ok', name };
  },

  async listAll(input, storage) {
    const entity = input.entity as string;
    const propsRecord = await storage.get('property', entity);
    const properties = propsRecord
      ? (propsRecord.properties as string)
      : JSON.stringify({});
    return { variant: 'ok', properties };
  },
};
