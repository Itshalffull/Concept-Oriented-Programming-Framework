// OpenaiTarget — Generates OpenAI function calling schema definitions from concept projections.
// Enforces function count limits and validates that every function has a description.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  OpenaiTargetStorage,
  OpenaiTargetGenerateInput,
  OpenaiTargetGenerateOutput,
  OpenaiTargetValidateInput,
  OpenaiTargetValidateOutput,
  OpenaiTargetListFunctionsInput,
  OpenaiTargetListFunctionsOutput,
} from './types.js';

import {
  generateOk,
  generateTooManyFunctions,
  validateOk,
  validateMissingDescription,
  listFunctionsOk,
} from './types.js';

export interface OpenaiTargetError {
  readonly code: string;
  readonly message: string;
}

export interface OpenaiTargetHandler {
  readonly generate: (
    input: OpenaiTargetGenerateInput,
    storage: OpenaiTargetStorage,
  ) => TE.TaskEither<OpenaiTargetError, OpenaiTargetGenerateOutput>;
  readonly validate: (
    input: OpenaiTargetValidateInput,
    storage: OpenaiTargetStorage,
  ) => TE.TaskEither<OpenaiTargetError, OpenaiTargetValidateOutput>;
  readonly listFunctions: (
    input: OpenaiTargetListFunctionsInput,
    storage: OpenaiTargetStorage,
  ) => TE.TaskEither<OpenaiTargetError, OpenaiTargetListFunctionsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): OpenaiTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** OpenAI function calling limit per request. */
const FUNCTION_LIMIT = 128;

/** Parse a projection into concept metadata with action definitions. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly {
    readonly name: string;
    readonly description?: string;
    readonly parameters: readonly { readonly name: string; readonly type: string; readonly required: boolean }[];
  }[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly { name: string; description?: string; parameters: { name: string; type: string; required: boolean }[] }[] | undefined) ?? [],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: [
        { name: 'create', description: `Create a new ${projection}`, parameters: [{ name: 'data', type: 'object', required: true }] },
        { name: 'get', description: `Retrieve a ${projection} by ID`, parameters: [{ name: 'id', type: 'string', required: true }] },
        { name: 'list', description: `List all ${projection} items`, parameters: [{ name: 'limit', type: 'number', required: false }] },
        { name: 'update', description: `Update an existing ${projection}`, parameters: [{ name: 'id', type: 'string', required: true }, { name: 'data', type: 'object', required: true }] },
        { name: 'delete', description: `Delete a ${projection}`, parameters: [{ name: 'id', type: 'string', required: true }] },
      ] as readonly { readonly name: string; readonly description: string; readonly parameters: readonly { readonly name: string; readonly type: string; readonly required: boolean }[] }[],
    })),
  );

/** Convert a concept+action pair to a function name using snake_case. */
const toFunctionName = (concept: string, action: string): string => {
  const snake = concept.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return `${snake}_${action.toLowerCase()}`;
};

/** Map a TypeScript-like type to a JSON Schema type string. */
const toJsonSchemaType = (tsType: string): string => {
  const mapping: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
  };
  return mapping[tsType.toLowerCase()] ?? 'string';
};

// --- Implementation ---

export const openaiTargetHandler: OpenaiTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions } = parseProjection(input.projection);

          // Check total function count against the limit
          const existingFunctions = await storage.find('functions');
          const totalCount = existingFunctions.length + actions.length;

          if (totalCount > FUNCTION_LIMIT) {
            return generateTooManyFunctions(totalCount, FUNCTION_LIMIT);
          }

          const functions: string[] = [];
          const files: string[] = [];

          for (const action of actions) {
            const fnName = toFunctionName(concept, action.name);
            functions.push(fnName);

            // Build JSON Schema for parameters
            const properties: Record<string, unknown> = {};
            const required: string[] = [];
            for (const param of action.parameters) {
              properties[param.name] = { type: toJsonSchemaType(param.type) };
              if (param.required) required.push(param.name);
            }

            await storage.put('functions', fnName, {
              concept,
              functionName: fnName,
              action: action.name,
              description: action.description ?? '',
              parameters: {
                type: 'object',
                properties,
                required,
              },
            });
          }

          const fileName = `${concept.toLowerCase()}-openai-functions.ts`;
          files.push(fileName);
          await storage.put('files', fileName, { concept, functions: [...functions] });

          return generateOk(functions, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('functions', input.function);

          return pipe(
            O.fromNullable(record),
            O.fold(
              () => validateOk(input.function),
              (fn) => {
                const description = fn['description'] as string | undefined;
                const functionName = fn['functionName'] as string | undefined;
                if (description === undefined || description.trim() === '') {
                  return validateMissingDescription(
                    input.function,
                    functionName ?? input.function,
                  );
                }
                return validateOk(input.function);
              },
            ),
          );
        },
        storageError,
      ),
    ),

  listFunctions: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const conceptFunctions = await storage.find('functions', { concept: input.concept });
          const functions = conceptFunctions.map((r) => r['functionName'] as string).filter(Boolean);
          return listFunctionsOk(functions);
        },
        storageError,
      ),
    ),
};
