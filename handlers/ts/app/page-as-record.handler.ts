import type { ConceptHandler } from '@clef/runtime';

export const pageAsRecordHandler: ConceptHandler = {
  async create(input, storage) {
    const page = input.page as string;
    const schema = input.schema as string;
    const existing = await storage.get('page', page);
    if (existing) return { variant: 'exists', message: 'already exists' };
    const now = new Date().toISOString();
    await storage.put('page', page, {
      page,
      schema,
      properties: JSON.stringify({}),
      body: '',
      createdAt: now,
      updatedAt: now,
    });
    return { variant: 'ok', page };
  },

  async setProperty(input, storage) {
    const page = input.page as string;
    const key = input.key as string;
    const value = input.value as string;
    const existing = await storage.get('page', page);
    if (!existing) return { variant: 'notfound', message: 'Page not found' };
    const schema = JSON.parse(existing.schema as string);
    if (schema.fields && Array.isArray(schema.fields) && !schema.fields.includes(key)) {
      return { variant: 'invalid', message: `Key '${key}' is not defined in the page schema` };
    }
    const properties: Record<string, string> = JSON.parse(existing.properties as string);
    properties[key] = value;
    await storage.put('page', page, {
      ...existing,
      properties: JSON.stringify(properties),
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', page };
  },

  async getProperty(input, storage) {
    const page = input.page as string;
    const key = input.key as string;
    const existing = await storage.get('page', page);
    if (!existing) return { variant: 'notfound', message: 'Page not found' };
    const properties: Record<string, string> = JSON.parse(existing.properties as string);
    if (!(key in properties)) return { variant: 'notfound', message: 'Property not found' };
    return { variant: 'ok', value: properties[key] };
  },

  async appendToBody(input, storage) {
    const page = input.page as string;
    const content = input.content as string;
    const existing = await storage.get('page', page);
    if (!existing) return { variant: 'notfound', message: 'Page not found' };
    const currentBody = existing.body as string;
    await storage.put('page', page, {
      ...existing,
      body: currentBody + content,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', page };
  },

  async attachToSchema(input, storage) {
    const page = input.page as string;
    const schema = input.schema as string;
    const existing = await storage.get('page', page);
    if (!existing) return { variant: 'notfound', message: 'Page not found' };
    await storage.put('page', page, {
      ...existing,
      schema,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', page };
  },

  async convertFromFreeform(input, storage) {
    const page = input.page as string;
    const schema = input.schema as string;
    const existing = await storage.get('page', page);
    if (!existing) return { variant: 'notfound', message: 'Page not found' };
    const parsedSchema = JSON.parse(schema);
    const body = existing.body as string;
    const properties: Record<string, string> = JSON.parse(existing.properties as string);
    if (parsedSchema.fields && Array.isArray(parsedSchema.fields)) {
      for (const field of parsedSchema.fields) {
        const regex = new RegExp(`${field}:\\s*(.+)`, 'i');
        const match = body.match(regex);
        if (match) {
          properties[field] = match[1].trim();
        }
      }
    }
    await storage.put('page', page, {
      ...existing,
      schema,
      properties: JSON.stringify(properties),
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', page };
  },
};
