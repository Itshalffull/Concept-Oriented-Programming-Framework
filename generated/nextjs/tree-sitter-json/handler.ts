// Tree-sitter grammar for JSON — typed AST node registry and structural validation.
// Registers JSON grammar node types for object, array, string, number, boolean, and null literals.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TreeSitterJsonStorage,
  TreeSitterJsonInitializeInput,
  TreeSitterJsonInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

export interface TreeSitterJsonError {
  readonly code: string;
  readonly message: string;
}

export interface TreeSitterJsonHandler {
  readonly initialize: (
    input: TreeSitterJsonInitializeInput,
    storage: TreeSitterJsonStorage,
  ) => TE.TaskEither<TreeSitterJsonError, TreeSitterJsonInitializeOutput>;
}

// --- Pure helpers ---

/** Node types recognized in JSON grammar */
const JSON_NODE_TYPES: readonly string[] = [
  'document',
  'object',
  'pair',
  'key',
  'array',
  'string',
  'number',
  'true',
  'false',
  'null',
  'comment',
  'escape_sequence',
] as const;

/** JSON grammar metadata */
const buildGrammarMetadata = (): Record<string, unknown> => ({
  language: 'json',
  version: '1.0.0',
  fileExtensions: ['.json', '.jsonc'],
  nodeTypes: JSON_NODE_TYPES,
  rootNode: 'document',
  supportsComments: true,
  strictMode: true,
});

/** Validate JSON grammar structure completeness */
const validateGrammarCompleteness = (
  nodeTypes: readonly string[],
): O.Option<string> => {
  const required = ['document', 'object', 'array', 'string', 'number', 'null'];
  const missing = required.filter((r) => !nodeTypes.includes(r));
  return missing.length > 0
    ? O.some(`Missing required JSON node types: ${missing.join(', ')}`)
    : O.none;
};

const toStorageError = (error: unknown): TreeSitterJsonError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const treeSitterJsonHandler: TreeSitterJsonHandler = {
  initialize: (_input, storage) =>
    pipe(
      validateGrammarCompleteness(JSON_NODE_TYPES),
      O.fold(
        () =>
          pipe(
            TE.tryCatch(
              async () => {
                const instanceId = `json-grammar-${Date.now()}`;
                const metadata = buildGrammarMetadata();

                await storage.put('grammars', instanceId, {
                  instanceId,
                  ...metadata,
                  nodeTypeCount: JSON_NODE_TYPES.length,
                  initializedAt: new Date().toISOString(),
                });

                // Register each node type with its category
                const valueTypes = new Set(['string', 'number', 'true', 'false', 'null', 'object', 'array']);
                for (const nodeType of JSON_NODE_TYPES) {
                  await storage.put('node_types', `${instanceId}:${nodeType}`, {
                    grammar: instanceId,
                    nodeType,
                    language: 'json',
                    isValueType: valueTypes.has(nodeType),
                  });
                }

                return initializeOk(instanceId);
              },
              toStorageError,
            ),
          ),
        (errorMsg) => TE.right(initializeLoadError(errorMsg)),
      ),
    ),
};
