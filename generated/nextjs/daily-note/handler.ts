// DailyNote concept handler — date-keyed notes with get-or-create, date navigation,
// and recent listing. Modeled after Obsidian daily notes.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DailyNoteStorage,
  DailyNoteGetOrCreateTodayInput,
  DailyNoteGetOrCreateTodayOutput,
  DailyNoteNavigateToDateInput,
  DailyNoteNavigateToDateOutput,
  DailyNoteListRecentInput,
  DailyNoteListRecentOutput,
} from './types.js';

import {
  getOrCreateTodayOk,
  navigateToDateOk,
  navigateToDateNotfound,
  listRecentOk,
} from './types.js';

export interface DailyNoteError {
  readonly code: string;
  readonly message: string;
}

export interface DailyNoteHandler {
  readonly getOrCreateToday: (
    input: DailyNoteGetOrCreateTodayInput,
    storage: DailyNoteStorage,
  ) => TE.TaskEither<DailyNoteError, DailyNoteGetOrCreateTodayOutput>;
  readonly navigateToDate: (
    input: DailyNoteNavigateToDateInput,
    storage: DailyNoteStorage,
  ) => TE.TaskEither<DailyNoteError, DailyNoteNavigateToDateOutput>;
  readonly listRecent: (
    input: DailyNoteListRecentInput,
    storage: DailyNoteStorage,
  ) => TE.TaskEither<DailyNoteError, DailyNoteListRecentOutput>;
}

// --- Pure helpers ---

const todayKey = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
};

const isValidDateKey = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));

const toStorageError = (error: unknown): DailyNoteError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const dailyNoteHandler: DailyNoteHandler = {
  getOrCreateToday: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const dateKey = todayKey();
          return storage.get('dailynote', dateKey);
        },
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            // Note does not exist for today -- create it
            () =>
              TE.tryCatch(
                async () => {
                  const dateKey = todayKey();
                  const now = new Date().toISOString();

                  await storage.put('dailynote', dateKey, {
                    note: input.note,
                    date: dateKey,
                    content: '',
                    createdAt: now,
                    updatedAt: now,
                  });

                  return getOrCreateTodayOk(input.note, true);
                },
                toStorageError,
              ),
            // Note already exists for today
            () => TE.right(getOrCreateTodayOk(input.note, false)),
          ),
        ),
      ),
    ),

  navigateToDate: (input, storage) => {
    if (!isValidDateKey(input.date)) {
      return TE.right(
        navigateToDateNotfound(`Invalid date format '${input.date}', expected YYYY-MM-DD`),
      );
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('dailynote', input.date),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                navigateToDateNotfound(`No daily note found for ${input.date}`),
              ),
            (found) => {
              const noteId = typeof found['note'] === 'string' ? found['note'] as string : input.date;
              return TE.right(navigateToDateOk(noteId));
            },
          ),
        ),
      ),
    );
  },

  listRecent: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allNotes = await storage.find('dailynote');

          // Sort by date descending and take the requested count
          const sorted = [...allNotes]
            .sort((a, b) => {
              const dateA = typeof a['date'] === 'string' ? a['date'] as string : '';
              const dateB = typeof b['date'] === 'string' ? b['date'] as string : '';
              return dateB.localeCompare(dateA);
            })
            .slice(0, Math.max(1, input.count));

          const summaries = sorted.map((n) => ({
            note: n['note'],
            date: n['date'],
            createdAt: n['createdAt'],
          }));

          return listRecentOk(JSON.stringify(summaries));
        },
        toStorageError,
      ),
    ),
};
