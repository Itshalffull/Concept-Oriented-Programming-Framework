// RestTarget — Generates REST endpoint definitions from concept projections.
// Maps concept actions to HTTP methods and validates route uniqueness.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RestTargetStorage,
  RestTargetGenerateInput,
  RestTargetGenerateOutput,
  RestTargetValidateInput,
  RestTargetValidateOutput,
  RestTargetListRoutesInput,
  RestTargetListRoutesOutput,
} from './types.js';

import {
  generateOk,
  generateAmbiguousMapping,
  validateOk,
  validatePathConflict,
  listRoutesOk,
} from './types.js';

export interface RestTargetError {
  readonly code: string;
  readonly message: string;
}

export interface RestTargetHandler {
  readonly generate: (
    input: RestTargetGenerateInput,
    storage: RestTargetStorage,
  ) => TE.TaskEither<RestTargetError, RestTargetGenerateOutput>;
  readonly validate: (
    input: RestTargetValidateInput,
    storage: RestTargetStorage,
  ) => TE.TaskEither<RestTargetError, RestTargetValidateOutput>;
  readonly listRoutes: (
    input: RestTargetListRoutesInput,
    storage: RestTargetStorage,
  ) => TE.TaskEither<RestTargetError, RestTargetListRoutesOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): RestTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map a concept action verb to an HTTP method. Returns undefined for ambiguous mappings. */
const actionToMethod = (action: string): string | undefined => {
  const verb = action.toLowerCase();
  const mapping: Record<string, string> = {
    create: 'POST',
    add: 'POST',
    register: 'POST',
    get: 'GET',
    read: 'GET',
    list: 'GET',
    fetch: 'GET',
    find: 'GET',
    update: 'PUT',
    modify: 'PUT',
    set: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    remove: 'DELETE',
    destroy: 'DELETE',
  };
  return mapping[verb];
};

/** Parse a projection string into its component parts (concept name, actions). */
const parseProjection = (projection: string): { readonly concept: string; readonly actions: readonly string[] } =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.chain((parsed) =>
      pipe(
        O.fromNullable(parsed['concept'] as string | undefined),
        O.map((concept) => ({
          concept,
          actions: (parsed['actions'] as readonly string[] | undefined) ?? [],
        })),
      ),
    ),
    O.getOrElse(() => ({
      concept: projection.replace(/[^a-zA-Z0-9]/g, '-'),
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
    })),
  );

/** Convert a concept name to a REST resource path segment. */
const toResourcePath = (concept: string): string =>
  concept.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

/** Normalize a route path to a canonical form for conflict detection. */
const normalizeRoute = (route: string): string =>
  route.replace(/\/\{[^}]+\}/g, '/:param').toLowerCase();

// --- Implementation ---

export const restTargetHandler: RestTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions } = parseProjection(input.projection);
          const resourcePath = toResourcePath(concept);
          const routes: string[] = [];
          const files: string[] = [];
          const methods: string[] = [];

          for (const action of actions) {
            const method = actionToMethod(action);
            if (method === undefined) {
              return generateAmbiguousMapping(
                action,
                `Cannot map action '${action}' to an HTTP method unambiguously`,
              );
            }
            const isItemAction = method === 'GET' && action !== 'list' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
            const route = isItemAction
              ? `/api/${resourcePath}/{id}`
              : `/api/${resourcePath}`;
            routes.push(`${method} ${route}`);
            methods.push(method);
          }

          const fileName = `${resourcePath}.routes.ts`;
          files.push(fileName);

          // Persist each route for later validation and listing
          for (const route of routes) {
            await storage.put('routes', route, {
              concept,
              route,
              method: route.split(' ')[0],
              path: route.split(' ')[1],
            });
          }

          await storage.put('files', fileName, {
            concept,
            fileName,
            routes: [...routes],
            methods: [...methods],
          });

          return generateOk(routes, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRoutes = await storage.find('routes');
          const normalizedTarget = normalizeRoute(input.route);

          // Check for path conflicts: same normalized path but different original definition
          const conflict = allRoutes.find((record) => {
            const existingRoute = record['route'] as string | undefined;
            if (existingRoute === undefined || existingRoute === input.route) return false;
            const existingPath = existingRoute.split(' ')[1] ?? existingRoute;
            const targetPath = input.route.split(' ')[1] ?? input.route;
            const existingMethod = existingRoute.split(' ')[0];
            const targetMethod = input.route.split(' ')[0];
            return normalizeRoute(existingPath) === normalizeRoute(targetPath) &&
                   existingMethod === targetMethod;
          });

          return pipe(
            O.fromNullable(conflict),
            O.fold(
              () => validateOk(input.route),
              (c) => validatePathConflict(
                input.route,
                c['route'] as string,
                'Routes resolve to the same normalized path with the same HTTP method',
              ),
            ),
          );
        },
        storageError,
      ),
    ),

  listRoutes: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRoutes = await storage.find('routes', { concept: input.concept });
          const routes = allRoutes.map((r) => r['route'] as string).filter(Boolean);
          const methods = allRoutes.map((r) => r['method'] as string).filter(Boolean);
          return listRoutesOk(routes, methods);
        },
        storageError,
      ),
    ),
};
