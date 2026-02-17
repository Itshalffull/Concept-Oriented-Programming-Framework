// ============================================================
// RealWorld Concept Tests
//
// Validates individual RealWorld/Conduit concept handlers via
// direct invocation: Profile, Article, Comment, Tag, Favorite,
// Follow.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';

// App concept handlers
import { profileHandler } from '../implementations/typescript/app/profile.impl.js';
import { articleHandler } from '../implementations/typescript/app/article.impl.js';
import { commentHandler } from '../implementations/typescript/app/comment.impl.js';
import { tagHandler } from '../implementations/typescript/app/tag.impl.js';
import { favoriteHandler } from '../implementations/typescript/app/favorite.impl.js';
import { followHandler } from '../implementations/typescript/app/follow.impl.js';

// ============================================================
// 1. Profile Concept
// ============================================================

describe('Stage 7 — Profile Concept', () => {
  it('updates and retrieves a profile', async () => {
    const storage = createInMemoryStorage();

    const updateResult = await profileHandler.update(
      { user: 'u1', bio: 'Hello world', image: 'http://img.png' },
      storage,
    );
    expect(updateResult.variant).toBe('ok');
    expect(updateResult.user).toBe('u1');
    expect(updateResult.bio).toBe('Hello world');

    const getResult = await profileHandler.get({ user: 'u1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.bio).toBe('Hello world');
    expect(getResult.image).toBe('http://img.png');
  });

  it('returns notfound for missing profile', async () => {
    const storage = createInMemoryStorage();
    const result = await profileHandler.get({ user: 'nonexistent' }, storage);
    expect(result.variant).toBe('notfound');
  });
});

// ============================================================
// 2. Article Concept
// ============================================================

describe('Stage 7 — Article Concept', () => {
  it('creates and retrieves an article', async () => {
    const storage = createInMemoryStorage();

    const createResult = await articleHandler.create(
      { article: 'a1', title: 'Test Article', description: 'A test', body: 'Body text', author: 'u1' },
      storage,
    );
    expect(createResult.variant).toBe('ok');
    expect(createResult.article).toBe('a1');

    const getResult = await articleHandler.get({ article: 'a1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.title).toBe('Test Article');
    expect(getResult.slug).toBe('test-article');
    expect(getResult.author).toBe('u1');
  });

  it('updates an article', async () => {
    const storage = createInMemoryStorage();

    await articleHandler.create(
      { article: 'a1', title: 'Old Title', description: 'Desc', body: 'Body', author: 'u1' },
      storage,
    );

    const updateResult = await articleHandler.update(
      { article: 'a1', title: 'New Title', description: 'New Desc', body: 'New Body' },
      storage,
    );
    expect(updateResult.variant).toBe('ok');

    const getResult = await articleHandler.get({ article: 'a1' }, storage);
    expect(getResult.variant).toBe('ok');
    expect(getResult.title).toBe('New Title');
    expect(getResult.slug).toBe('new-title');
  });

  it('deletes an article', async () => {
    const storage = createInMemoryStorage();

    await articleHandler.create(
      { article: 'a1', title: 'To Delete', description: 'Desc', body: 'Body', author: 'u1' },
      storage,
    );

    const deleteResult = await articleHandler.delete({ article: 'a1' }, storage);
    expect(deleteResult.variant).toBe('ok');

    const getResult = await articleHandler.get({ article: 'a1' }, storage);
    expect(getResult.variant).toBe('notfound');
  });

  it('returns notfound when deleting non-existent article', async () => {
    const storage = createInMemoryStorage();
    const result = await articleHandler.delete({ article: 'nonexistent' }, storage);
    expect(result.variant).toBe('notfound');
  });
});

// ============================================================
// 3. Comment Concept
// ============================================================

describe('Stage 7 — Comment Concept', () => {
  it('creates and deletes a comment', async () => {
    const storage = createInMemoryStorage();

    const createResult = await commentHandler.create(
      { comment: 'c1', body: 'Great post', target: 'a1', author: 'u1' },
      storage,
    );
    expect(createResult.variant).toBe('ok');
    expect(createResult.comment).toBe('c1');

    const deleteResult = await commentHandler.delete({ comment: 'c1' }, storage);
    expect(deleteResult.variant).toBe('ok');
  });

  it('lists comments by target article', async () => {
    const storage = createInMemoryStorage();

    await commentHandler.create(
      { comment: 'c1', body: 'First', target: 'a1', author: 'u1' },
      storage,
    );
    await commentHandler.create(
      { comment: 'c2', body: 'Second', target: 'a1', author: 'u2' },
      storage,
    );
    await commentHandler.create(
      { comment: 'c3', body: 'Other', target: 'a2', author: 'u1' },
      storage,
    );

    const listResult = await commentHandler.list({ target: 'a1' }, storage);
    expect(listResult.variant).toBe('ok');
    const comments = JSON.parse(listResult.comments as string);
    expect(comments).toHaveLength(2);
  });
});

// ============================================================
// 4. Tag Concept
// ============================================================

describe('Stage 7 — Tag Concept', () => {
  it('adds tags to articles', async () => {
    const storage = createInMemoryStorage();

    await tagHandler.add({ tag: 'javascript', article: 'a1' }, storage);
    await tagHandler.add({ tag: 'javascript', article: 'a2' }, storage);
    await tagHandler.add({ tag: 'rust', article: 'a1' }, storage);

    const listResult = await tagHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const tags = JSON.parse(listResult.tags as string);
    expect(tags).toHaveLength(2);
    expect(tags).toContain('javascript');
    expect(tags).toContain('rust');
  });

  it('removes a tag from an article', async () => {
    const storage = createInMemoryStorage();

    await tagHandler.add({ tag: 'javascript', article: 'a1' }, storage);
    await tagHandler.add({ tag: 'javascript', article: 'a2' }, storage);
    await tagHandler.remove({ tag: 'javascript', article: 'a1' }, storage);

    const record = await storage.get('tag', 'javascript');
    expect(record).not.toBeNull();
    expect(record!.articles).toEqual(['a2']);
  });
});

// ============================================================
// 5. Favorite Concept
// ============================================================

describe('Stage 7 — Favorite Concept', () => {
  it('favorites and unfavorites articles', async () => {
    const storage = createInMemoryStorage();

    await favoriteHandler.favorite({ user: 'u1', article: 'a1' }, storage);
    await favoriteHandler.favorite({ user: 'u1', article: 'a2' }, storage);

    const check1 = await favoriteHandler.isFavorited({ user: 'u1', article: 'a1' }, storage);
    expect(check1.variant).toBe('ok');
    expect(check1.favorited).toBe(true);

    await favoriteHandler.unfavorite({ user: 'u1', article: 'a1' }, storage);

    const check2 = await favoriteHandler.isFavorited({ user: 'u1', article: 'a1' }, storage);
    expect(check2.variant).toBe('ok');
    expect(check2.favorited).toBe(false);
  });

  it('counts favorites for an article', async () => {
    const storage = createInMemoryStorage();

    await favoriteHandler.favorite({ user: 'u1', article: 'a1' }, storage);
    await favoriteHandler.favorite({ user: 'u2', article: 'a1' }, storage);
    await favoriteHandler.favorite({ user: 'u3', article: 'a2' }, storage);

    const count = await favoriteHandler.count({ article: 'a1' }, storage);
    expect(count.variant).toBe('ok');
    expect(count.count).toBe(2);
  });
});

// ============================================================
// 6. Follow Concept
// ============================================================

describe('Stage 7 — Follow Concept', () => {
  it('follows and unfollows users', async () => {
    const storage = createInMemoryStorage();

    await followHandler.follow({ user: 'u1', target: 'u2' }, storage);

    const check1 = await followHandler.isFollowing({ user: 'u1', target: 'u2' }, storage);
    expect(check1.variant).toBe('ok');
    expect(check1.following).toBe(true);

    await followHandler.unfollow({ user: 'u1', target: 'u2' }, storage);

    const check2 = await followHandler.isFollowing({ user: 'u1', target: 'u2' }, storage);
    expect(check2.variant).toBe('ok');
    expect(check2.following).toBe(false);
  });

  it('does not duplicate follows', async () => {
    const storage = createInMemoryStorage();

    await followHandler.follow({ user: 'u1', target: 'u2' }, storage);
    await followHandler.follow({ user: 'u1', target: 'u2' }, storage);

    const record = await storage.get('follow', 'u1');
    expect(record).not.toBeNull();
    expect(record!.following).toEqual(['u2']);
  });
});
