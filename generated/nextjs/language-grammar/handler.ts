// LanguageGrammar — Grammar registration and file extension / MIME type resolution
// Registers tree-sitter grammars, resolves by extension or MIME, lists all registered grammars.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LanguageGrammarStorage,
  LanguageGrammarRegisterInput,
  LanguageGrammarRegisterOutput,
  LanguageGrammarResolveInput,
  LanguageGrammarResolveOutput,
  LanguageGrammarResolveByMimeInput,
  LanguageGrammarResolveByMimeOutput,
  LanguageGrammarGetInput,
  LanguageGrammarGetOutput,
  LanguageGrammarListInput,
  LanguageGrammarListOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  resolveOk,
  resolveNoGrammar,
  resolveByMimeOk,
  resolveByMimeNoGrammar,
  getOk,
  getNotfound,
  listOk,
} from './types.js';

export interface LanguageGrammarError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): LanguageGrammarError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Common MIME type to language name mappings. */
const MIME_TO_LANGUAGE: Record<string, string> = {
  'text/javascript': 'javascript',
  'application/javascript': 'javascript',
  'text/typescript': 'typescript',
  'application/typescript': 'typescript',
  'text/x-python': 'python',
  'text/x-rustsrc': 'rust',
  'text/x-go': 'go',
  'text/x-java': 'java',
  'text/html': 'html',
  'text/css': 'css',
  'application/json': 'json',
  'text/x-yaml': 'yaml',
  'text/markdown': 'markdown',
};

export interface LanguageGrammarHandler {
  readonly register: (
    input: LanguageGrammarRegisterInput,
    storage: LanguageGrammarStorage,
  ) => TE.TaskEither<LanguageGrammarError, LanguageGrammarRegisterOutput>;
  readonly resolve: (
    input: LanguageGrammarResolveInput,
    storage: LanguageGrammarStorage,
  ) => TE.TaskEither<LanguageGrammarError, LanguageGrammarResolveOutput>;
  readonly resolveByMime: (
    input: LanguageGrammarResolveByMimeInput,
    storage: LanguageGrammarStorage,
  ) => TE.TaskEither<LanguageGrammarError, LanguageGrammarResolveByMimeOutput>;
  readonly get: (
    input: LanguageGrammarGetInput,
    storage: LanguageGrammarStorage,
  ) => TE.TaskEither<LanguageGrammarError, LanguageGrammarGetOutput>;
  readonly list: (
    input: LanguageGrammarListInput,
    storage: LanguageGrammarStorage,
  ) => TE.TaskEither<LanguageGrammarError, LanguageGrammarListOutput>;
}

// --- Implementation ---

export const languageGrammarHandler: LanguageGrammarHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('grammar', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const extensions: readonly string[] = JSON.parse(input.extensions);
                  await storage.put('grammar', input.name, {
                    name: input.name,
                    extensions: input.extensions,
                    parserWasmPath: input.parserWasmPath,
                    nodeTypes: input.nodeTypes,
                    createdAt: new Date().toISOString(),
                  });
                  // Index each extension for fast reverse lookup
                  for (const ext of extensions) {
                    await storage.put('ext_to_grammar', ext, {
                      extension: ext,
                      grammar: input.name,
                    });
                  }
                  return registerOk(input.name);
                },
                storageError,
              ),
            (found) => TE.right(registerAlreadyRegistered(String(found['name']))),
          ),
        ),
      ),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ext_to_grammar', input.fileExtension),
        storageError,
      ),
      TE.chain((mapping) =>
        pipe(
          O.fromNullable(mapping),
          O.fold(
            () => TE.right(resolveNoGrammar(input.fileExtension)),
            (found) => TE.right(resolveOk(String(found['grammar']))),
          ),
        ),
      ),
    ),

  resolveByMime: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const languageName = MIME_TO_LANGUAGE[input.mimeType];
          if (!languageName) {
            return resolveByMimeNoGrammar(input.mimeType);
          }
          const grammar = await storage.get('grammar', languageName);
          return pipe(
            O.fromNullable(grammar),
            O.fold(
              () => resolveByMimeNoGrammar(input.mimeType),
              (found) => resolveByMimeOk(String(found['name'])),
            ),
          );
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('grammar', input.grammar),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound(`Grammar '${input.grammar}' not found`)),
            (found) =>
              TE.right(
                getOk(
                  String(found['name']),
                  String(found['name']),
                  String(found['extensions']),
                  String(found['parserWasmPath']),
                ),
              ),
          ),
        ),
      ),
    ),

  list: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('grammar');
          const grammars = records.map((r) => ({
            name: String(r['name']),
            extensions: String(r['extensions']),
          }));
          return listOk(JSON.stringify(grammars));
        },
        storageError,
      ),
    ),
};
