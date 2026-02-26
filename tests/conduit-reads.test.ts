// Conduit Read Operations — Full Architecture Flow Tests
// Validates that all read/list operations flow through the complete COPF
// architecture: Web/request → syncs → concept actions → Web/respond.
// No reads bypass the kernel.

import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createKernel } from '../handlers/ts/framework/kernel-factory.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';

// App concept handlers
import { userHandler } from '../handlers/ts/app/user.handler.js';
import { passwordHandler } from '../handlers/ts/app/password.handler.js';
import { jwtHandler } from '../handlers/ts/app/jwt.handler.js';
import { profileHandler } from '../handlers/ts/app/profile.handler.js';
import { articleHandler } from '../handlers/ts/app/article.handler.js';
import { commentHandler } from '../handlers/ts/app/comment.handler.js';
import { tagHandler } from '../handlers/ts/app/tag.handler.js';
import { favoriteHandler } from '../handlers/ts/app/favorite.handler.js';
import { followHandler } from '../handlers/ts/app/follow.handler.js';
import { echoHandler } from '../handlers/ts/app/echo.handler.js';

const SYNCS_DIR = resolve(import.meta.dirname!, '..', 'syncs', 'app');

const SYNC_FILES = [
  'echo.sync',
  'registration.sync',
  'login.sync',
  'profile.sync',
  'articles.sync',
  'comments.sync',
  'social.sync',
  'reads.sync',
];

function createConduitKernel() {
  const kernel = createKernel();

  kernel.registerConcept('urn:copf/User', userHandler);
  kernel.registerConcept('urn:copf/Password', passwordHandler);
  kernel.registerConcept('urn:copf/JWT', jwtHandler);
  kernel.registerConcept('urn:copf/Profile', profileHandler);
  kernel.registerConcept('urn:copf/Article', articleHandler);
  kernel.registerConcept('urn:copf/Comment', commentHandler);
  kernel.registerConcept('urn:copf/Tag', tagHandler);
  kernel.registerConcept('urn:copf/Favorite', favoriteHandler);
  kernel.registerConcept('urn:copf/Follow', followHandler);
  kernel.registerConcept('urn:copf/Echo', echoHandler);

  for (const file of SYNC_FILES) {
    const source = readFileSync(resolve(SYNCS_DIR, file), 'utf-8');
    const syncs = parseSyncFile(source);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }
  }

  return kernel;
}

async function registerUser(kernel: ReturnType<typeof createKernel>, username: string, email: string) {
  const result = await kernel.handleRequest({
    method: 'register',
    username,
    email,
    password: 'password123',
  });
  const user = result.body?.user as Record<string, unknown>;
  return user.token as string;
}

describe('Conduit Read Operations — Full Architecture Flow', () => {

  describe('List Articles', () => {
    it('returns empty list when no articles exist', async () => {
      const kernel = createConduitKernel();
      const result = await kernel.handleRequest({ method: 'list_articles' });
      expect(result.error).toBeUndefined();
      expect(result.body?.articles).toBeDefined();
      const articles = JSON.parse(result.body!.articles as string);
      expect(articles).toEqual([]);
    });

    it('returns created articles', async () => {
      const kernel = createConduitKernel();
      const token = await registerUser(kernel, 'alice', 'alice@test.io');

      await kernel.handleRequest({
        method: 'create_article',
        title: 'First Article',
        description: 'Desc 1',
        body: 'Body 1',
        token,
      });

      await kernel.handleRequest({
        method: 'create_article',
        title: 'Second Article',
        description: 'Desc 2',
        body: 'Body 2',
        token,
      });

      const result = await kernel.handleRequest({ method: 'list_articles' });
      expect(result.error).toBeUndefined();
      const articles = JSON.parse(result.body!.articles as string);
      expect(articles.length).toBe(2);
      expect(articles.map((a: { title: string }) => a.title)).toContain('First Article');
      expect(articles.map((a: { title: string }) => a.title)).toContain('Second Article');
    });
  });

  describe('List Tags', () => {
    it('returns empty list when no tags exist', async () => {
      const kernel = createConduitKernel();
      const result = await kernel.handleRequest({ method: 'list_tags' });
      expect(result.error).toBeUndefined();
      const tags = JSON.parse(result.body!.tags as string);
      expect(tags).toEqual([]);
    });

    it('returns created tags', async () => {
      const kernel = createConduitKernel();
      await kernel.invokeConcept('urn:copf/Tag', 'add', { tag: 'javascript', article: 'a1' });
      await kernel.invokeConcept('urn:copf/Tag', 'add', { tag: 'copf', article: 'a2' });

      const result = await kernel.handleRequest({ method: 'list_tags' });
      expect(result.error).toBeUndefined();
      const tags = JSON.parse(result.body!.tags as string);
      expect(tags).toContain('javascript');
      expect(tags).toContain('copf');
    });
  });

  describe('Get Profile', () => {
    it('resolves username to user ID via where-clause', async () => {
      const kernel = createConduitKernel();
      const token = await registerUser(kernel, 'bob', 'bob@test.io');

      await kernel.handleRequest({
        method: 'update_profile',
        bio: 'Developer',
        image: 'https://img.io/bob.png',
        token,
      });

      const result = await kernel.handleRequest({
        method: 'get_profile',
        username: 'bob',
      });
      expect(result.error).toBeUndefined();
      const profile = result.body?.profile as Record<string, unknown>;
      expect(profile).toBeDefined();
      expect(profile.bio).toBe('Developer');
      expect(profile.image).toBe('https://img.io/bob.png');
    });

    it('returns empty body for nonexistent user', async () => {
      const kernel = createConduitKernel();
      const result = await kernel.handleRequest({
        method: 'get_profile',
        username: 'nonexistent',
      });
      // Where clause finds no User, so Profile/get never fires,
      // Web/respond never fires → empty body
      expect(result.body).toEqual({});
    });
  });

  describe('List Comments', () => {
    it('returns comments for a specific article', async () => {
      const kernel = createConduitKernel();
      const token = await registerUser(kernel, 'carol', 'carol@test.io');

      // Create an article
      const artResult = await kernel.handleRequest({
        method: 'create_article',
        title: 'Commented Article',
        description: 'D',
        body: 'B',
        token,
      });

      // Get the article ID from the flow log
      const flowLog = kernel.getFlowLog(artResult.flowId);
      const artCompletion = flowLog.find(
        (r: { concept: string; action: string; type: string }) =>
          r.concept === 'urn:copf/Article' && r.action === 'create' && r.type === 'completion',
      );
      const articleId = (artCompletion as { output: { article: string } }).output.article;

      // Add comments
      await kernel.handleRequest({
        method: 'create_comment',
        body: 'Great article!',
        article: articleId,
        token,
      });
      await kernel.handleRequest({
        method: 'create_comment',
        body: 'Thanks for sharing',
        article: articleId,
        token,
      });

      const result = await kernel.handleRequest({
        method: 'list_comments',
        article: articleId,
      });
      expect(result.error).toBeUndefined();
      const comments = JSON.parse(result.body!.comments as string);
      expect(comments.length).toBe(2);
    });
  });

  describe('Get Article by Slug', () => {
    it('returns article data with matching slug', async () => {
      const kernel = createConduitKernel();
      const token = await registerUser(kernel, 'dave', 'dave@test.io');

      await kernel.handleRequest({
        method: 'create_article',
        title: 'My Specific Article',
        description: 'Find me by slug',
        body: 'Content here',
        token,
      });

      const result = await kernel.handleRequest({
        method: 'get_article',
        slug: 'my-specific-article',
      });
      expect(result.error).toBeUndefined();
      // Response contains articles list + slug for client-side filtering
      const articles = JSON.parse(result.body!.articles as string);
      expect(articles.length).toBeGreaterThan(0);
      expect(result.body!.slug).toBe('my-specific-article');
      const match = articles.find((a: { slug: string }) => a.slug === 'my-specific-article');
      expect(match).toBeDefined();
      expect(match.title).toBe('My Specific Article');
    });
  });

  describe('Flow Trace Verification', () => {
    it('reads flow through Web/request → concept action → Web/respond', async () => {
      const kernel = createConduitKernel();
      await kernel.invokeConcept('urn:copf/Tag', 'add', { tag: 'traced', article: 'a1' });

      const result = await kernel.handleRequest({ method: 'list_tags' });
      const flowLog = kernel.getFlowLog(result.flowId);

      // Verify full architecture path was taken
      const webRequest = flowLog.find(
        (r: { concept: string; action: string }) =>
          r.concept === 'urn:copf/Web' && r.action === 'request',
      );
      const tagList = flowLog.find(
        (r: { concept: string; action: string }) =>
          r.concept === 'urn:copf/Tag' && r.action === 'list',
      );
      const webRespond = flowLog.find(
        (r: { concept: string; action: string }) =>
          r.concept === 'urn:copf/Web' && r.action === 'respond',
      );

      expect(webRequest).toBeDefined();
      expect(tagList).toBeDefined();
      expect(webRespond).toBeDefined();
    });

    it('article list flows through syncs, not direct storage', async () => {
      const kernel = createConduitKernel();
      const result = await kernel.handleRequest({ method: 'list_articles' });
      const flowLog = kernel.getFlowLog(result.flowId);

      const articleList = flowLog.find(
        (r: { concept: string; action: string }) =>
          r.concept === 'urn:copf/Article' && r.action === 'list',
      );
      expect(articleList).toBeDefined();
    });
  });
});
