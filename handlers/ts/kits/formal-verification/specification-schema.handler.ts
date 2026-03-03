// SpecificationSchema Concept Implementation — Formal Verification Suite
// Define, instantiate, validate, search, and manage reusable specification
// templates (Dwyer patterns, smart contract patterns, distributed system
// invariants, etc.) for generating formal properties from parameterized schemas.
// See Architecture doc Section 18.6
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const RELATION = 'spec-schemas';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const VALID_CATEGORIES = [
  'dwyer_pattern',
  'smart_contract',
  'distributed_system',
  'data_integrity',
  'access_control',
  'custom',
] as const;

/** Replace all ${paramName} placeholders in template text with provided values. */
function substituteParams(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/** Extract parameter names from template text (all ${...} references). */
function extractParamNames(template: string): string[] {
  const matches = template.match(/\$\{([^}]+)\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -1)))];
}

export const specificationSchemaHandler: ConceptHandler = {
  async define(input, storage) {
    const name = input.name as string;
    const category = input.category as string;
    const pattern_type = input.pattern_type as string;
    const template_text = input.template_text as string;
    const parameters = input.parameters as string;   // JSON array of { name, type, description }
    const formal_language = input.formal_language as string | undefined;
    const description = input.description as string | undefined;

    if (!VALID_CATEGORIES.includes(category as any)) {
      return {
        variant: 'invalid',
        message: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      };
    }

    if (!name || !pattern_type || !template_text) {
      return { variant: 'invalid', message: 'name, pattern_type, and template_text are required' };
    }

    let paramList: Array<{ name: string; type: string; description?: string }>;
    try {
      paramList = JSON.parse(parameters);
    } catch {
      return { variant: 'invalid', message: 'parameters must be a valid JSON array' };
    }

    if (!Array.isArray(paramList)) {
      return { variant: 'invalid', message: 'parameters must be an array' };
    }

    const id = `ss-${simpleHash(name + ':' + category + ':' + pattern_type)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      id,
      name,
      category,
      pattern_type,
      template_text,
      parameters: JSON.stringify(paramList),
      formal_language: formal_language || '',
      description: description || '',
      created_at: now,
      updated_at: now,
    });

    return { variant: 'ok', id, name, category, pattern_type };
  },

  async instantiate(input, storage) {
    const schema_id = input.schema_id as string;
    const param_values = input.param_values as string;  // JSON map: param_name -> value

    const schema = await storage.get(RELATION, schema_id);
    if (!schema) {
      return { variant: 'notfound', schema_id };
    }

    let values: Record<string, string>;
    try {
      values = JSON.parse(param_values);
    } catch {
      return { variant: 'invalid', message: 'param_values must be a valid JSON object' };
    }

    const templateText = schema.template_text as string;
    const requiredParams = extractParamNames(templateText);

    // Verify all required parameters are provided
    const missingParams = requiredParams.filter(p => !(p in values));
    if (missingParams.length > 0) {
      return {
        variant: 'missing_params',
        schema_id,
        missing: JSON.stringify(missingParams),
        message: `Missing required parameters: ${missingParams.join(', ')}`,
      };
    }

    const instantiatedText = substituteParams(templateText, values);
    const property_ref = `fp-inst-${simpleHash(schema_id + ':' + JSON.stringify(values))}`;

    return {
      variant: 'ok',
      schema_id,
      property_ref,
      instantiated_text: instantiatedText,
      category: schema.category as string,
      pattern_type: schema.pattern_type as string,
      formal_language: schema.formal_language as string,
    };
  },

  async validate(input, storage) {
    const schema_id = input.schema_id as string;
    const param_values = input.param_values as string;  // JSON map: param_name -> value

    const schema = await storage.get(RELATION, schema_id);
    if (!schema) {
      return { variant: 'notfound', schema_id };
    }

    let values: Record<string, string>;
    try {
      values = JSON.parse(param_values);
    } catch {
      return { variant: 'invalid', message: 'param_values must be a valid JSON object' };
    }

    const templateText = schema.template_text as string;
    const paramDefs: Array<{ name: string; type: string; description?: string }> =
      JSON.parse(schema.parameters as string);
    const requiredParams = extractParamNames(templateText);

    // Check all parameters are present and types match
    const errors: string[] = [];
    for (const paramName of requiredParams) {
      if (!(paramName in values)) {
        errors.push(`Missing parameter: ${paramName}`);
        continue;
      }
      // Check type if defined
      const paramDef = paramDefs.find(p => p.name === paramName);
      if (paramDef) {
        const value = values[paramName];
        if (paramDef.type === 'number' && isNaN(Number(value))) {
          errors.push(`Parameter "${paramName}" must be a number, got "${value}"`);
        }
        if (paramDef.type === 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`Parameter "${paramName}" must be a boolean, got "${value}"`);
        }
      }
    }

    // Check for extra parameters not in template
    const extraParams = Object.keys(values).filter(k => !requiredParams.includes(k));
    if (extraParams.length > 0) {
      errors.push(`Unexpected parameters: ${extraParams.join(', ')}`);
    }

    const valid = errors.length === 0;
    const preview = valid ? substituteParams(templateText, values) : '';

    return {
      variant: 'ok',
      schema_id,
      valid,
      errors: JSON.stringify(errors),
      preview,
    };
  },

  async list_by_category(input, storage) {
    const category = input.category as string;

    const all = await storage.find(RELATION);
    const matching = all.filter((s: any) => s.category === category);

    const items = matching.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      pattern_type: s.pattern_type,
      formal_language: s.formal_language,
      description: s.description,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length, category };
  },

  async search(input, storage) {
    const query = input.query as string;

    if (!query || query.trim() === '') {
      return { variant: 'invalid', message: 'query must be non-empty' };
    }

    const lowerQuery = query.toLowerCase();
    const all = await storage.find(RELATION);

    const matching = all.filter((s: any) => {
      const name = (s.name as string || '').toLowerCase();
      const templateText = (s.template_text as string || '').toLowerCase();
      const description = (s.description as string || '').toLowerCase();
      return name.includes(lowerQuery) || templateText.includes(lowerQuery) || description.includes(lowerQuery);
    });

    const items = matching.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      pattern_type: s.pattern_type,
      formal_language: s.formal_language,
      description: s.description,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length, query };
  },
};
