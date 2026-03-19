// UISchema Concept Implementation [S, C]
// Inspects concept specs to derive UI schemas, with override support and element extraction.
// Emits entity-level elements for concept-level widget matching alongside field elements.
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

    // Extract concept metadata
    const conceptName = (parsed.name as string) || id;
    const suite = (parsed.suite as string) || null;
    const annotations = (parsed.annotations as Record<string, unknown>) || {};
    const surfaceAnnotations = (annotations.surface as Record<string, unknown>) || {};
    const tags = (surfaceAnnotations.tags as string[]) || [];

    // Derive field elements from concept spec structure
    const elements: string[] = [];
    const fieldSummary: Array<{ name: string; type: string }> = [];

    if (parsed.fields && Array.isArray(parsed.fields)) {
      for (const field of parsed.fields) {
        if (typeof field === 'string') {
          elements.push(field);
          fieldSummary.push({ name: field, type: 'String' });
        } else {
          const f = field as Record<string, unknown>;
          elements.push(f.name as string);
          fieldSummary.push({ name: f.name as string, type: (f.type as string) || 'String' });
        }
      }
    }

    // Extract action names
    const actionNames: string[] = [];
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        if (typeof action === 'string') {
          actionNames.push(action);
        } else {
          actionNames.push((action as Record<string, unknown>).name as string);
        }
      }
    }

    // Build entity element for concept-level classification
    const entityElement = {
      kind: 'entity',
      concept: conceptName,
      suite,
      tags,
      fields: fieldSummary,
      actions: actionNames,
      annotations: surfaceAnnotations,
    };

    const uiSchema = {
      concept: conceptName,
      elements,
      layout: 'vertical',
      generatedAt: new Date().toISOString(),
    };

    await storage.put('uiSchema', id, {
      concept: JSON.stringify(conceptName),
      elements: JSON.stringify(elements),
      entityElement: JSON.stringify(entityElement),
      uiSchema: JSON.stringify(uiSchema),
      overrides: JSON.stringify({}),
      resolved: false,
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

    const existingOverrides: Record<string, unknown> = JSON.parse((existing.overrides as string) || '{}');
    const merged = { ...existingOverrides, ...parsedOverrides };

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

    // If entity-level resolution already handled this schema, skip field pipeline
    if (existing.resolved) {
      return {
        variant: 'resolved',
        message: 'Schema was resolved at entity level; field-level element extraction skipped',
      };
    }

    return {
      variant: 'ok',
      elements: existing.elements as string,
    };
  },

  async getEntityElement(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('uiSchema', schema);
    if (!existing) {
      return { variant: 'notfound', message: `UI schema "${schema}" not found` };
    }

    return {
      variant: 'ok',
      entityElement: existing.entityElement as string,
    };
  },

  async markResolved(input, storage) {
    const schema = input.schema as string;

    const existing = await storage.get('uiSchema', schema);
    if (!existing) {
      return { variant: 'notfound', message: `UI schema "${schema}" not found` };
    }

    await storage.put('uiSchema', schema, {
      ...existing,
      resolved: true,
    });

    return { variant: 'ok' };
  },
};
