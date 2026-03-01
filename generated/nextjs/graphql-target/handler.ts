// GraphqlTarget — Generates GraphQL schema types, queries, mutations, and subscriptions
// from concept projections. Detects federation conflicts and cyclic type references.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GraphqlTargetStorage,
  GraphqlTargetGenerateInput,
  GraphqlTargetGenerateOutput,
  GraphqlTargetValidateInput,
  GraphqlTargetValidateOutput,
  GraphqlTargetListOperationsInput,
  GraphqlTargetListOperationsOutput,
} from './types.js';

import {
  generateOk,
  generateFederationConflict,
  validateOk,
  validateCyclicType,
  listOperationsOk,
} from './types.js';

export interface GraphqlTargetError {
  readonly code: string;
  readonly message: string;
}

export interface GraphqlTargetHandler {
  readonly generate: (
    input: GraphqlTargetGenerateInput,
    storage: GraphqlTargetStorage,
  ) => TE.TaskEither<GraphqlTargetError, GraphqlTargetGenerateOutput>;
  readonly validate: (
    input: GraphqlTargetValidateInput,
    storage: GraphqlTargetStorage,
  ) => TE.TaskEither<GraphqlTargetError, GraphqlTargetValidateOutput>;
  readonly listOperations: (
    input: GraphqlTargetListOperationsInput,
    storage: GraphqlTargetStorage,
  ) => TE.TaskEither<GraphqlTargetError, GraphqlTargetListOperationsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GraphqlTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a projection into concept metadata. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly fields: readonly string[];
  readonly actions: readonly string[];
  readonly refs: readonly string[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      fields: (parsed['fields'] as readonly string[] | undefined) ?? [],
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
      refs: (parsed['refs'] as readonly string[] | undefined) ?? [],
    })),
    O.getOrElse(() => ({
      concept: projection,
      fields: [] as readonly string[],
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
      refs: [] as readonly string[],
    })),
  );

/** Convert a concept name to PascalCase GraphQL type name. */
const toTypeName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Determine whether an action maps to a query, mutation, or subscription. */
const classifyAction = (action: string): 'query' | 'mutation' | 'subscription' => {
  const verb = action.toLowerCase();
  if (['get', 'list', 'find', 'fetch', 'read', 'search'].includes(verb)) return 'query';
  if (['subscribe', 'watch', 'observe', 'stream'].includes(verb)) return 'subscription';
  return 'mutation';
};

/** Detect cycles in type references using DFS. Returns the cycle path or empty array. */
const detectCycle = (
  typeName: string,
  refs: ReadonlyMap<string, readonly string[]>,
  visited: ReadonlySet<string>,
  path: readonly string[],
): readonly string[] => {
  if (visited.has(typeName)) {
    const cycleStart = path.indexOf(typeName);
    return cycleStart >= 0 ? [...path.slice(cycleStart), typeName] : [];
  }
  const typeRefs = refs.get(typeName) ?? [];
  const nextVisited = new Set(visited);
  nextVisited.add(typeName);
  const nextPath = [...path, typeName];
  for (const ref of typeRefs) {
    const cycle = detectCycle(ref, refs, nextVisited, nextPath);
    if (cycle.length > 0) return cycle;
  }
  return [];
};

// --- Implementation ---

export const graphqlTargetHandler: GraphqlTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, fields, actions, refs } = parseProjection(input.projection);
          const typeName = toTypeName(concept);

          // Check for federation conflict: if the type already exists from another projection
          const existing = await storage.get('types', typeName);
          if (existing !== null) {
            const existingConcept = existing['concept'] as string | undefined;
            if (existingConcept !== undefined && existingConcept !== concept) {
              return generateFederationConflict(
                typeName,
                `Type '${typeName}' already defined by concept '${existingConcept}'; federation key conflict`,
              );
            }
          }

          // Build type definitions
          const types: string[] = [typeName];
          const files: string[] = [];

          // Classify actions into operations
          const queries: string[] = [];
          const mutations: string[] = [];
          const subscriptions: string[] = [];

          for (const action of actions) {
            const opName = `${action}${typeName}`;
            const kind = classifyAction(action);
            if (kind === 'query') queries.push(opName);
            else if (kind === 'mutation') mutations.push(opName);
            else subscriptions.push(opName);
          }

          // Store the generated type
          await storage.put('types', typeName, {
            concept,
            typeName,
            fields: [...fields],
            refs: [...refs],
            queries: [...queries],
            mutations: [...mutations],
            subscriptions: [...subscriptions],
          });

          const fileName = `${concept}.graphql`;
          files.push(fileName);

          await storage.put('files', fileName, {
            concept,
            typeName,
            fileName,
          });

          return generateOk(types, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Load all types and their refs to check for cycles
          const allTypes = await storage.find('types');
          const refMap = new Map<string, readonly string[]>();
          for (const record of allTypes) {
            const name = record['typeName'] as string;
            const refs = (record['refs'] as readonly string[] | undefined) ?? [];
            refMap.set(name, refs.map(toTypeName));
          }

          const cycle = detectCycle(input.type, refMap, new Set(), []);
          if (cycle.length > 0) {
            return validateCyclicType(input.type, cycle);
          }

          return validateOk(input.type);
        },
        storageError,
      ),
    ),

  listOperations: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allTypes = await storage.find('types', { concept: input.concept });
          const queries: string[] = [];
          const mutations: string[] = [];
          const subscriptions: string[] = [];

          for (const record of allTypes) {
            queries.push(...((record['queries'] as readonly string[] | undefined) ?? []));
            mutations.push(...((record['mutations'] as readonly string[] | undefined) ?? []));
            subscriptions.push(...((record['subscriptions'] as readonly string[] | undefined) ?? []));
          }

          return listOperationsOk(queries, mutations, subscriptions);
        },
        storageError,
      ),
    ),
};
