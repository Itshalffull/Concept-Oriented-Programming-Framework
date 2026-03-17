// SpecificationSchema Concept Implementation — Formal Verification Suite
// Define, instantiate, validate, search, and manage reusable specification
// templates (Dwyer patterns, smart contract patterns, distributed system
// invariants, etc.) for generating formal properties from parameterized schemas.
//
// Migrated to FunctionalConceptHandler: returns StoragePrograms enabling
// the monadic pipeline to extract properties like "instantiate always
// substitutes all template parameters" and "define validates category".
// See Architecture doc Section 18.6

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, pure,
  type StorageProgram,
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
      return pure(createProgram(), {
        variant: 'invalid',
        message: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    if (!name || !pattern_type || !template_text) {
      return pure(createProgram(), { variant: 'invalid', message: 'name, pattern_type, and template_text are required' }) as StorageProgram<Result>;
    }

    let paramList: Array<{ name: string; type: string; description?: string }>;
    try {
      paramList = JSON.parse(parameters);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'parameters must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(paramList)) {
      return pure(createProgram(), { variant: 'invalid', message: 'parameters must be an array' }) as StorageProgram<Result>;
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

    return pure(p, { variant: 'ok', id, name, category, pattern_type }) as StorageProgram<Result>;
  },

  instantiate(input) {
    const schema_id = input.schema_id as string;
    const param_values = input.param_values as string;

    let values: Record<string, string>;
    try {
      values = JSON.parse(param_values);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'param_values must be a valid JSON object' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, schema_id, 'schema');
    p = branch(
      p,
      (bindings) => bindings.schema == null,
      pure(createProgram(), { variant: 'notfound', schema_id }),
      (() => {
        // Substitution and param checking happen in interpreter via __compute.
        // We encode the values for the interpreter to resolve against the binding.
        return pure(createProgram(), {
          variant: 'ok',
          schema_id,
          __compute: 'instantiate_schema',
          __param_values: JSON.stringify(values),
        });
      })(),
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
      return pure(createProgram(), { variant: 'invalid', message: 'param_values must be a valid JSON object' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, schema_id, 'schema');
    p = branch(
      p,
      (bindings) => bindings.schema == null,
      pure(createProgram(), { variant: 'notfound', schema_id }),
      pure(createProgram(), {
        variant: 'ok',
        schema_id,
        __compute: 'validate_params',
        __param_values: JSON.stringify(values),
      }),
    );
    return p as StorageProgram<Result>;
  },

  list_by_category(input) {
    const category = input.category as string;

    let p = createProgram();
    p = find(p, RELATION, { category }, 'items');
    return pure(p, {
      variant: 'ok',
      __compute: 'list',
      __fields: ['id', 'name', 'category', 'pattern_type', 'formal_language', 'description'],
      category,
    }) as StorageProgram<Result>;
  },

  search(input) {
    const query = input.query as string;

    if (!query || query.trim() === '') {
      return pure(createProgram(), { variant: 'invalid', message: 'query must be non-empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, RELATION, {}, 'all_schemas');
    return pure(p, {
      variant: 'ok',
      __compute: 'search',
      __query: query,
      __search_fields: ['name', 'template_text', 'description'],
      __result_fields: ['id', 'name', 'category', 'pattern_type', 'formal_language', 'description'],
    }) as StorageProgram<Result>;
  },
};
