// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ScoreQuery Concept Implementation
//
// Execute arbitrary GraphQL queries against the Score index.
// Delegates to the ScoreApi and ScoreIndex storage collections
// to resolve queries against the materialized index.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── GraphQL-lite query engine ───────────────────────────

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
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;

    let name = '';
    while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
      name += s[i++];
    }
    if (!name) throw new Error(`Unexpected character at position ${i}: "${s[i]}"`);

    const args: Record<string, string> = {};
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length && s[i] === '(') {
      i++;
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
          i++;
        } else {
          while (i < s.length && /[a-zA-Z0-9_\-.]/.test(s[i])) argVal += s[i++];
        }
        if (argName) args[argName] = argVal;
      }
      if (s[i] === ')') i++;
    }

    let children: GqlField[] = [];
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length && s[i] === '{') {
      let depth = 1;
      let childBody = '';
      i++;
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

// ─── ScoreQuery Handler ──────────────────────────────────

const _handler: FunctionalConceptHandler = {
  query(input: Record<string, unknown>) {
    const graphql = input.graphql as string;
    if (!graphql) {
      const p = createProgram();
      return complete(p, 'error', { message: 'graphql query string is required' }) as StorageProgram<Result>;
    }

    try {
      const fields = parseGraphql(graphql);

      // Collect all collections we need to query
      const collectionsNeeded: string[] = [];
      for (const field of fields) {
        const collection = COLLECTION_MAP[field.name];
        if (collection) {
          collectionsNeeded.push(collection);
        }
      }

      if (collectionsNeeded.length === 0) {
        const p = createProgram();
        return complete(p, 'error', {
          message: `Unknown roots. Available: ${Object.keys(COLLECTION_MAP).join(', ')}`,
        }) as StorageProgram<Result>;
      }

      // Fetch all needed collections
      let p = createProgram();
      for (const col of collectionsNeeded) {
        p = find(p, col, {}, `col_${col}`);
      }

      return completeFrom(p, 'ok', (bindings) => {
        const result: Record<string, unknown> = {};

        for (const field of fields) {
          const collection = COLLECTION_MAP[field.name];
          if (!collection) {
            result[field.name] = { error: `Unknown root: ${field.name}. Available: ${Object.keys(COLLECTION_MAP).join(', ')}` };
            continue;
          }

          let rows = (bindings[`col_${collection}`] as Array<Record<string, unknown>>) || [];

          // Apply filter criteria
          const CONTROL_ARGS = new Set(['limit', 'offset', 'orderBy', 'order']);
          const criteria: Record<string, unknown> = {};
          const limit = field.args.limit ? parseInt(field.args.limit, 10) : 0;
          const offset = field.args.offset ? parseInt(field.args.offset, 10) : 0;

          for (const [k, v] of Object.entries(field.args)) {
            if (!CONTROL_ARGS.has(k)) {
              criteria[k] = v;
            }
          }

          if (Object.keys(criteria).length > 0) {
            rows = rows.filter(r =>
              Object.entries(criteria).every(([k, v]) => r[k] === v)
            );
          }

          if (offset > 0) rows = rows.slice(offset);
          if (limit > 0) rows = rows.slice(0, limit);

          if (field.children.length === 0) {
            result[field.name] = rows;
          } else {
            result[field.name] = rows.map(row => {
              const projected: Record<string, unknown> = {};
              for (const child of field.children) {
                projected[child.name] = row[child.name] ?? null;
              }
              return projected;
            });
          }
        }

        const id = `q-${Date.now()}`;
        return { id, data: JSON.stringify(result, null, 2) };
      }) as StorageProgram<Result>;
    } catch (err) {
      const p = createProgram();
      return complete(p, 'error', {
        message: err instanceof Error ? err.message : String(err),
      }) as StorageProgram<Result>;
    }
  },
};

export const scoreQueryHandler = autoInterpret(_handler);
