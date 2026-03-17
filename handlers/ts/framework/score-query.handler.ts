// ScoreQuery Concept Implementation
//
// Execute arbitrary GraphQL queries against the Score index.
// Delegates to the ScoreApi and ScoreIndex storage collections
// to resolve queries against the materialized index.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

// ─── GraphQL-lite query engine ───────────────────────────
// Parses a minimal GraphQL subset and resolves against Score
// index storage collections. Supports: { collection { fields } }
// with optional (filter: value) arguments.

interface GqlField {
  name: string;
  args: Record<string, string>;
  children: GqlField[];
}

function parseGraphql(query: string): GqlField[] {
  const trimmed = query.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    throw new Error('Query must be wrapped in { }');
  }
  return parseFields(trimmed.slice(1, -1));
}

function parseFields(body: string): GqlField[] {
  const fields: GqlField[] = [];
  let i = 0;
  const s = body.trim();

  while (i < s.length) {
    // Skip whitespace and commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;

    // Read field name
    let name = '';
    while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
      name += s[i++];
    }
    if (!name) throw new Error(`Unexpected character at position ${i}: "${s[i]}"`);

    // Optional args (key: "value")
    const args: Record<string, string> = {};
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length && s[i] === '(') {
      i++; // skip (
      while (i < s.length && s[i] !== ')') {
        while (i < s.length && /[\s,]/.test(s[i])) i++;
        let argName = '';
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) argName += s[i++];
        while (i < s.length && /\s/.test(s[i])) i++;
        if (s[i] === ':') i++;
        while (i < s.length && /\s/.test(s[i])) i++;
        let argVal = '';
        if (s[i] === '"') {
          i++;
          while (i < s.length && s[i] !== '"') argVal += s[i++];
          i++; // skip closing "
        } else {
          while (i < s.length && /[a-zA-Z0-9_\-.]/.test(s[i])) argVal += s[i++];
        }
        if (argName) args[argName] = argVal;
      }
      if (s[i] === ')') i++;
    }

    // Optional children { ... }
    let children: GqlField[] = [];
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length && s[i] === '{') {
      let depth = 1;
      let childBody = '';
      i++; // skip {
      while (i < s.length && depth > 0) {
        if (s[i] === '{') depth++;
        if (s[i] === '}') depth--;
        if (depth > 0) childBody += s[i];
        i++;
      }
      children = parseFields(childBody);
    }

    fields.push({ name, args, children });
  }

  return fields;
}

// Map GraphQL root names to Score index collections
const COLLECTION_MAP: Record<string, string> = {
  concepts: 'concepts',
  syncs: 'syncs',
  symbols: 'symbols',
  files: 'files',
  handlers: 'handlers',
  widgets: 'widgetImpls',
  themes: 'themeImpls',
  deployments: 'deployments',
  suites: 'suiteManifests',
  interfaces: 'interfaces',
};

async function resolveField(
  field: GqlField,
  storage: ConceptStorage,
): Promise<unknown> {
  const collection = COLLECTION_MAP[field.name];
  if (!collection) {
    return { error: `Unknown root: ${field.name}. Available: ${Object.keys(COLLECTION_MAP).join(', ')}` };
  }

  // Separate query control args from filter criteria
  const CONTROL_ARGS = new Set(['limit', 'offset', 'orderBy', 'order']);
  const criteria: Record<string, unknown> = {};
  const limit = field.args.limit ? parseInt(field.args.limit, 10) : 0;
  const offset = field.args.offset ? parseInt(field.args.offset, 10) : 0;

  for (const [k, v] of Object.entries(field.args)) {
    if (!CONTROL_ARGS.has(k)) {
      criteria[k] = v;
    }
  }

  let rows = Object.keys(criteria).length > 0
    ? await storage.find(collection, criteria)
    : await storage.find(collection);

  // Apply offset and limit
  if (offset > 0) {
    rows = rows.slice(offset);
  }
  if (limit > 0) {
    rows = rows.slice(0, limit);
  }

  // If no child fields requested, return all fields
  if (field.children.length === 0) {
    return rows;
  }

  // Project only requested fields
  return rows.map(row => {
    const projected: Record<string, unknown> = {};
    for (const child of field.children) {
      projected[child.name] = row[child.name] ?? null;
    }
    return projected;
  });
}

// ─── ScoreQuery Handler ──────────────────────────────────

export const scoreQueryHandler: ConceptHandler = {
  async query(input, storage) {
    const graphql = input.graphql as string;
    if (!graphql) {
      return { variant: 'error', message: 'graphql query string is required' };
    }

    try {
      const fields = parseGraphql(graphql);
      const result: Record<string, unknown> = {};

      for (const field of fields) {
        result[field.name] = await resolveField(field, storage);
      }

      const id = `q-${Date.now()}`;
      return {
        variant: 'ok',
        id,
        data: JSON.stringify(result, null, 2),
      };
    } catch (err) {
      return {
        variant: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
