// @clef-handler style=imperative
// SpecificationSchema Concept Implementation — Formal Verification Suite
// Define, instantiate, validate, search, and manage reusable specification
// templates (Dwyer patterns, smart contract patterns, distributed system
// invariants, etc.) for generating formal properties from parameterized schemas.
//
// FunctionalConceptHandler: each action returns a StorageProgram — pure data
// describing storage effects. No async, no side effects, fully inspectable
// by the monadic analysis pipeline.
// See Architecture doc Section 18.6

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, pure, pureFrom, mapBindings,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

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

type Result = { variant: string; [key: string]: unknown };

export const specificationSchemaHandler: FunctionalConceptHandler = {
  define(input) {
    const name = input.name as string;
    const category = input.category as string;
    const pattern_type = input.pattern_type as string;
    const template_text = input.template_text as string;
    const parameters = input.parameters as string;
    const formal_language = input.formal_language as string | undefined;
    const description = input.description as string | undefined;

    if (!VALID_CATEGORIES.includes(category as any)) {
      return complete(createProgram(), 'invalid', { message: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}` }) as StorageProgram<Result>;
    }

    if (!name || !pattern_type || !template_text) {
      return complete(createProgram(), 'invalid', { message: 'name, pattern_type, and template_text are required' }) as StorageProgram<Result>;
    }

    let paramList: Array<{ name: string; type: string; description?: string }>;
    try {
      paramList = JSON.parse(parameters);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'parameters must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(paramList)) {
      return complete(createProgram(), 'invalid', { message: 'parameters must be an array' }) as StorageProgram<Result>;
    }

    const id = `ss-${simpleHash(name + ':' + category + ':' + pattern_type)}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, id, {
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

    return complete(p, 'ok', { id, name, category, pattern_type }) as StorageProgram<Result>;
  },

  instantiate(input) {
    const schema_id = input.schema_id as string;
    const param_values = input.param_values as string;

    let values: Record<string, string>;
    try {
      values = JSON.parse(param_values);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'param_values must be a valid JSON object' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, schema_id, 'schema');
    p = branch(
      p,
      (bindings) => bindings.schema == null,
      complete(createProgram(), 'notfound', { schema_id }),
      pureFrom(createProgram(), (bindings) => {
        const schema = bindings.schema as Record<string, unknown>;
        const templateText = schema.template_text as string;
        const paramDefs: Array<{ name: string; type: string }> = JSON.parse(schema.parameters as string);

        // Check all required params are provided
        const requiredNames = paramDefs.map(p => p.name);
        const missing = requiredNames.filter(n => !(n in values));
        if (missing.length > 0) {
          return { variant: 'invalid', message: `Missing parameters: ${missing.join(', ')}` };
        }

        const instantiated = substituteParams(templateText, values);
        const remainingParams = extractParamNames(instantiated);

        return {
          variant: 'ok',
          schema_id,
          instantiated_text: instantiated,
          formal_language: schema.formal_language || '',
          fully_instantiated: remainingParams.length === 0,
          remaining_params: JSON.stringify(remainingParams),
        };
      }),
    );
    return p as StorageProgram<Result>;
  },

  validate(input) {
    const schema_id = input.schema_id as string;
    const param_values = input.param_values as string;

    let values: Record<string, string>;
    try {
      values = JSON.parse(param_values);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'param_values must be a valid JSON object' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, schema_id, 'schema');
    p = branch(
      p,
      (bindings) => bindings.schema == null,
      complete(createProgram(), 'notfound', { schema_id }),
      pureFrom(createProgram(), (bindings) => {
        const schema = bindings.schema as Record<string, unknown>;
        const paramDefs: Array<{ name: string; type: string }> = JSON.parse(schema.parameters as string);
        const requiredNames = paramDefs.map(p => p.name);

        const provided = Object.keys(values);
        const missing = requiredNames.filter(n => !provided.includes(n));
        const extra = provided.filter(n => !requiredNames.includes(n));
        const valid = missing.length === 0 && extra.length === 0;

        return {
          variant: 'ok',
          schema_id,
          valid,
          missing_params: JSON.stringify(missing),
          extra_params: JSON.stringify(extra),
        };
      }),
    );
    return p as StorageProgram<Result>;
  },

  list_by_category(input) {
    const category = input.category as string;

    let p = createProgram();
    p = find(p, RELATION, { category }, 'items');
    return pureFrom(p, (bindings) => {
      const items = (bindings.items as Record<string, unknown>[]) || [];
      const fields = ['id', 'name', 'category', 'pattern_type', 'formal_language', 'description'];
      const projected = items.map(item => {
        const result: Record<string, unknown> = {};
        for (const f of fields) result[f] = item[f];
        return result;
      });
      return {
        variant: 'ok',
        count: projected.length,
        items: JSON.stringify(projected),
        category,
      };
    }) as StorageProgram<Result>;
  },

  search(input) {
    const query = input.query as string;

    if (!query || query.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'query must be non-empty' }) as StorageProgram<Result>;
    }

    const lowerQuery = query.toLowerCase();

    let p = createProgram();
    p = find(p, RELATION, {}, 'all_schemas');
    return pureFrom(p, (bindings) => {
      const allSchemas = (bindings.all_schemas as Record<string, unknown>[]) || [];
      const searchFields = ['name', 'template_text', 'description'];
      const resultFields = ['id', 'name', 'category', 'pattern_type', 'formal_language', 'description'];

      const matches = allSchemas.filter(schema =>
        searchFields.some(field => {
          const val = schema[field];
          return typeof val === 'string' && val.toLowerCase().includes(lowerQuery);
        }),
      );

      const projected = matches.map(item => {
        const result: Record<string, unknown> = {};
        for (const f of resultFields) result[f] = item[f];
        return result;
      });

      return {
        variant: 'ok',
        count: projected.length,
        items: JSON.stringify(projected),
        query,
      };
    }) as StorageProgram<Result>;
  },
};
