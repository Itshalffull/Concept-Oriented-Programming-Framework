// Query — handler.ts
// Structured retrieval with filter/sort/scope/pagination, expression parsing,
// execution against stored content, and live subscription management.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  QueryStorage,
  QueryParseInput,
  QueryParseOutput,
  QueryExecuteInput,
  QueryExecuteOutput,
  QuerySubscribeInput,
  QuerySubscribeOutput,
  QueryAddFilterInput,
  QueryAddFilterOutput,
  QueryAddSortInput,
  QueryAddSortOutput,
  QuerySetScopeInput,
  QuerySetScopeOutput,
} from './types.js';

import {
  parseOk,
  parseError,
  executeOk,
  executeNotfound,
  subscribeOk,
  subscribeNotfound,
  addFilterOk,
  addFilterNotfound,
  addSortOk,
  addSortNotfound,
  setScopeOk,
  setScopeNotfound,
} from './types.js';

export interface QueryError {
  readonly code: string;
  readonly message: string;
}

export interface QueryHandler {
  readonly parse: (
    input: QueryParseInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QueryParseOutput>;
  readonly execute: (
    input: QueryExecuteInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QueryExecuteOutput>;
  readonly subscribe: (
    input: QuerySubscribeInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QuerySubscribeOutput>;
  readonly addFilter: (
    input: QueryAddFilterInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QueryAddFilterOutput>;
  readonly addSort: (
    input: QueryAddSortInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QueryAddSortOutput>;
  readonly setScope: (
    input: QuerySetScopeInput,
    storage: QueryStorage,
  ) => TE.TaskEither<QueryError, QuerySetScopeOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): QueryError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON string array safely. */
const parseJsonArray = (raw: unknown): readonly Record<string, unknown>[] => {
  if (typeof raw !== 'string') return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

/**
 * Parse a simple query expression of the form "field operator 'value'"
 * into a structured filter. Supports: =, !=, >, <, >=, <=, contains, starts_with.
 */
interface ParsedClause {
  readonly field: string;
  readonly operator: string;
  readonly value: string;
}

const parseExpression = (expr: string): E.Either<string, readonly ParsedClause[]> => {
  const clauses: ParsedClause[] = [];
  // Split on ' AND ' (case-insensitive)
  const parts = expr.split(/\s+AND\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match patterns like: field = 'value', field > 10, field contains 'text'
    const match = trimmed.match(
      /^(\w+)\s*(=|!=|>=|<=|>|<|contains|starts_with)\s*['"]?([^'"]*?)['"]?$/i,
    );

    if (!match) {
      return E.left(`Invalid clause: '${trimmed}'. Expected format: field operator 'value'`);
    }

    clauses.push({
      field: match[1],
      operator: match[2].toLowerCase(),
      value: match[3],
    });
  }

  return clauses.length > 0
    ? E.right(clauses)
    : E.left('Expression produced no valid clauses');
};

/** Evaluate a single clause against a record. */
const evaluateClause = (
  record: Record<string, unknown>,
  clause: ParsedClause,
): boolean => {
  const fieldValue = record[clause.field];
  if (fieldValue === undefined) return false;

  const strValue = String(fieldValue);
  const numValue = Number(fieldValue);
  const clauseNum = Number(clause.value);

  switch (clause.operator) {
    case '=':
      return strValue === clause.value;
    case '!=':
      return strValue !== clause.value;
    case '>':
      return !isNaN(numValue) && !isNaN(clauseNum) && numValue > clauseNum;
    case '<':
      return !isNaN(numValue) && !isNaN(clauseNum) && numValue < clauseNum;
    case '>=':
      return !isNaN(numValue) && !isNaN(clauseNum) && numValue >= clauseNum;
    case '<=':
      return !isNaN(numValue) && !isNaN(clauseNum) && numValue <= clauseNum;
    case 'contains':
      return strValue.toLowerCase().includes(clause.value.toLowerCase());
    case 'starts_with':
      return strValue.toLowerCase().startsWith(clause.value.toLowerCase());
    default:
      return false;
  }
};

/** Apply sort clauses. Format: "field:asc" or "field:desc". */
const applySorts = (
  records: readonly Record<string, unknown>[],
  sorts: readonly string[],
): readonly Record<string, unknown>[] => {
  if (sorts.length === 0) return records;

  const mutable = [...records];
  for (const sortSpec of sorts) {
    const [field, dir] = sortSpec.split(':');
    const ascending = dir !== 'desc';

    mutable.sort((a, b) => {
      const va = String(a[field] ?? '');
      const vb = String(b[field] ?? '');
      const numA = Number(va);
      const numB = Number(vb);

      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      return ascending ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  return mutable;
};

// --- Implementation ---

export const queryHandler: QueryHandler = {
  /**
   * Parse a query expression into a structured representation and persist it.
   * Validates syntax and field references before storing the parsed query.
   */
  parse: (input, storage) =>
    pipe(
      parseExpression(input.expression),
      E.fold(
        (err) => TE.right(parseError(err)),
        (clauses) =>
          pipe(
            TE.tryCatch(
              () =>
                storage.put('queries', input.query, {
                  queryId: input.query,
                  expression: input.expression,
                  clauses: JSON.stringify(clauses),
                  filters: JSON.stringify([]),
                  sorts: JSON.stringify([]),
                  scope: '',
                  isLive: false,
                  createdAt: new Date().toISOString(),
                }),
              storageErr,
            ),
            TE.map(() => parseOk(input.query)),
          ),
      ),
    ),

  /**
   * Execute a parsed query against the scoped content.
   * Applies all clauses, additional filters, and sorts to the result set.
   */
  execute: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queries', input.query),
        storageErr,
      ),
      TE.chain((queryRec) =>
        pipe(
          O.fromNullable(queryRec),
          O.fold(
            () => TE.right(executeNotfound(input.query)),
            (found) => {
              const clauses = parseJsonArray(found['clauses']) as readonly ParsedClause[];
              const additionalFilters = parseJsonArray(found['filters']) as readonly ParsedClause[];
              const sorts = (() => {
                try {
                  const s = JSON.parse(String(found['sorts'] ?? '[]'));
                  return Array.isArray(s) ? s : [];
                } catch {
                  return [];
                }
              })();
              const scope = String(found['scope'] ?? '');

              const allClauses = [...clauses, ...additionalFilters];

              return pipe(
                TE.tryCatch(
                  () =>
                    scope
                      ? storage.find('content', { scope })
                      : storage.find('content'),
                  storageErr,
                ),
                TE.map((records) => {
                  // Apply all filter clauses
                  const filtered = records.filter((rec) =>
                    allClauses.every((clause) =>
                      evaluateClause(
                        rec as Record<string, unknown>,
                        clause as ParsedClause,
                      ),
                    ),
                  );

                  // Apply sorts
                  const sorted = applySorts(
                    filtered as readonly Record<string, unknown>[],
                    sorts as readonly string[],
                  );

                  return executeOk(JSON.stringify(sorted));
                }),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Activate a live subscription for a parsed query.
   * Generates a subscription ID and marks the query as live.
   */
  subscribe: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queries', input.query),
        storageErr,
      ),
      TE.chain((queryRec) =>
        pipe(
          O.fromNullable(queryRec),
          O.fold(
            () => TE.right(subscribeNotfound(input.query)),
            (found) => {
              const subscriptionId = `sub-${input.query}-${Date.now()}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    // Mark query as live
                    await storage.put('queries', input.query, {
                      ...found,
                      isLive: true,
                    });
                    // Store subscription record
                    await storage.put('subscriptions', subscriptionId, {
                      subscriptionId,
                      queryId: input.query,
                      active: true,
                      createdAt: new Date().toISOString(),
                    });
                  },
                  storageErr,
                ),
                TE.map(() => subscribeOk(subscriptionId)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Append a filter clause to an existing query.
   * Parses the filter string and adds it to the query's filter list.
   */
  addFilter: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queries', input.query),
        storageErr,
      ),
      TE.chain((queryRec) =>
        pipe(
          O.fromNullable(queryRec),
          O.fold(
            () => TE.right(addFilterNotfound(input.query)),
            (found) =>
              pipe(
                parseExpression(input.filter),
                E.fold(
                  () => TE.right(addFilterNotfound(input.query)),
                  (newClauses) => {
                    const existingFilters = parseJsonArray(found['filters']);
                    const updatedFilters = [
                      ...existingFilters,
                      ...newClauses,
                    ];

                    return pipe(
                      TE.tryCatch(
                        () =>
                          storage.put('queries', input.query, {
                            ...found,
                            filters: JSON.stringify(updatedFilters),
                          }),
                        storageErr,
                      ),
                      TE.map(() => addFilterOk(input.query)),
                    );
                  },
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Append a sort clause to an existing query.
   * Format: "field:asc" or "field:desc".
   */
  addSort: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queries', input.query),
        storageErr,
      ),
      TE.chain((queryRec) =>
        pipe(
          O.fromNullable(queryRec),
          O.fold(
            () => TE.right(addSortNotfound(input.query)),
            (found) => {
              const existingSorts = (() => {
                try {
                  const s = JSON.parse(String(found['sorts'] ?? '[]'));
                  return Array.isArray(s) ? s : [];
                } catch {
                  return [];
                }
              })();

              const updatedSorts = [...existingSorts, input.sort];

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('queries', input.query, {
                      ...found,
                      sorts: JSON.stringify(updatedSorts),
                    }),
                  storageErr,
                ),
                TE.map(() => addSortOk(input.query)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Restrict the query to a named content scope.
   * Updates the scope field on the stored query record.
   */
  setScope: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('queries', input.query),
        storageErr,
      ),
      TE.chain((queryRec) =>
        pipe(
          O.fromNullable(queryRec),
          O.fold(
            () => TE.right(setScopeNotfound(input.query)),
            (found) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('queries', input.query, {
                      ...found,
                      scope: input.scope,
                    }),
                  storageErr,
                ),
                TE.map(() => setScopeOk(input.query)),
              ),
          ),
        ),
      ),
    ),
};
