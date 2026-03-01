// ScoreIndex concept handler — code index management for Clef Score.
// Supports upsert/remove operations for concepts, syncs, symbols, and files with stats tracking.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  ScoreIndexStorage,
  ScoreIndexUpsertConceptInput,
  ScoreIndexUpsertConceptOutput,
  ScoreIndexUpsertSyncInput,
  ScoreIndexUpsertSyncOutput,
  ScoreIndexUpsertSymbolInput,
  ScoreIndexUpsertSymbolOutput,
  ScoreIndexUpsertFileInput,
  ScoreIndexUpsertFileOutput,
  ScoreIndexRemoveByFileInput,
  ScoreIndexRemoveByFileOutput,
  ScoreIndexClearInput,
  ScoreIndexClearOutput,
  ScoreIndexStatsInput,
  ScoreIndexStatsOutput,
} from './types.js';

import {
  upsertConceptOk,
  upsertConceptError,
  upsertSyncOk,
  upsertSyncError,
  upsertSymbolOk,
  upsertSymbolError,
  upsertFileOk,
  upsertFileError,
  removeByFileOk,
  clearOk,
  statsOk,
} from './types.js';

export interface ScoreIndexError {
  readonly code: string;
  readonly message: string;
}

export interface ScoreIndexHandler {
  readonly upsertConcept: (input: ScoreIndexUpsertConceptInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexUpsertConceptOutput>;
  readonly upsertSync: (input: ScoreIndexUpsertSyncInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexUpsertSyncOutput>;
  readonly upsertSymbol: (input: ScoreIndexUpsertSymbolInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexUpsertSymbolOutput>;
  readonly upsertFile: (input: ScoreIndexUpsertFileInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexUpsertFileOutput>;
  readonly removeByFile: (input: ScoreIndexRemoveByFileInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexRemoveByFileOutput>;
  readonly clear: (input: ScoreIndexClearInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexClearOutput>;
  readonly stats: (input: ScoreIndexStatsInput, storage: ScoreIndexStorage) => TE.TaskEither<ScoreIndexError, ScoreIndexStatsOutput>;
}

// --- Pure helpers ---

const toStorageError = (error: unknown): ScoreIndexError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const scoreIndexHandler: ScoreIndexHandler = {
  upsertConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.name.trim()) return upsertConceptError('Concept name must not be empty');
          const indexKey = `concept::${input.name}`;
          await storage.put('concept', indexKey, {
            name: input.name,
            purpose: input.purpose,
            actions: input.actions,
            stateFields: input.stateFields,
            file: input.file,
            updatedAt: new Date().toISOString(),
          });
          return upsertConceptOk(indexKey);
        },
        toStorageError,
      ),
    ),

  upsertSync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.name.trim()) return upsertSyncError('Sync name must not be empty');
          const indexKey = `sync::${input.name}`;
          await storage.put('sync', indexKey, {
            name: input.name,
            annotation: input.annotation,
            triggers: input.triggers,
            effects: input.effects,
            file: input.file,
            updatedAt: new Date().toISOString(),
          });
          return upsertSyncOk(indexKey);
        },
        toStorageError,
      ),
    ),

  upsertSymbol: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.name.trim()) return upsertSymbolError('Symbol name must not be empty');
          const indexKey = `symbol::${input.scope}::${input.name}`;
          await storage.put('symbol', indexKey, {
            name: input.name,
            kind: input.kind,
            file: input.file,
            line: input.line,
            scope: input.scope,
            updatedAt: new Date().toISOString(),
          });
          return upsertSymbolOk(indexKey);
        },
        toStorageError,
      ),
    ),

  upsertFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.path.trim()) return upsertFileError('File path must not be empty');
          const indexKey = `file::${input.path}`;
          await storage.put('file', indexKey, {
            path: input.path,
            language: input.language,
            role: input.role,
            definitions: input.definitions,
            updatedAt: new Date().toISOString(),
          });
          return upsertFileOk(indexKey);
        },
        toStorageError,
      ),
    ),

  removeByFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const symbols = await storage.find('symbol', { file: input.path });
          const fileKey = `file::${input.path}`;
          let removed = 0;

          for (const sym of symbols) {
            const symKey = typeof sym['_key'] === 'string' ? sym['_key'] : `symbol::${sym['scope']}::${sym['name']}`;
            const deleted = await storage.delete('symbol', symKey as string);
            if (deleted) removed++;
          }

          const deletedFile = await storage.delete('file', fileKey);
          if (deletedFile) removed++;

          return removeByFileOk(removed);
        },
        toStorageError,
      ),
    ),

  clear: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const concepts = await storage.find('concept');
          const syncs = await storage.find('sync');
          const symbols = await storage.find('symbol');
          const files = await storage.find('file');
          const all = [...concepts, ...syncs, ...symbols, ...files];
          let cleared = 0;

          for (const record of concepts) {
            const key = typeof record['_key'] === 'string' ? record['_key'] : `concept::${record['name']}`;
            if (await storage.delete('concept', key as string)) cleared++;
          }
          for (const record of syncs) {
            const key = typeof record['_key'] === 'string' ? record['_key'] : `sync::${record['name']}`;
            if (await storage.delete('sync', key as string)) cleared++;
          }
          for (const record of symbols) {
            const key = typeof record['_key'] === 'string' ? record['_key'] : `symbol::${record['scope']}::${record['name']}`;
            if (await storage.delete('symbol', key as string)) cleared++;
          }
          for (const record of files) {
            const key = typeof record['_key'] === 'string' ? record['_key'] : `file::${record['path']}`;
            if (await storage.delete('file', key as string)) cleared++;
          }

          return clearOk(cleared);
        },
        toStorageError,
      ),
    ),

  stats: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const concepts = await storage.find('concept');
          const syncs = await storage.find('sync');
          const symbols = await storage.find('symbol');
          const files = await storage.find('file');
          return statsOk(concepts.length, syncs.length, symbols.length, files.length, new Date());
        },
        toStorageError,
      ),
    ),
};
