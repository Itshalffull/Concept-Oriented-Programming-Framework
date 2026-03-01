// RustSdkTarget — Generates Rust API client crates from concept projections.
// Produces async trait-based clients with serde-compatible request/response types.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RustSdkTargetStorage,
  RustSdkTargetGenerateInput,
  RustSdkTargetGenerateOutput,
} from './types.js';

import {
  generateOk,
} from './types.js';

export interface RustSdkTargetError {
  readonly code: string;
  readonly message: string;
}

export interface RustSdkTargetHandler {
  readonly generate: (
    input: RustSdkTargetGenerateInput,
    storage: RustSdkTargetStorage,
  ) => TE.TaskEither<RustSdkTargetError, RustSdkTargetGenerateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): RustSdkTargetError => ({
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

/** Convert a concept name to a snake_case Rust crate name. */
const toCrateName = (concept: string): string =>
  concept.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + '_client';

/** Convert a concept name to a PascalCase Rust struct name. */
const toStructName = (concept: string): string =>
  concept.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Map a TypeScript-like type to its Rust equivalent. */
const toRustType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'String',
    number: 'f64',
    integer: 'i64',
    boolean: 'bool',
    object: 'serde_json::Value',
    array: 'Vec<serde_json::Value>',
    date: 'chrono::DateTime<chrono::Utc>',
  };
  return mapping[tsType.toLowerCase()] ?? 'String';
};

/** Convert an action name to a snake_case Rust method name. */
const toMethodName = (action: string): string =>
  action.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

// --- Implementation ---

export const rustSdkTargetHandler: RustSdkTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions, fields } = parseProjection(input.projection);
          const crateName = toCrateName(concept);
          const structName = toStructName(concept);
          const files: string[] = [];

          // Cargo.toml
          files.push('Cargo.toml');

          // Main lib.rs
          files.push('src/lib.rs');

          // Types module with serde derives
          const typesFile = 'src/types.rs';
          files.push(typesFile);

          // Client module with async trait impl
          const clientFile = 'src/client.rs';
          files.push(clientFile);

          // Error module
          const errorFile = 'src/error.rs';
          files.push(errorFile);

          // Generate method metadata for each action
          const methods: string[] = [];
          for (const action of actions) {
            const methodName = toMethodName(action);
            methods.push(methodName);

            await storage.put('methods', `${crateName}::${methodName}`, {
              concept,
              crateName,
              methodName,
              action,
              isAsync: true,
              returnType: `Result<${structName}Response, ${structName}Error>`,
            });
          }

          // Store field type mappings for struct generation
          const rustFields = fields.map((f) => ({
            name: toMethodName(f.name),
            rustType: toRustType(f.type),
          }));

          await storage.put('crates', crateName, {
            concept,
            crateName,
            structName,
            methods: [...methods],
            fields: [...rustFields],
            files: [...files],
            dependencies: ['reqwest', 'serde', 'serde_json', 'tokio', 'thiserror'],
          });

          return generateOk(crateName, files);
        },
        storageError,
      ),
    ),
};
