// Flag Concept Implementation
// Generalized user-entity toggle interactions (bookmarks, likes, follows, spam reports) with counts.
import type { ConceptHandler } from '@clef/runtime';

export const flagHandler: ConceptHandler = {
  async flag(input, storage) {
    const flagging = input.flagging as string;
    const flagType = input.flagType as string;
    const entity = input.entity as string;
    const user = input.user as string;

    const existing = await storage.get('flag', flagging);
    if (existing) {
      return { variant: 'exists', message: 'User has already flagged this entity with this type' };
    }

    // Check for duplicate flagging by same user on same entity with same type
    const allFlags = await storage.find('flag');
    for (const record of allFlags) {
      if (
        record.flagType === flagType &&
        record.entity === entity &&
        record.user === user
      ) {
        return { variant: 'exists', message: 'User has already flagged this entity with this type' };
      }
    }

    await storage.put('flag', flagging, { flagging, flagType, entity, user });

    // Update the count for this flagType + entity combination
    const countKey = `${flagType}:${entity}`;
    const countRecord = await storage.get('flagCount', countKey);
    const currentCount = countRecord ? (countRecord.count as number) : 0;
    await storage.put('flagCount', countKey, { flagType, entity, count: currentCount + 1 });

    return { variant: 'ok' };
  },

  async unflag(input, storage) {
    const flagging = input.flagging as string;

    const existing = await storage.get('flag', flagging);
    if (!existing) {
      return { variant: 'notfound', message: 'Flagging does not exist' };
    }

    const flagType = existing.flagType as string;
    const entity = existing.entity as string;

    await storage.del('flag', flagging);

    // Decrement the count
    const countKey = `${flagType}:${entity}`;
    const countRecord = await storage.get('flagCount', countKey);
    const currentCount = countRecord ? (countRecord.count as number) : 0;
    const newCount = Math.max(0, currentCount - 1);
    await storage.put('flagCount', countKey, { flagType, entity, count: newCount });

    return { variant: 'ok' };
  },

  async isFlagged(input, storage) {
    const flagType = input.flagType as string;
    const entity = input.entity as string;
    const user = input.user as string;

    const allFlags = await storage.find('flag');
    const flagged = allFlags.some(
      (record) =>
        record.flagType === flagType &&
        record.entity === entity &&
        record.user === user,
    );

    return { variant: 'ok', flagged };
  },

  async getCount(input, storage) {
    const flagType = input.flagType as string;
    const entity = input.entity as string;

    const countKey = `${flagType}:${entity}`;
    const countRecord = await storage.get('flagCount', countKey);
    const count = countRecord ? (countRecord.count as number) : 0;

    return { variant: 'ok', count };
  },
};
