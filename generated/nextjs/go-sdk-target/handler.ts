// GoSdkTarget — Generates Go API client modules from concept projections.
// Produces Go module-compatible packages with typed structs, interfaces, and HTTP clients.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GoSdkTargetStorage,
  GoSdkTargetGenerateInput,
  GoSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface GoSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface GoSdkTargetHandler {
  readonly generate: (
    input: GoSdkTargetGenerateInput,
    storage: GoSdkTargetStorage,
  ) => TE.TaskEither<GoSdkTargetError, GoSdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GoSdkTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Default Go module path prefix for generated clients. */
const DEFAULT_MODULE_PREFIX = 'github.com/clef-sdk';

/** Parse a projection into concept metadata. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly string[];
  readonly fields: readonly { readonly name: string; readonly type: string }[];
  readonly modulePrefix: string;
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly string[] | undefined) ?? ['create', 'get', 'list', 'update', 'delete'],
      fields: (parsed['fields'] as readonly { name: string; type: string }[] | undefined) ?? [],
      modulePrefix: (parsed['modulePrefix'] as string | undefined) ?? DEFAULT_MODULE_PREFIX,
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: ['create', 'get', 'list', 'update', 'delete'] as readonly string[],
      fields: [] as readonly { readonly name: string; readonly type: string }[],
      modulePrefix: DEFAULT_MODULE_PREFIX,
    })),
  );

/** Convert a concept name to a lowercase Go package name. */
const toPackageName = (concept: string): string =>
  concept.replace(/([A-Z])/g, '$1').toLowerCase();

/** Convert a concept name to a Go module path. */
const toModulePath = (prefix: string, concept: string): string =>
  `${prefix}/${toPackageName(concept)}`;

/** Convert concept name to an exported Go struct name (PascalCase). */
const toStructName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Map a TypeScript-like type to its Go equivalent. */
const toGoType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'string',
    number: 'float64',
    integer: 'int64',
    boolean: 'bool',
    object: 'map[string]interface{}',
    array: '[]interface{}',
    date: 'time.Time',
  };
  return mapping[tsType.toLowerCase()] ?? 'string';
};

/** Convert an action name to an exported Go method name (PascalCase). */
const toMethodName = (action: string): string =>
  action.charAt(0).toUpperCase() + action.slice(1);

/** Convert a field name to an exported Go field name (PascalCase). */
const toFieldName = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1);

// --- Implementation ---

export const goSdkTargetHandler: GoSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, fields, modulePrefix } = parseProjection(input.projection);
          const modulePath = toModulePath(modulePrefix, concept);
          const structName = toStructName(concept);
          const packageName = toPackageName(concept);
          const files: string[] = [];

          // Go module structure
          files.push('go.mod');
          files.push('go.sum');

          // Client file with interface and implementation
          const clientFile = `${packageName}/client.go`;
          files.push(clientFile);

          // Types file with request/response structs
          const typesFile = `${packageName}/types.go`;
          files.push(typesFile);

          // Errors file
          const errorsFile = `${packageName}/errors.go`;
          files.push(errorsFile);

          // Options file (functional options pattern)
          const optionsFile = `${packageName}/options.go`;
          files.push(optionsFile);

          // Generate method metadata for each action
          const methods: string[] = [];
          for (const action of actions) {
            const methodName = toMethodName(action);
            methods.push(methodName);

            await storage.put('methods', `${modulePath}.${methodName}`, {
              concept,
              modulePath,
              structName,
              methodName,
              action,
              signature: `func (c *Client) ${methodName}(ctx context.Context, req *${structName}${methodName}Request) (*${structName}${methodName}Response, error)`,
            });
          }

          // Store field type mappings for struct generation
          const goFields = fields.map((f) => ({
            name: toFieldName(f.name),
            goType: toGoType(f.type),
            jsonTag: f.name,
          }));

          await storage.put('modules', modulePath, {
            concept,
            modulePath,
            packageName,
            structName,
            methods: [...methods],
            fields: [...goFields],
            files: [...files],
          });

          return generateOk(modulePath, files);
        },
        storageError,
      ),
    ),
};
