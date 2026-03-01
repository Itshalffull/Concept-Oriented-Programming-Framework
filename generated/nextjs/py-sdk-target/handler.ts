// PySdkTarget — Generates Python typed API client packages from concept projections.
// Produces Pydantic models, async httpx clients, and typed method signatures.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PySdkTargetStorage,
  PySdkTargetGenerateInput,
  PySdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface PySdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface PySdkTargetHandler {
  readonly generate: (
    input: PySdkTargetGenerateInput,
    storage: PySdkTargetStorage,
  ) => TE.TaskEither<PySdkTargetError, PySdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): PySdkTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a projection into concept metadata with actions and fields. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly string[];
  readonly fields: readonly { readonly name: string; readonly type: string }[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
      fields: (parsed['fields'] as readonly { name: string; type: string }[] | undefined) ?? [],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
      fields: [] as readonly { readonly name: string; readonly type: string }[],
    })),
  );

/** Convert a concept name to a snake_case Python package name. */
const toPackageName = (concept: string): string =>
  concept.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + '_client';

/** Convert concept name to PascalCase for Python class names. */
const toClassName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Map a TypeScript-like type to its Python type hint. */
const toPythonType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'str',
    number: 'float',
    integer: 'int',
    boolean: 'bool',
    object: 'dict[str, Any]',
    array: 'list[Any]',
    date: 'datetime',
  };
  return mapping[tsType.toLowerCase()] ?? 'str';
};

/** Convert an action name to a snake_case Python method name. */
const toMethodName = (action: string): string =>
  action.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

// --- Implementation ---

export const pySdkTargetHandler: PySdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, fields } = parseProjection(input.projection);
          const packageName = toPackageName(concept);
          const className = toClassName(concept);
          const files: string[] = [];

          // Package structure
          files.push(`${packageName}/__init__.py`);
          files.push(`${packageName}/client.py`);
          files.push(`${packageName}/models.py`);
          files.push(`${packageName}/exceptions.py`);
          files.push('pyproject.toml');

          // Generate method metadata for each action
          const methods: string[] = [];
          for (const action of actions) {
            const methodName = toMethodName(action);
            methods.push(methodName);

            await storage.put('methods', `${packageName}.${methodName}`, {
              concept,
              packageName,
              className,
              methodName,
              action,
              isAsync: true,
              returnType: `${className}Response`,
            });
          }

          // Store field type mappings for Pydantic model generation
          const pythonFields = fields.map((f) => ({
            name: toMethodName(f.name),
            pythonType: toPythonType(f.type),
          }));

          await storage.put('packages', packageName, {
            concept,
            packageName,
            className,
            methods: [...methods],
            fields: [...pythonFields],
            files: [...files],
            dependencies: ['httpx', 'pydantic'],
          });

          return generateOk(packageName, files);
        },
        storageError,
      ),
    ),
};
