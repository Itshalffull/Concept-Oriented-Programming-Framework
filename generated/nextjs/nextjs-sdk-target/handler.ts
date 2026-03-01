// NextjsSdkTarget — Generates Next.js SDK code including React hooks (useQuery/useMutation),
// server actions, and typed API client wrappers from concept projections.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NextjsSdkTargetStorage,
  NextjsSdkTargetGenerateInput,
  NextjsSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface NextjsSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface NextjsSdkTargetHandler {
  readonly generate: (
    input: NextjsSdkTargetGenerateInput,
    storage: NextjsSdkTargetStorage,
  ) => TE.TaskEither<NextjsSdkTargetError, NextjsSdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): NextjsSdkTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a projection into concept metadata with actions. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly string[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
    })),
  );

/** Convert a concept name to a kebab-case package directory. */
const toPackageName = (concept: string): string =>
  concept.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

/** Classify an action as a query (read) or mutation (write) for hook generation. */
const isQueryAction = (action: string): boolean => {
  const verb = action.toLowerCase();
  return ['get', 'list', 'find', 'fetch', 'read', 'search', 'count'].includes(verb);
};

/** Generate the hook name for a given concept and action (e.g., useGetUser, useCreateUser). */
const toHookName = (concept: string, action: string): string => {
  const pascalAction = action.charAt(0).toUpperCase() + action.slice(1);
  const pascalConcept = concept.charAt(0).toUpperCase() + concept.slice(1);
  return `use${pascalAction}${pascalConcept}`;
};

/** Generate the server action name for a given concept and action. */
const toServerActionName = (concept: string, action: string): string => {
  const camelAction = action.charAt(0).toLowerCase() + action.slice(1);
  const pascalConcept = concept.charAt(0).toUpperCase() + concept.slice(1);
  return `${camelAction}${pascalConcept}Action`;
};

// --- Implementation ---

export const nextjsSdkTargetHandler: NextjsSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions } = parseProjection(input.projection);
          const packageName = toPackageName(concept);
          const files: string[] = [];

          // Generate hook file
          const hooks: string[] = [];
          const serverActions: string[] = [];

          for (const action of actions) {
            const hookName = toHookName(concept, action);
            hooks.push(hookName);

            const serverActionName = toServerActionName(concept, action);
            serverActions.push(serverActionName);

            const isQuery = isQueryAction(action);

            await storage.put('hooks', hookName, {
              concept,
              hookName,
              action,
              kind: isQuery ? 'query' : 'mutation',
            });

            await storage.put('server-actions', serverActionName, {
              concept,
              serverActionName,
              action,
            });
          }

          // Track generated files
          const hooksFile = `${packageName}/hooks.ts`;
          const actionsFile = `${packageName}/actions.ts`;
          const typesFile = `${packageName}/types.ts`;
          const indexFile = `${packageName}/index.ts`;
          files.push(hooksFile, actionsFile, typesFile, indexFile);

          await storage.put('packages', packageName, {
            concept,
            packageName,
            hooks: [...hooks],
            serverActions: [...serverActions],
            files: [...files],
          });

          return generateOk(packageName, files);
        },
        storageError,
      ),
    ),
};
