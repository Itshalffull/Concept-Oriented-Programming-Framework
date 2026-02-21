// generated: dailynote.handler.ts
import type { ConceptStorage } from "@copf/runtime";
import type * as T from "./dailynote.types";

export interface DailyNoteHandler {
  getOrCreateToday(input: T.DailyNoteGetOrCreateTodayInput, storage: ConceptStorage):
    Promise<T.DailyNoteGetOrCreateTodayOutput>;
  navigateToDate(input: T.DailyNoteNavigateToDateInput, storage: ConceptStorage):
    Promise<T.DailyNoteNavigateToDateOutput>;
  listRecent(input: T.DailyNoteListRecentInput, storage: ConceptStorage):
    Promise<T.DailyNoteListRecentOutput>;
}
