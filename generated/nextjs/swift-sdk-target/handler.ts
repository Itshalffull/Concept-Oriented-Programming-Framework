// SwiftSdkTarget — Generates Swift async/await API client packages from concept projections.
// Produces Swift Package Manager-compatible modules with typed request/response models.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SwiftSdkTargetStorage,
  SwiftSdkTargetGenerateInput,
  SwiftSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface SwiftSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface SwiftSdkTargetHandler {
  readonly generate: (
    input: SwiftSdkTargetGenerateInput,
    storage: SwiftSdkTargetStorage,
  ) => TE.TaskEither<SwiftSdkTargetError, SwiftSdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): SwiftSdkTargetError => ({
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

/** Convert concept name to a PascalCase Swift type name. */
const toSwiftTypeName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Map a TypeScript-like type to its Swift equivalent. */
const toSwiftType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'String',
    number: 'Double',
    integer: 'Int',
    boolean: 'Bool',
    object: '[String: Any]',
    array: '[Any]',
    date: 'Date',
  };
  return mapping[tsType.toLowerCase()] ?? 'String';
};

/** Convert a concept name to a Swift Package name. */
const toPackageName = (concept: string): string =>
  `${toSwiftTypeName(concept)}Client`;

/** Generate the Swift method name for an action (e.g., "create" -> "create"). */
const toMethodName = (action: string): string =>
  action.charAt(0).toLowerCase() + action.slice(1);

// --- Implementation ---

export const swiftSdkTargetHandler: SwiftSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, fields } = parseProjection(input.projection);
          const packageName = toPackageName(concept);
          const typeName = toSwiftTypeName(concept);
          const files: string[] = [];

          // Model file with Codable struct
          const modelFile = `Sources/${packageName}/Models/${typeName}.swift`;
          files.push(modelFile);

          // Client file with async/await methods
          const clientFile = `Sources/${packageName}/${typeName}Client.swift`;
          files.push(clientFile);

          // Package.swift manifest
          const packageManifest = 'Package.swift';
          files.push(packageManifest);

          // Generate method metadata for each action
          const methods: string[] = [];
          for (const action of actions) {
            const methodName = toMethodName(action);
            methods.push(methodName);

            await storage.put('methods', `${packageName}.${methodName}`, {
              concept,
              packageName,
              methodName,
              action,
              isAsync: true,
              throwsError: true,
            });
          }

          // Store field type mappings
          const swiftFields = fields.map((f) => ({
            name: f.name,
            swiftType: toSwiftType(f.type),
          }));

          await storage.put('packages', packageName, {
            concept,
            packageName,
            typeName,
            methods: [...methods],
            fields: [...swiftFields],
            files: [...files],
          });

          return generateOk(packageName, files);
        },
        storageError,
      ),
    ),
};
