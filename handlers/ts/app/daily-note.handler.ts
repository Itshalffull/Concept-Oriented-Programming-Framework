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
  getOrCreate(input: Record<string, unknown>) {
    const date = input.date as string;
    const nodeId = `daily-note:${date}`;

    let p = createProgram();
    p = spGet(p, 'dailyNote', nodeId, 'existingNote');
    p = branch(p, 'existingNote',
      (b) => complete(b, 'ok', { note: nodeId, created: false }),
      (b) => {
        let b2 = put(b, 'dailyNote', nodeId, {
          note: nodeId,
          date,
          dateFormat: 'YYYY-MM-DD',
          templateId: '',
          targetFolder: '',
        });
        return complete(b2, 'ok', { note: nodeId, created: true });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getOrCreateToday(input: Record<string, unknown>) {
    const note = input.note as string;
    // Extract date from note name if it matches "daily-YYYY-MM-DD" or "daily-note:YYYY-MM-DD" pattern
    const dateMatch = note.match(/(\d{4}-\d{2}-\d{2})/);
    const today = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    // Normalize key to use "daily-note:" prefix
    const nodeId = note.startsWith('daily-note:') ? note : `daily-note:${today}`;

    let p = createProgram();
    p = spGet(p, 'dailyNote', nodeId, 'existingNote');
    p = branch(p, 'existingNote',
      (b) => complete(b, 'ok', { note: nodeId, created: false }),
      (b) => {
        let b2 = put(b, 'dailyNote', nodeId, {
          note: nodeId,
          date: today,
          dateFormat: 'YYYY-MM-DD',
          templateId: '',
          targetFolder: '',
        });
        return complete(b2, 'ok', { note: nodeId, created: true });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  navigateToDate(input: Record<string, unknown>) {
    const date = input.date as string;

    let p = createProgram();
    p = find(p, 'dailyNote', { date }, 'results');
    p = branch(p, (bindings: Record<string, unknown>) => {
      const results = (bindings.results as Array<Record<string, unknown>>) || [];
      return results.length > 0;
    },
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const results = (bindings.results as Array<Record<string, unknown>>) || [];
        return { note: (results[0].note as string) };
      }),
      (elseP) => complete(elseP, 'notfound', { message: `no daily note for date: ${date}` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

