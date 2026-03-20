// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DailyNote Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _dailyNoteHandler: FunctionalConceptHandler = {
  getOrCreateToday(input: Record<string, unknown>) {
    const note = input.note as string;
    const today = new Date().toISOString().slice(0, 10);

    let p = createProgram();
    p = spGet(p, 'dailyNote', note, 'existingNote');
    p = branch(p, 'existingNote',
      (b) => complete(b, 'ok', { note, created: false }),
      (b) => {
        let b2 = put(b, 'dailyNote', note, {
          note,
          date: today,
          dateFormat: 'YYYY-MM-DD',
          templateId: '',
          targetFolder: '',
        });
        return complete(b2, 'ok', { note, created: true });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  navigateToDate(input: Record<string, unknown>) {
    const date = input.date as string;

    let p = createProgram();
    p = find(p, 'dailyNote', { date }, 'results');
    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings.results as Array<Record<string, unknown>>) || [];
      return { note: results.length > 0 ? (results[0].note as string) : '' };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRecent(input: Record<string, unknown>) {
    const count = input.count as number;

    let p = createProgram();
    p = find(p, 'dailyNote', {}, 'allNotes');
    return completeFrom(p, 'ok', (bindings) => {
      const allNotes = (bindings.allNotes as Array<Record<string, unknown>>) || [];
      return { notes: JSON.stringify(allNotes.slice(0, count)) };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const dailyNoteHandler = autoInterpret(_dailyNoteHandler);

