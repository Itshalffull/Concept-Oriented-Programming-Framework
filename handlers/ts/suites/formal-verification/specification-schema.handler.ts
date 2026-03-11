// ============================================================
// SpecificationSchema Handler
//
// Define, instantiate, validate, search, and manage reusable
// specification templates (Dwyer patterns, smart contract patterns,
// distributed system invariants) for generating formal properties
// from parameterized schemas.
// See Architecture doc Section 18.6
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const VALID_CATEGORIES = [
  'dwyer_pattern',
  'smart_contract',
  'distributed_system',
  'security',
  'concurrency',
];

const COLLECTION = 'specification-schemas';

export const specificationSchemaHandler: ConceptHandler = {
  async define(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const category = input.category as string;
    const pattern_type = input.pattern_type as string;
    const template_text = input.template_text as string;
    const parameters = input.parameters as string;
    const formal_language = (input.formal_language as string) || undefined;
    const description = (input.description as string) || '';

    if (!name || !name.trim()) {
      return { variant: 'invalid', message: 'Name is required and must be non-empty' };
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return {
        variant: 'invalid',
        message: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      };
    }

    const id = `ss-${randomUUID()}`;
    const parsedParams = JSON.parse(parameters);
    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      id,
      name,
      category,
      pattern_type,
      template_text,
      parameters,
      formal_language,
      description,
      created_at,
    });

    return {
      variant: 'ok',
      id,
      name,
      category,
      pattern_type,
    };
  },

  async instantiate(input: Record<string, unknown>, storage: ConceptStorage) {
    const schema_id = input.schema_id as string;
    const param_values = JSON.parse(input.param_values as string) as Record<string, string>;

    const schema = await storage.get(COLLECTION, schema_id);
    if (!schema) {
      return { variant: 'notfound', schema_id };
    }

    const parameters = JSON.parse(schema.parameters as string) as Array<{ name: string; type?: string; description?: string }>;

    // Check for missing required parameters
    const missing = parameters
      .map(p => p.name)
      .filter(name => !(name in param_values));

    if (missing.length > 0) {
      return { variant: 'missing_params', missing: JSON.stringify(missing) };
    }

    // Substitute parameters in template
    let instantiated_text = schema.template_text as string;
    for (const [key, value] of Object.entries(param_values)) {
      instantiated_text = instantiated_text.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'),
        value,
      );
    }

    const property_ref = `prop-${randomUUID()}`;

    return {
      variant: 'ok',
      instantiated_text,
      property_ref,
      category: schema.category,
      pattern_type: schema.pattern_type,
      formal_language: schema.formal_language,
    };
  },

  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const schema_id = input.schema_id as string;
    const param_values = JSON.parse(input.param_values as string) as Record<string, string>;

    const schema = await storage.get(COLLECTION, schema_id);
    if (!schema) {
      return { variant: 'notfound', schema_id };
    }

    const parameters = JSON.parse(schema.parameters as string) as Array<{ name: string }>;
    const paramNames = parameters.map(p => p.name);
    const errors: string[] = [];

    // Check for missing parameters
    for (const name of paramNames) {
      if (!(name in param_values)) {
        errors.push(`Missing parameter: ${name}`);
      }
    }

    // Check for unexpected extra parameters
    const providedKeys = Object.keys(param_values);
    const extraKeys = providedKeys.filter(k => !paramNames.includes(k));
    if (extraKeys.length > 0) {
      errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
    }

    const valid = errors.length === 0;

    // Generate preview if valid
    let preview: string | undefined;
    if (valid) {
      let text = schema.template_text as string;
      for (const [key, value] of Object.entries(param_values)) {
        text = text.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }
      preview = text;
    }

    return {
      variant: 'ok',
      valid,
      errors: JSON.stringify(errors),
      preview,
    };
  },

  async list_by_category(input: Record<string, unknown>, storage: ConceptStorage) {
    const category = input.category as string;
    const all = await storage.find(COLLECTION);
    const filtered = all.filter(s => s.category === category);

    return {
      variant: 'ok',
      category,
      count: filtered.length,
      items: JSON.stringify(
        filtered.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          pattern_type: s.pattern_type,
        })),
      ),
    };
  },

  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;

    if (!query || !query.trim()) {
      return { variant: 'invalid', message: 'Search query must be non-empty' };
    }

    const all = await storage.find(COLLECTION);
    const lowerQuery = query.toLowerCase();

    const matched = all.filter(s => {
      const name = (s.name as string || '').toLowerCase();
      const template = (s.template_text as string || '').toLowerCase();
      const desc = (s.description as string || '').toLowerCase();
      return name.includes(lowerQuery) || template.includes(lowerQuery) || desc.includes(lowerQuery);
    });

    return {
      variant: 'ok',
      count: matched.length,
      items: JSON.stringify(
        matched.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          pattern_type: s.pattern_type,
        })),
      ),
    };
  },
};
