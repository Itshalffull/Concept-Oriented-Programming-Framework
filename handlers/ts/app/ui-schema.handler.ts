// UISchema Concept Implementation [S, C]
// Inspects concept specs to derive UI schemas, with override support and element extraction.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const uiSchemaHandler: ConceptHandler = {
  async inspect(input, storage) {
    const schema = input.schema as string;
    const conceptSpec = input.conceptSpec as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(conceptSpec);
    } catch {
      return { variant: 'parseError', message: 'Failed to parse concept spec as JSON' };
    }

    const id = schema || nextId('S');

    // Derive UI schema from concept spec structure
    const elements: string[] = [];
    if (parsed.fields && Array.isArray(parsed.fields)) {
      for (const field of parsed.fields) {
        const fieldName = typeof field === 'string' ? field : (field as Record<string, unknown>).name;
        elements.push(fieldName as string);
      }
    }

    const uiSchema = {
      concept: parsed.name || id,
      elements,
      layout: 'vertical',
      generatedAt: new Date().toISOString(),
    };

    await storage.put('uiSchema', id, {
      concept: JSON.stringify(parsed.name || ''),
      elements: JSON.stringify(elements),
      uiSchema: JSON.stringify(uiSchema),
      overrides: JSON.stringify({}),
      generatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', schema: id, elementCount: elements.length };
  },

  async override(input, storage) {
    const schema = input.schema as string;
    const overrides = input.overrides as string;

    const existing = await storage.get('uiSchema', schema);
    if (!existing) {
      return { variant: 'notfound', message: `UI schema "${schema}" not found` };
    }

    let parsedOverrides: Record<string, unknown>;
    try {
      parsedOverrides = JSON.parse(overrides);
    } catch {
      return { variant: 'invalid', message: 'Overrides must be valid JSON' };
    }

    // Merge overrides with existing
    const existingOverrides: Record<string, unknown> = JSON.parse((existing.overrides as string) || '{}');
    const merged = { ...existingOverrides, ...parsedOverrides };

    // Apply overrides to ui schema
    const uiSchema: Record<string, unknown> = JSON.parse(existing.uiSchema as string);
    const updatedSchema = { ...uiSchema, ...merged };

    await storage.put('uiSchema', schema, {
      ...existing,
      overrides: JSON.stringify(merged),
      uiSchema: JSON.stringify(updatedSchema),
    });

    return { variant: 'ok' };
  },

  async getSchema(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('uiSchema', schema);
    if (!existing) {
      return { variant: 'notfound', message: `UI schema "${schema}" not found` };
    }

    return {
      variant: 'ok',
      uiSchema: existing.uiSchema as string,
    };
  },

  async getElements(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('uiSchema', schema);
    if (!existing) {
      return { variant: 'notfound', message: `UI schema "${schema}" not found` };
    }

    return {
      variant: 'ok',
      elements: existing.elements as string,
    };
  },
};
