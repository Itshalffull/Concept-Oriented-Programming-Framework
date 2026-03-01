// SyntaxTree — Incremental syntax tree parsing, querying, and node inspection
// Parses files into trees, supports incremental reparse, pattern queries, and node lookup.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyntaxTreeStorage,
  SyntaxTreeParseInput,
  SyntaxTreeParseOutput,
  SyntaxTreeReparseInput,
  SyntaxTreeReparseOutput,
  SyntaxTreeQueryInput,
  SyntaxTreeQueryOutput,
  SyntaxTreeNodeAtInput,
  SyntaxTreeNodeAtOutput,
  SyntaxTreeGetInput,
  SyntaxTreeGetOutput,
} from './types.js';

import {
  parseOk,
  parseParseError,
  parseNoGrammar,
  reparseOk,
  reparseNotfound,
  queryOk,
  queryInvalidPattern,
  queryNotfound,
  nodeAtOk,
  nodeAtOutOfRange,
  nodeAtNotfound,
  getOk,
  getNotfound,
} from './types.js';

export interface SyntaxTreeError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SyntaxTreeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface SyntaxTreeHandler {
  readonly parse: (
    input: SyntaxTreeParseInput,
    storage: SyntaxTreeStorage,
  ) => TE.TaskEither<SyntaxTreeError, SyntaxTreeParseOutput>;
  readonly reparse: (
    input: SyntaxTreeReparseInput,
    storage: SyntaxTreeStorage,
  ) => TE.TaskEither<SyntaxTreeError, SyntaxTreeReparseOutput>;
  readonly query: (
    input: SyntaxTreeQueryInput,
    storage: SyntaxTreeStorage,
  ) => TE.TaskEither<SyntaxTreeError, SyntaxTreeQueryOutput>;
  readonly nodeAt: (
    input: SyntaxTreeNodeAtInput,
    storage: SyntaxTreeStorage,
  ) => TE.TaskEither<SyntaxTreeError, SyntaxTreeNodeAtOutput>;
  readonly get: (
    input: SyntaxTreeGetInput,
    storage: SyntaxTreeStorage,
  ) => TE.TaskEither<SyntaxTreeError, SyntaxTreeGetOutput>;
}

// --- Implementation ---

export const syntaxTreeHandler: SyntaxTreeHandler = {
  parse: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Verify the grammar exists
          const grammar = await storage.get('grammar', input.grammar);
          if (!grammar) {
            return parseNoGrammar(`Grammar '${input.grammar}' is not registered`);
          }

          // Read source file content
          const fileRecord = await storage.get('file', input.file);
          const source = fileRecord ? String(fileRecord['content'] ?? '') : '';
          const byteLength = new TextEncoder().encode(source).length;

          // Simulate parsing and check for errors (unbalanced constructs)
          let errorCount = 0;
          let depth = 0;
          for (let i = 0; i < source.length; i++) {
            if (source[i] === '{' || source[i] === '(' || source[i] === '[') depth++;
            if (source[i] === '}' || source[i] === ')' || source[i] === ']') depth--;
            if (depth < 0) { errorCount++; depth = 0; }
          }
          if (depth !== 0) errorCount += Math.abs(depth);

          const treeId = `tree_${input.file.replace(/[^a-zA-Z0-9]/g, '_')}`;

          await storage.put('tree', treeId, {
            id: treeId,
            file: input.file,
            source: input.file,
            grammar: input.grammar,
            language: input.grammar,
            byteLength,
            editVersion: 0,
            errorCount,
            errorRanges: errorCount > 0 ? JSON.stringify([{ byte: 0, message: 'parse error' }]) : '[]',
            createdAt: new Date().toISOString(),
          });

          if (errorCount > 0) {
            return parseParseError(treeId, errorCount);
          }
          return parseOk(treeId);
        },
        storageError,
      ),
    ),

  reparse: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tree', input.tree),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(reparseNotfound(`Tree '${input.tree}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const oldByteLength = Number(found['byteLength'] ?? 0);
                  const byteDelta = input.newEndByte - input.oldEndByte;
                  const newByteLength = oldByteLength + byteDelta;
                  const newVersion = Number(found['editVersion'] ?? 0) + 1;

                  await storage.put('tree', input.tree, {
                    ...found,
                    byteLength: newByteLength,
                    editVersion: newVersion,
                    errorCount: 0,
                    errorRanges: '[]',
                    updatedAt: new Date().toISOString(),
                  });

                  return reparseOk(input.tree);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tree', input.tree),
        storageError,
      ),
      TE.chain((treeRecord) =>
        pipe(
          O.fromNullable(treeRecord),
          O.fold(
            () => TE.right(queryNotfound(`Tree '${input.tree}' not found`)),
            () => {
              // Validate pattern syntax (must have balanced parens for S-expression patterns)
              let depth = 0;
              for (const ch of input.pattern) {
                if (ch === '(') depth++;
                if (ch === ')') depth--;
                if (depth < 0) {
                  return TE.right(queryInvalidPattern(`Unexpected closing paren in pattern`));
                }
              }
              if (depth !== 0) {
                return TE.right(queryInvalidPattern(`Unbalanced parentheses in pattern`));
              }

              return TE.tryCatch(
                async () => {
                  const nodes = await storage.find('tree_node', { tree: input.tree });
                  const matches = nodes.filter((n) =>
                    String(n['type'] ?? '').includes(input.pattern) ||
                    input.pattern.includes(String(n['type'] ?? '')),
                  );
                  return queryOk(JSON.stringify(matches.map((m) => ({
                    nodeType: String(m['type']),
                    startByte: Number(m['startByte'] ?? 0),
                    endByte: Number(m['endByte'] ?? 0),
                  }))));
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  nodeAt: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tree', input.tree),
        storageError,
      ),
      TE.chain((treeRecord) =>
        pipe(
          O.fromNullable(treeRecord),
          O.fold(
            () => TE.right(nodeAtNotfound(`Tree '${input.tree}' not found`)),
            (found) => {
              const byteLength = Number(found['byteLength'] ?? 0);
              if (input.byteOffset < 0 || input.byteOffset >= byteLength) {
                return TE.right(nodeAtOutOfRange());
              }
              return TE.tryCatch(
                async () => {
                  const nodes = await storage.find('tree_node', { tree: input.tree });
                  const hit = nodes.find(
                    (n) =>
                      Number(n['startByte'] ?? 0) <= input.byteOffset &&
                      Number(n['endByte'] ?? 0) > input.byteOffset,
                  );
                  return pipe(
                    O.fromNullable(hit),
                    O.fold(
                      () => nodeAtOk('source_file', 0, byteLength, 'true', ''),
                      (node) =>
                        nodeAtOk(
                          String(node['type'] ?? 'unknown'),
                          Number(node['startByte'] ?? 0),
                          Number(node['endByte'] ?? 0),
                          String(node['named'] ?? 'true'),
                          String(node['field'] ?? ''),
                        ),
                    ),
                  );
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('tree', input.tree),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound(`Tree '${input.tree}' not found`)),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['source']),
                  String(found['grammar']),
                  Number(found['byteLength'] ?? 0),
                  Number(found['editVersion'] ?? 0),
                  String(found['errorRanges'] ?? '[]'),
                ),
              ),
          ),
        ),
      ),
    ),
};
