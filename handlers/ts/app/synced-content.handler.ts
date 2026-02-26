// SyncedContent Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const syncedContentHandler: ConceptHandler = {
  async createReference(input, storage) {
    const ref = input.ref as string;
    const original = input.original as string;

    const originalRecord = await storage.get('syncedContent', original);
    if (!originalRecord) {
      return { variant: 'notfound', message: 'Original content does not exist' };
    }

    const references = JSON.parse((originalRecord.references as string) || '[]') as string[];
    references.push(ref);

    await storage.put('syncedContent', original, {
      ...originalRecord,
      references: JSON.stringify(references),
    });

    await storage.put('syncedContent', ref, {
      ref,
      originalId: original,
      content: originalRecord.content as string,
      references: '[]',
      isReference: true,
    });

    return { variant: 'ok' };
  },

  async editOriginal(input, storage) {
    const original = input.original as string;
    const content = input.content as string;

    const originalRecord = await storage.get('syncedContent', original);
    if (!originalRecord) {
      return { variant: 'notfound', message: 'Original content does not exist' };
    }

    await storage.put('syncedContent', original, {
      ...originalRecord,
      content,
    });

    const references = JSON.parse((originalRecord.references as string) || '[]') as string[];
    for (const refId of references) {
      const refRecord = await storage.get('syncedContent', refId);
      if (refRecord) {
        await storage.put('syncedContent', refId, {
          ...refRecord,
          content,
        });
      }
    }

    return { variant: 'ok' };
  },

  async deleteReference(input, storage) {
    const ref = input.ref as string;

    const refRecord = await storage.get('syncedContent', ref);
    if (!refRecord) {
      return { variant: 'notfound', message: 'Reference does not exist' };
    }

    const originalId = refRecord.originalId as string;
    if (originalId) {
      const originalRecord = await storage.get('syncedContent', originalId);
      if (originalRecord) {
        const references = JSON.parse((originalRecord.references as string) || '[]') as string[];
        const updated = references.filter(r => r !== ref);
        await storage.put('syncedContent', originalId, {
          ...originalRecord,
          references: JSON.stringify(updated),
        });
      }
    }

    await storage.del('syncedContent', ref);

    return { variant: 'ok' };
  },

  async convertToIndependent(input, storage) {
    const ref = input.ref as string;

    const refRecord = await storage.get('syncedContent', ref);
    if (!refRecord) {
      return { variant: 'notfound', message: 'Reference does not exist' };
    }

    const originalId = refRecord.originalId as string;
    if (originalId) {
      const originalRecord = await storage.get('syncedContent', originalId);
      if (originalRecord) {
        const references = JSON.parse((originalRecord.references as string) || '[]') as string[];
        const updated = references.filter(r => r !== ref);
        await storage.put('syncedContent', originalId, {
          ...originalRecord,
          references: JSON.stringify(updated),
        });
      }
    }

    await storage.put('syncedContent', ref, {
      ...refRecord,
      originalId: '',
      isReference: false,
    });

    return { variant: 'ok' };
  },
};
