// NextjsTarget — Generates Next.js App Router page and API route definitions
// from concept projections. Maps actions to route handlers and validates path uniqueness.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NextjsTargetStorage,
  NextjsTargetGenerateInput,
  NextjsTargetGenerateOutput,
  NextjsTargetValidateInput,
  NextjsTargetValidateOutput,
  NextjsTargetListRoutesInput,
  NextjsTargetListRoutesOutput,
} from './types.js';

import {
  generateOk,
  generateAmbiguousMapping,
  validateOk,
  validatePathConflict,
  listRoutesOk,
} from './types.js';

export interface NextjsTargetError {
  readonly code: string;
  readonly message: string;
}

export interface NextjsTargetHandler {
  readonly generate: (
    input: NextjsTargetGenerateInput,
    storage: NextjsTargetStorage,
  ) => TE.TaskEither<NextjsTargetError, NextjsTargetGenerateOutput>;
  readonly validate: (
    input: NextjsTargetValidateInput,
    storage: NextjsTargetStorage,
  ) => TE.TaskEither<NextjsTargetError, NextjsTargetValidateOutput>;
  readonly listRoutes: (
    input: NextjsTargetListRoutesInput,
    storage: NextjsTargetStorage,
  ) => TE.TaskEither<NextjsTargetError, NextjsTargetListRoutesOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): NextjsTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map a concept action to a Next.js route type (page vs API) and HTTP method. */
const classifyAction = (action: string): { readonly kind: 'page' | 'api'; readonly method: string } | undefined => {
  const verb = action.toLowerCase();
  const apiMapping: Record<string, string> = {
    create: 'POST',
    get: 'GET',
    list: 'GET',
    update: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
  };
  const pageMapping: ReadonlySet<string> = new Set(['view', 'show', 'display', 'render', 'edit', 'new']);

  if (pageMapping.has(verb)) return { kind: 'page', method: 'GET' };
  const method = apiMapping[verb];
  if (method !== undefined) return { kind: 'api', method };
  return undefined;
};

/** Parse a projection into concept metadata. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly string[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['list', 'get', 'create', 'update', 'delete', 'view'],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: ['list', 'get', 'create', 'update', 'delete', 'view'] as readonly string[],
    })),
  );

/** Convert concept name to a Next.js App Router path segment (kebab-case). */
const toRouteSegment = (concept: string): string =>
  concept.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

/** Determine if an action operates on a single item (needs [id] dynamic segment). */
const isItemAction = (action: string): boolean => {
  const verb = action.toLowerCase();
  return ['get', 'update', 'patch', 'delete', 'view', 'show', 'display', 'edit'].includes(verb);
};

/** Normalize a route for conflict comparison. */
const normalizeForConflict = (route: string): string =>
  route.replace(/\[[\w]+\]/g, '[param]').toLowerCase();

// --- Implementation ---

export const nextjsTargetHandler: NextjsTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions } = parseProjection(input.projection);
          const segment = toRouteSegment(concept);
          const routes: string[] = [];
          const files: string[] = [];
          const methods: string[] = [];

          for (const action of actions) {
            const classification = classifyAction(action);
            if (classification === undefined) {
              return generateAmbiguousMapping(
                action,
                `Action '${action}' cannot be mapped to a Next.js page or API route unambiguously`,
              );
            }

            const { kind, method } = classification;
            const needsId = isItemAction(action);

            if (kind === 'api') {
              const route = needsId
                ? `app/api/${segment}/[id]/route.ts`
                : `app/api/${segment}/route.ts`;
              routes.push(`${method} /${segment}${needsId ? '/[id]' : ''}`);
              if (!files.includes(route)) files.push(route);
              methods.push(method);
            } else {
              const route = needsId
                ? `app/${segment}/[id]/page.tsx`
                : action === 'new'
                  ? `app/${segment}/new/page.tsx`
                  : action === 'edit'
                    ? `app/${segment}/[id]/edit/page.tsx`
                    : `app/${segment}/page.tsx`;
              routes.push(`PAGE /${segment}${needsId ? '/[id]' : ''}${action === 'new' ? '/new' : action === 'edit' ? '/edit' : ''}`);
              if (!files.includes(route)) files.push(route);
              methods.push('GET');
            }

            await storage.put('routes', `${concept}:${action}`, {
              concept,
              action,
              kind,
              method,
              segment,
              route: routes[routes.length - 1],
            });
          }

          const metaFile = `${segment}.routes.ts`;
          files.push(metaFile);
          await storage.put('files', metaFile, {
            concept,
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
          const normalizedTarget = normalizeForConflict(input.route);

          const conflict = allRoutes.find((record) => {
            const existingRoute = record['route'] as string | undefined;
            if (existingRoute === undefined || existingRoute === input.route) return false;
            return normalizeForConflict(existingRoute) === normalizedTarget;
          });

          return pipe(
            O.fromNullable(conflict),
            O.fold(
              () => validateOk(input.route),
              (c) => validatePathConflict(
                input.route,
                c['route'] as string,
                'Routes resolve to the same Next.js App Router path after dynamic segment normalization',
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
          const conceptRoutes = await storage.find('routes', { concept: input.concept });
          const routes = conceptRoutes.map((r) => r['route'] as string).filter(Boolean);
          const methods = conceptRoutes.map((r) => r['method'] as string).filter(Boolean);
          return listRoutesOk(routes, methods);
        },
        storageError,
      ),
    ),
};
