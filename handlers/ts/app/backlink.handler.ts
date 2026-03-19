// Backlink Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const backlinkHandler: ConceptHandler = {
  async getBacklinks(input, storage) {
    const entity = input.entity as string;

    const existing = await storage.get('backlink', entity);
    const sources: string[] = existing
      ? JSON.parse(existing.backlinks as string)
      : [];

    return { variant: 'ok', sources: JSON.stringify(sources) };
  },

  async getUnlinkedMentions(input, storage) {
    const entity = input.entity as string;

    const existing = await storage.get('backlink', entity);
    const mentions: string[] = existing
      ? JSON.parse(existing.mentions as string)
      : [];

    return { variant: 'ok', mentions: JSON.stringify(mentions) };
  },

  async reindex(_input, storage) {
    const allBacklinks = await storage.find('backlink');
    let count = 0;

    for (const record of allBacklinks) {
      const backlinks: string[] = JSON.parse(record.backlinks as string);
      count += backlinks.length;
    }

    return { variant: 'ok', count };
  },
};
