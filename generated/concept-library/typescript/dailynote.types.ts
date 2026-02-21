// generated: dailynote.types.ts

export interface DailyNoteGetOrCreateTodayInput {
  note: string;
}

export type DailyNoteGetOrCreateTodayOutput =
  { variant: "ok"; note: string; created: boolean };

export interface DailyNoteNavigateToDateInput {
  date: string;
}

export type DailyNoteNavigateToDateOutput =
  { variant: "ok"; note: string }
  | { variant: "notfound"; message: string };

export interface DailyNoteListRecentInput {
  count: number;
}

export type DailyNoteListRecentOutput =
  { variant: "ok"; notes: string };

