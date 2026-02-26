// Favorite Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const favoriteHandler: ConceptHandler = {
  async favorite(input, storage) {
    const user = input.user as string;
    const article = input.article as string;

    const existing = await storage.get('favorite', user);
    const favorites: string[] = existing
      ? (existing.favorites as string[])
      : [];

    if (!favorites.includes(article)) {
      favorites.push(article);
    }

    await storage.put('favorite', user, { user, favorites });

    return { variant: 'ok', user, article };
  },

  async unfavorite(input, storage) {
    const user = input.user as string;
    const article = input.article as string;

    const existing = await storage.get('favorite', user);
    if (existing) {
      const favorites = (existing.favorites as string[]).filter(a => a !== article);
      await storage.put('favorite', user, { user, favorites });
    }

    return { variant: 'ok', user, article };
  },

  async isFavorited(input, storage) {
    const user = input.user as string;
    const article = input.article as string;

    const existing = await storage.get('favorite', user);
    const favorites: string[] = existing
      ? (existing.favorites as string[])
      : [];

    return { variant: 'ok', favorited: favorites.includes(article) };
  },

  async count(input, storage) {
    const article = input.article as string;

    const allUsers = await storage.find('favorite');
    let count = 0;
    for (const record of allUsers) {
      const favorites = record.favorites as string[];
      if (favorites.includes(article)) {
        count++;
      }
    }

    return { variant: 'ok', count };
  },
};
