// SymbolOccurrence — Tracks definition, reference, and import occurrences of symbols
// Records source locations of symbol uses and provides positional/file-based queries.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SymbolOccurrenceStorage,
  SymbolOccurrenceRecordInput,
  SymbolOccurrenceRecordOutput,
  SymbolOccurrenceFindDefinitionsInput,
  SymbolOccurrenceFindDefinitionsOutput,
  SymbolOccurrenceFindReferencesInput,
  SymbolOccurrenceFindReferencesOutput,
  SymbolOccurrenceFindAtPositionInput,
  SymbolOccurrenceFindAtPositionOutput,
  SymbolOccurrenceFindInFileInput,
  SymbolOccurrenceFindInFileOutput,
} from './types.js';

import {
  recordOk,
  findDefinitionsOk,
  findDefinitionsNoDefinitions,
  findReferencesOk,
  findReferencesNoReferences,
  findAtPositionOk,
  findAtPositionNoSymbolAtPosition,
  findInFileOk,
} from './types.js';

export interface SymbolOccurrenceError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SymbolOccurrenceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Build a composite key for an occurrence based on its location. */
const occurrenceKey = (symbol: string, file: string, startByte: number): string =>
  `occ_${symbol}_${file.replace(/[^a-zA-Z0-9]/g, '_')}_${startByte}`;

export interface SymbolOccurrenceHandler {
  readonly record: (
    input: SymbolOccurrenceRecordInput,
    storage: SymbolOccurrenceStorage,
  ) => TE.TaskEither<SymbolOccurrenceError, SymbolOccurrenceRecordOutput>;
  readonly findDefinitions: (
    input: SymbolOccurrenceFindDefinitionsInput,
    storage: SymbolOccurrenceStorage,
  ) => TE.TaskEither<SymbolOccurrenceError, SymbolOccurrenceFindDefinitionsOutput>;
  readonly findReferences: (
    input: SymbolOccurrenceFindReferencesInput,
    storage: SymbolOccurrenceStorage,
  ) => TE.TaskEither<SymbolOccurrenceError, SymbolOccurrenceFindReferencesOutput>;
  readonly findAtPosition: (
    input: SymbolOccurrenceFindAtPositionInput,
    storage: SymbolOccurrenceStorage,
  ) => TE.TaskEither<SymbolOccurrenceError, SymbolOccurrenceFindAtPositionOutput>;
  readonly findInFile: (
    input: SymbolOccurrenceFindInFileInput,
    storage: SymbolOccurrenceStorage,
  ) => TE.TaskEither<SymbolOccurrenceError, SymbolOccurrenceFindInFileOutput>;
}

// --- Implementation ---

export const symbolOccurrenceHandler: SymbolOccurrenceHandler = {
  record: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = occurrenceKey(input.symbol, input.file, input.startByte);
          await storage.put('occurrence', key, {
            id: key,
            symbol: input.symbol,
            file: input.file,
            startRow: input.startRow,
            startCol: input.startCol,
            endRow: input.endRow,
            endCol: input.endCol,
            startByte: input.startByte,
            endByte: input.endByte,
            role: input.role,
            recordedAt: new Date().toISOString(),
          });
          return recordOk(key);
        },
        storageError,
      ),
    ),

  findDefinitions: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('occurrence', { symbol: input.symbol, role: 'definition' }),
        storageError,
      ),
      TE.map((records) =>
        records.length === 0
          ? findDefinitionsNoDefinitions()
          : findDefinitionsOk(JSON.stringify(records.map((r) => ({
              id: String(r['id']),
              file: String(r['file']),
              startRow: Number(r['startRow']),
              startCol: Number(r['startCol']),
              endRow: Number(r['endRow']),
              endCol: Number(r['endCol']),
            })))),
      ),
    ),

  findReferences: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('occurrence', { symbol: input.symbol }),
        storageError,
      ),
      TE.map((records) => {
        const filtered = input.roleFilter
          ? records.filter((r) => String(r['role']) === input.roleFilter)
          : records;
        return filtered.length === 0
          ? findReferencesNoReferences()
          : findReferencesOk(JSON.stringify(filtered.map((r) => ({
              id: String(r['id']),
              file: String(r['file']),
              role: String(r['role']),
              startRow: Number(r['startRow']),
              startCol: Number(r['startCol']),
            }))));
      }),
    ),

  findAtPosition: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('occurrence', { file: input.file }),
        storageError,
      ),
      TE.map((records) => {
        const hit = records.find(
          (r) =>
            Number(r['startRow']) <= input.row &&
            Number(r['endRow']) >= input.row &&
            (Number(r['startRow']) < input.row || Number(r['startCol']) <= input.col) &&
            (Number(r['endRow']) > input.row || Number(r['endCol']) >= input.col),
        );
        return pipe(
          O.fromNullable(hit),
          O.fold(
            () => findAtPositionNoSymbolAtPosition(),
            (found) => findAtPositionOk(String(found['id']), String(found['symbol'])),
          ),
        );
      }),
    ),

  findInFile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('occurrence', { file: input.file }),
        storageError,
      ),
      TE.map((records) =>
        findInFileOk(JSON.stringify(records.map((r) => ({
          id: String(r['id']),
          symbol: String(r['symbol']),
          role: String(r['role']),
          startRow: Number(r['startRow']),
          startCol: Number(r['startCol']),
        })))),
      ),
    ),
};
