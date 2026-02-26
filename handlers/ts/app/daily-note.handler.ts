// DailyNote Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const dailyNoteHandler: ConceptHandler = {
  async getOrCreateToday(input, storage) {
    const note = input.note as string;

    const today = new Date().toISOString().slice(0, 10);
    const existing = await storage.find('dailyNote', { date: today });

    if (existing.length > 0) {
      return { variant: 'ok', note: existing[0].note as string, created: false };
    }

    await storage.put('dailyNote', note, {
      note,
      date: today,
      dateFormat: 'YYYY-MM-DD',
      templateId: '',
      targetFolder: '',
    });

    return { variant: 'ok', note, created: true };
  },

  async navigateToDate(input, storage) {
    const date = input.date as string;

    const results = await storage.find('dailyNote', { date });
    if (results.length === 0) {
      return { variant: 'notfound', message: `No note exists for date "${date}"` };
    }

    return { variant: 'ok', note: results[0].note as string };
  },

  async listRecent(input, storage) {
    const count = input.count as number;

    const allNotes = await storage.find('dailyNote');
    const sorted = allNotes
      .sort((a, b) => (b.date as string).localeCompare(a.date as string))
      .slice(0, count);

    return { variant: 'ok', notes: JSON.stringify(sorted.map(n => ({
      note: n.note,
      date: n.date,
    }))) };
  },
};
