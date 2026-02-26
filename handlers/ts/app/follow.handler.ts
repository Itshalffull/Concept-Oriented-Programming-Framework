// Follow Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const followHandler: ConceptHandler = {
  async follow(input, storage) {
    const user = input.user as string;
    const target = input.target as string;

    const existing = await storage.get('follow', user);
    const following: string[] = existing
      ? (existing.following as string[])
      : [];

    if (!following.includes(target)) {
      following.push(target);
    }

    await storage.put('follow', user, { user, following });

    return { variant: 'ok', user, target };
  },

  async unfollow(input, storage) {
    const user = input.user as string;
    const target = input.target as string;

    const existing = await storage.get('follow', user);
    if (existing) {
      const following = (existing.following as string[]).filter(t => t !== target);
      await storage.put('follow', user, { user, following });
    }

    return { variant: 'ok', user, target };
  },

  async isFollowing(input, storage) {
    const user = input.user as string;
    const target = input.target as string;

    const existing = await storage.get('follow', user);
    const following: string[] = existing
      ? (existing.following as string[])
      : [];

    return { variant: 'ok', following: following.includes(target) };
  },
};
