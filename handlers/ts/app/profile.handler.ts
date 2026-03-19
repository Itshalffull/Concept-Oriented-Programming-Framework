// Profile Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const profileHandler: ConceptHandler = {
  async update(input, storage) {
    const user = input.user as string;
    const bio = input.bio as string;
    const image = input.image as string;

    await storage.put('profile', user, { user, bio, image });

    return { variant: 'ok', user, bio, image };
  },

  async get(input, storage) {
    const user = input.user as string;

    const record = await storage.get('profile', user);
    if (!record) {
      return { variant: 'notfound', message: 'No profile found for user' };
    }

    return {
      variant: 'ok',
      user,
      bio: record.bio as string,
      image: record.image as string,
    };
  },
};
