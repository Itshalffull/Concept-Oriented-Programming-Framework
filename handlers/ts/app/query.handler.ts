// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Query Concept Implementation
// Execute structured retrieval over content with filtering, sorting, grouping, and aggregation.
// Supports live subscriptions for reactive updates.
//
// Expression syntax (simple predicate language):
//   field = 'value'           — equality
//   field != 'value'          — inequality
//   field > 'value'           — greater than (string/number comparison)
//   field < 'value'           — less than
//   field CONTAINS 'value'    — substring match
//   field IN ('a','b','c')    — set membership
//   pred AND pred             — conjunction
//   schema = 'Article'        — schema filter (joined via membership relation)
//
// When the expression contains a schema predicate, the query handler
// joins the membership relation to filter by schema and enriches results
// with their schemas array — eliminating the client-side two-full-scan pattern.
import { randomBytes } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

/** Parse a simple predicate expression into structured clauses. */
function parseExpression(expr: string): Array<{ field: string; op: string; value: string }> {
  const clauses: Array<{ field: string; op: string; value: string }> = [];
  // Split on AND (case-insensitive)
  const parts = expr.split(/\s+AND\s+/i);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // IN operator: field IN ('a','b','c')
    const inMatch = trimmed.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
    if (inMatch) {
      const values = inMatch[2].replace(/'/g, '').split(',').map(v => v.trim());
      clauses.push({ field: inMatch[1], op: 'in', value: JSON.stringify(values) });
      continue;
    }

    // CONTAINS operator: field CONTAINS 'value'
    const containsMatch = trimmed.match(/^(\w+)\s+CONTAINS\s+'([^']*)'/i);
    if (containsMatch) {
      clauses.push({ field: containsMatch[1], op: 'contains', value: containsMatch[2] });
      continue;
    }

    // Comparison operators: field op 'value'
    const compMatch = trimmed.match(/^(\w+)\s*(!=|>=|<=|>|<|=)\s*'([^']*)'/);
    if (compMatch) {
      clauses.push({ field: compMatch[1], op: compMatch[2], value: compMatch[3] });
      continue;
    }
  }
  return clauses;
}

/** Apply parsed clauses to filter an array of records. */
function applyPredicates(
  records: Array<Record<string, unknown>>,
  clauses: Array<{ field: string; op: string; value: string }>,
): Array<Record<string, unknown>> {
  return records.filter(record => {
    return clauses.every(clause => {
      // Skip schema clauses — handled separately via membership join
      if (clause.field === 'schema') return true;

      const fieldVal = record[clause.field];
      const strVal = fieldVal != null ? String(fieldVal) : '';

      switch (clause.op) {
        case '=': return strVal === clause.value;
        case '!=': return strVal !== clause.value;
        case '>': return strVal > clause.value;
        case '<': return strVal < clause.value;
        case '>=': return strVal >= clause.value;
        case '<=': return strVal <= clause.value;
        case 'contains': return strVal.toLowerCase().includes(clause.value.toLowerCase());
        case 'in': {
          const allowed: string[] = JSON.parse(clause.value);
          return allowed.includes(strVal);
        }
        default: return true;
      }
    });
  });
}

/** Apply sort clauses (e.g., "createdAt DESC") to records. */
function applySorts(
  records: Array<Record<string, unknown>>,
  sorts: string[],
): Array<Record<string, unknown>> {
  if (sorts.length === 0) return records;
  const sorted = [...records];
  for (const sortClause of sorts) {
    const [field, direction] = sortClause.split(/\s+/);
    const desc = direction?.toUpperCase() === 'DESC';
    sorted.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return desc ? 1 : -1;
      if (bVal == null) return desc ? -1 : 1;
      if (aVal < bVal) return desc ? 1 : -1;
      if (aVal > bVal) return desc ? -1 : 1;
      return 0;
    });
  }
  return sorted;
}

const _queryHandler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const query = input.query as string;
    const expression = input.expression as string;
    // source: the storage relation to query against (e.g. 'node', 'schema', 'view', 'workflow')
    // Defaults to 'node' (ContentNode) for backward compatibility.
    const source = (input.source as string | undefined) ?? 'node';

    let p = createProgram();

    if (!expression || expression.trim().length === 0) {
      return complete(p, 'error', { message: 'The expression contains invalid syntax' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Parse and validate the expression
    const clauses = parseExpression(expression);

    p = put(p, 'query', query, {
      query,
      expression,
      source,
      parsedClauses: JSON.stringify(clauses),
      filters: JSON.stringify([]),
      sorts: JSON.stringify([]),
      scope: '',
      isLive: false,
    });

    return complete(p, 'ok', { query }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        // Determine source relation — fetch from whichever concept's storage this query targets.
        // Also fetch memberships for schema enrichment (only used when source is 'node').
        // We always fetch memberships so mapBindings can decide whether to use them.
        let b2 = mapBindings(b, (bindings) => {
          return (bindings.record as Record<string, unknown>).source ?? 'node';
        }, 'sourceRelation');

        // Fetch from multiple relations — the mapBindings below will pick
        // the right one based on sourceRelation. We fetch common relations
        // that concept handlers store into. The storage adapter returns []
        // for relations that don't exist, so this is safe.
        b2 = find(b2, 'node', {}, 'rel_node');
        b2 = find(b2, 'schema', {}, 'rel_schema');
        b2 = find(b2, 'view', {}, 'rel_view');
        b2 = find(b2, 'workflow', {}, 'rel_workflow');
        b2 = find(b2, 'query', {}, 'rel_query');
        b2 = find(b2, 'featureFlag', {}, 'rel_featureFlag');
        b2 = find(b2, 'membership', {}, 'allMemberships');

        b2 = mapBindings(b2, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const expression = record.expression as string;
          const source = (record.source as string) ?? 'node';
          const storedFilters: string[] = (() => {
            try { const f = JSON.parse(record.filters as string); return Array.isArray(f) ? f : []; }
            catch { return []; }
          })();
          const storedSorts: string[] = (() => {
            try { const s = JSON.parse(record.sorts as string); return Array.isArray(s) ? s : []; }
            catch { return []; }
          })();

          // Pick the right relation's data based on source
          const relationKey = `rel_${source}`;
          const sourceData = (bindings[relationKey] as Array<Record<string, unknown>>) || [];
          const memberships = (bindings.allMemberships as Array<Record<string, unknown>>) || [];

          // Schema enrichment: only for ContentNode source ('node')
          const isContentNode = source === 'node';
          let records: Array<Record<string, unknown>>;

          if (isContentNode) {
            // Build entity→schemas map
            const schemasByEntity = new Map<string, string[]>();
            for (const m of memberships) {
              const eid = m.entity_id as string;
              const s = m.schema as string;
              if (!eid || !s) continue;
              const existing = schemasByEntity.get(eid) ?? [];
              existing.push(s);
              schemasByEntity.set(eid, existing);
            }
            // Enrich nodes with schemas
            records = sourceData.map(n => ({
              ...n,
              schemas: schemasByEntity.get(n.node as string) ?? [],
            }));
          } else {
            records = sourceData;
          }

          // Parse expression clauses
          const clauses = parseExpression(expression);

          // Handle schema predicates (only meaningful for ContentNode source)
          if (isContentNode) {
            const schemaClauses = clauses.filter(c => c.field === 'schema');
            for (const sc of schemaClauses) {
              if (sc.op === '=') {
                records = records.filter(n =>
                  (n.schemas as string[]).includes(sc.value),
                );
              } else if (sc.op === '!=') {
                records = records.filter(n =>
                  !(n.schemas as string[]).includes(sc.value),
                );
              } else if (sc.op === 'in') {
                const allowed: string[] = JSON.parse(sc.value);
                records = records.filter(n =>
                  (n.schemas as string[]).some(s => allowed.includes(s)),
                );
              }
            }
          }

          // Apply all non-schema field predicates (works for any source)
          const fieldClauses = clauses.filter(c => c.field !== 'schema');
          for (const f of storedFilters) {
            fieldClauses.push(...parseExpression(f));
          }
          let results = applyPredicates(records, fieldClauses);

          // Apply sorts
          results = applySorts(results, storedSorts);

          return JSON.stringify({
            items: results,
            resultCount: results.length,
            executedAt: new Date().toISOString(),
          });
        }, 'queryResult');
        return completeFrom(b2, 'ok', (bindings) => {
          const result = JSON.parse(bindings.queryResult as string);
          return { results: JSON.stringify(result.items), resultCount: result.resultCount };
        });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        const subscriptionId = randomBytes(16).toString('hex');
        let b2 = put(b, 'query', query, { isLive: true });
        return complete(b2, 'ok', { subscriptionId });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addFilter(input: Record<string, unknown>) {
    if (!input.filter || (typeof input.filter === 'string' && (input.filter as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'filter is required' }) as StorageProgram<Result>;
    }
    const query = input.query as string;
    const filter = input.filter as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { filters: JSON.stringify([filter]) });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addSort(input: Record<string, unknown>) {
    if (!input.sort || (typeof input.sort === 'string' && (input.sort as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sort is required' }) as StorageProgram<Result>;
    }
    const query = input.query as string;
    const sort = input.sort as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { sorts: JSON.stringify([sort]) });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setScope(input: Record<string, unknown>) {
    if (!input.scope || (typeof input.scope === 'string' && (input.scope as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }
    const query = input.query as string;
    const scope = input.scope as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { scope });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const queryHandler = autoInterpret(_queryHandler);

