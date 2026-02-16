// ============================================================
// Stage 7 — RealWorld Benchmark Tests (Phase 4)
//
// Validates the full Conduit/RealWorld application concepts:
// Profile, Article, Comment, Tag, Favorite, Follow.
//
// Tests cover:
//  1. Individual concept CRUD (direct invocation)
//  2. Self-compilation of new specs through the compiler pipeline
//  3. Parsing of new sync files
//  4. End-to-end kernel-driven flows:
//     - Login (email/password → JWT)
//     - Article creation (JWT auth → create)
//     - Article deletion with cascade comment deletion
//     - Comment creation (JWT auth → create)
//     - Follow / unfollow
//     - Favorite / unfavorite
//     - Profile update
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createInMemoryStorage,
  parseConceptFile,
  parseSyncFile,
} from '../kernel/src/index.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

// App concept handlers
import { userHandler } from '../implementations/typescript/app/user.impl.js';
import { passwordHandler } from '../implementations/typescript/app/password.impl.js';
import { jwtHandler } from '../implementations/typescript/app/jwt.impl.js';
import { profileHandler } from '../implementations/typescript/app/profile.impl.js';
import { articleHandler } from '../implementations/typescript/app/article.impl.js';
import { commentHandler } from '../implementations/typescript/app/comment.impl.js';
import { tagHandler } from '../implementations/typescript/app/tag.impl.js';
import { favoriteHandler } from '../implementations/typescript/app/favorite.impl.js';
import { followHandler } from '../implementations/typescript/app/follow.impl.js';

// Framework concept handlers (for self-compilation tests)
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// Helper: run SchemaGen on an AST and return the manifest
async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// All 6 new RealWorld concept names
const REALWORLD_SPECS = ['profile', 'article', 'comment', 'tag', 'favorite', 'follow'];

// All 5 new RealWorld sync files
const REALWORLD_SYNCS = ['login.sync', 'articles.sync', 'comments.sync', 'social.sync', 'profile.sync'];

// Helper: create a kernel with all RealWorld concepts and syncs registered
function createRealWorldKernel() {
  const kernel = createKernel();

  // Register all app concepts
  kernel.registerConcept('urn:copf/User', userHandler);
  kernel.registerConcept('urn:copf/Password', passwordHandler);
  kernel.registerConcept('urn:copf/JWT', jwtHandler);
  kernel.registerConcept('urn:copf/Profile', profileHandler);
  kernel.registerConcept('urn:copf/Article', articleHandler);
  kernel.registerConcept('urn:copf/Comment', commentHandler);
  kernel.registerConcept('urn:copf/Tag', tagHandler);
  kernel.registerConcept('urn:copf/Favorite', favoriteHandler);
  kernel.registerConcept('urn:copf/Follow', followHandler);

  // Load all sync files
  const allSyncFiles = [
    'registration.sync', 'login.sync', 'articles.sync',
    'comments.sync', 'social.sync', 'profile.sync',
  ];
  for (const file of allSyncFiles) {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');
    const syncs = parseSyncFile(source);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }
  }

  return kernel;
}

// Helper: register a user and get a JWT token through the kernel
async function registerUser(
  kernel: ReturnType<typeof createKernel>,
  username: string,
  email: string,
  password: string,
) {
  const response = await kernel.handleRequest({
    method: 'register',
    username,
    email,
    password,
  });
  return response;
}

// ============================================================
// 1. Individual Concept Tests (Direct Invocation)
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

// ============================================================
// 2. Self-Compilation: New Concept Specs through the Pipeline
// ============================================================

describe('Stage 7 — Self-Compilation of RealWorld Specs', () => {
  it('SpecParser parses all 6 new concept specs', async () => {
    const storage = createInMemoryStorage();

    for (const name of REALWORLD_SPECS) {
      const source = readSpec('app', name);
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
      expect(result.ast).toBeTruthy();
    }
  });

  it('SchemaGen generates manifests for all new specs', async () => {
    for (const name of REALWORLD_SPECS) {
      const ast = parseConceptFile(readSpec('app', name));
      const manifest = await generateManifest(ast);
      expect(manifest.name).toBeTruthy();
      expect(manifest.actions.length).toBeGreaterThan(0);
      expect(manifest.graphqlSchema).toBeTruthy();
    }
  });

  it('TypeScriptGen generates code for all new specs', async () => {
    for (const name of REALWORLD_SPECS) {
      const ast = parseConceptFile(readSpec('app', name));
      const manifest = await generateManifest(ast);
      const storage = createInMemoryStorage();
      const result = await typescriptGenHandler.generate(
        { spec: name, manifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = result.files as { path: string; content: string }[];
      // All new specs have invariants → types + handler + adapter + conformance
      expect(files.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('Article manifest has correct relation schema (state merge)', async () => {
    const ast = parseConceptFile(readSpec('app', 'article'));
    const manifest = await generateManifest(ast);

    // slug, title, description, body, author, createdAt, updatedAt all share
    // domain type A (scalar) → merged into one relation
    const mergedRelation = manifest.relations.find(r => r.source === 'merged');
    expect(mergedRelation).toBeDefined();
    const fieldNames = mergedRelation!.fields.map(f => f.name);
    expect(fieldNames).toContain('slug');
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('body');
    expect(fieldNames).toContain('author');

    // 'articles: set A' is a separate set-valued relation
    const setRelation = manifest.relations.find(r => r.source === 'set-valued');
    expect(setRelation).toBeDefined();
  });

  it('Follow manifest has merged relation with set-typed field', async () => {
    const ast = parseConceptFile(readSpec('app', 'follow'));
    const manifest = await generateManifest(ast);

    // following: U -> set String is a relation, merged into entries
    const mergedRelation = manifest.relations.find(r => r.source === 'merged');
    expect(mergedRelation).toBeDefined();
    const followingField = mergedRelation!.fields.find(f => f.name === 'following');
    expect(followingField).toBeDefined();
    expect(followingField!.type.kind).toBe('set');
  });

  it('generated conformance tests for Profile include invariant assertions', async () => {
    const ast = parseConceptFile(readSpec('app', 'profile'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'profile', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'profile.conformance.test.ts');
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('profileHandler.update(');
    expect(testFile!.content).toContain('profileHandler.get(');
    expect(testFile!.content).toContain('"Hello world"');
    expect(testFile!.content).toContain('"http://img.png"');
  });
});

// ============================================================
// 3. Sync File Parsing
// ============================================================

describe('Stage 7 — RealWorld Sync Parsing', () => {
  it('parses all 5 new sync files', () => {
    for (const file of REALWORLD_SYNCS) {
      const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThan(0);

      for (const sync of syncs) {
        expect(sync.name).toBeTruthy();
        expect(sync.when.length).toBeGreaterThan(0);
        expect(sync.then.length).toBeGreaterThan(0);
      }
    }
  });

  it('login.sync has correct sync structure', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'login.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('LoginCheckPassword');
    expect(names).toContain('LoginSuccess');
    expect(names).toContain('LoginResponse');
    expect(names).toContain('LoginFailure');

    // LoginCheckPassword has a where clause for User state query
    const loginCheck = syncs.find(s => s.name === 'LoginCheckPassword')!;
    expect(loginCheck.where.length).toBeGreaterThan(0);
    expect(loginCheck.where[0].type).toBe('query');
    expect(loginCheck.where[0].concept).toBe('urn:copf/User');
  });

  it('articles.sync includes CascadeDeleteComments', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'articles.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('CascadeDeleteComments');

    const cascade = syncs.find(s => s.name === 'CascadeDeleteComments')!;
    expect(cascade.where.length).toBeGreaterThan(0);
    expect(cascade.where[0].concept).toBe('urn:copf/Comment');
  });

  it('social.sync covers follow and favorite flows', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'social.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('PerformFollow');
    expect(names).toContain('PerformUnfollow');
    expect(names).toContain('PerformFavorite');
    expect(names).toContain('PerformUnfavorite');
  });

  it('SyncCompiler compiles all new sync files', async () => {
    for (const file of REALWORLD_SYNCS) {
      const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');
      const syncs = parseSyncFile(source);

      const storage = createInMemoryStorage();
      for (const sync of syncs) {
        const result = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    }
  });
});

// ============================================================
// 4. End-to-End Kernel-Driven Flows
// ============================================================

describe('Stage 7 — Login Flow (end-to-end)', () => {
  it('registers a user then logs in successfully', async () => {
    const kernel = createRealWorldKernel();

    // Step 1: Register a user
    const regResponse = await registerUser(kernel, 'alice', 'alice@test.com', 'password123');
    expect(regResponse.error).toBeUndefined();
    expect(regResponse.body?.user).toBeDefined();

    // Step 2: Login with correct credentials
    const loginResponse = await kernel.handleRequest({
      method: 'login',
      email: 'alice@test.com',
      password: 'password123',
    });

    expect(loginResponse.error).toBeUndefined();
    expect(loginResponse.body?.user).toBeDefined();
    const user = loginResponse.body!.user as Record<string, unknown>;
    expect(user.token).toBeTruthy();
    expect(user.email).toBe('alice@test.com');
    expect(user.username).toBe('alice');
  });

  it('login fails with wrong password', async () => {
    const kernel = createRealWorldKernel();

    await registerUser(kernel, 'bob', 'bob@test.com', 'password123');

    const loginResponse = await kernel.handleRequest({
      method: 'login',
      email: 'bob@test.com',
      password: 'wrongpassword',
    });

    expect(loginResponse.error).toBe('Invalid credentials');
    expect(loginResponse.code).toBe(401);
  });
});

describe('Stage 7 — Article CRUD Flow (end-to-end)', () => {
  it('creates an article with JWT auth', async () => {
    const kernel = createRealWorldKernel();

    // Register and get JWT
    const regResponse = await registerUser(kernel, 'writer', 'writer@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;
    expect(token).toBeTruthy();

    // Create an article
    const createResponse = await kernel.handleRequest({
      method: 'create_article',
      title: 'My First Article',
      description: 'An introduction',
      body: 'Hello world, this is my first article.',
      token,
    });

    expect(createResponse.error).toBeUndefined();
    expect(createResponse.body?.article).toBeDefined();
  });

  it('deletes an article with JWT auth', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'author', 'author@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    // Create an article
    const createResponse = await kernel.handleRequest({
      method: 'create_article',
      title: 'Temporary Article',
      description: 'Will be deleted',
      body: 'This will be removed.',
      token,
    });

    // Get the article slug from response
    const articleData = createResponse.body?.article as Record<string, unknown> | undefined;

    // Delete the article (using the flow's generated article ID)
    // We need to get the article reference from the flow log
    const flowLog = kernel.getFlowLog(createResponse.flowId);
    const articleCreation = flowLog.find(
      r => r.concept === 'urn:copf/Article' && r.action === 'create' && r.type === 'completion',
    );
    expect(articleCreation).toBeDefined();
    const articleId = articleCreation!.output?.article as string;

    const deleteResponse = await kernel.handleRequest({
      method: 'delete_article',
      article: articleId,
      token,
    });

    expect(deleteResponse.error).toBeUndefined();
    expect(deleteResponse.body?.deleted).toBe(articleId);
  });
});

describe('Stage 7 — Cascade Delete Comments (end-to-end)', () => {
  it('deleting an article cascades to delete its comments', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'author', 'author@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    // Create an article
    const createArticleResponse = await kernel.handleRequest({
      method: 'create_article',
      title: 'Article with Comments',
      description: 'Has comments',
      body: 'Content.',
      token,
    });

    const createFlowLog = kernel.getFlowLog(createArticleResponse.flowId);
    const articleCreation = createFlowLog.find(
      r => r.concept === 'urn:copf/Article' && r.action === 'create' && r.type === 'completion',
    );
    const articleId = articleCreation!.output?.article as string;

    // Create comments on the article
    const commentResponse1 = await kernel.handleRequest({
      method: 'create_comment',
      body: 'First comment',
      article: articleId,
      token,
    });
    expect(commentResponse1.error).toBeUndefined();

    const commentResponse2 = await kernel.handleRequest({
      method: 'create_comment',
      body: 'Second comment',
      article: articleId,
      token,
    });
    expect(commentResponse2.error).toBeUndefined();

    // Delete the article — should cascade delete comments
    const deleteResponse = await kernel.handleRequest({
      method: 'delete_article',
      article: articleId,
      token,
    });
    expect(deleteResponse.error).toBeUndefined();

    // Check the delete flow log for comment deletions
    const deleteFlowLog = kernel.getFlowLog(deleteResponse.flowId);
    const commentDeletions = deleteFlowLog.filter(
      r => r.concept === 'urn:copf/Comment' && r.action === 'delete' && r.type === 'completion',
    );
    expect(commentDeletions.length).toBe(2);
  });
});

describe('Stage 7 — Comment Flow (end-to-end)', () => {
  it('creates a comment with JWT auth', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'commenter', 'commenter@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    const commentResponse = await kernel.handleRequest({
      method: 'create_comment',
      body: 'Nice article!',
      article: 'article-123',
      token,
    });

    expect(commentResponse.error).toBeUndefined();
    expect(commentResponse.body?.comment).toBeTruthy();
  });

  it('deletes a comment with JWT auth', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'commenter', 'commenter@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    // Create a comment
    const createResponse = await kernel.handleRequest({
      method: 'create_comment',
      body: 'To be deleted',
      article: 'article-123',
      token,
    });
    const commentId = createResponse.body?.comment as string;
    expect(commentId).toBeTruthy();

    // Delete the comment
    const deleteResponse = await kernel.handleRequest({
      method: 'delete_comment',
      comment: commentId,
      token,
    });

    expect(deleteResponse.error).toBeUndefined();
    expect(deleteResponse.body?.deleted).toBe(commentId);
  });
});

describe('Stage 7 — Follow Flow (end-to-end)', () => {
  it('follows and unfollows a user', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'follower', 'follower@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    // Follow
    const followResponse = await kernel.handleRequest({
      method: 'follow',
      target: 'target-user-id',
      token,
    });
    expect(followResponse.error).toBeUndefined();
    expect(followResponse.body?.following).toBe(true);

    // Unfollow
    const unfollowResponse = await kernel.handleRequest({
      method: 'unfollow',
      target: 'target-user-id',
      token,
    });
    expect(unfollowResponse.error).toBeUndefined();
    expect(unfollowResponse.body?.following).toBe(false);
  });
});

describe('Stage 7 — Favorite Flow (end-to-end)', () => {
  it('favorites and unfavorites an article', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'reader', 'reader@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    // Favorite
    const favResponse = await kernel.handleRequest({
      method: 'favorite',
      article: 'article-456',
      token,
    });
    expect(favResponse.error).toBeUndefined();
    expect(favResponse.body?.favorited).toBe(true);

    // Unfavorite
    const unfavResponse = await kernel.handleRequest({
      method: 'unfavorite',
      article: 'article-456',
      token,
    });
    expect(unfavResponse.error).toBeUndefined();
    expect(unfavResponse.body?.favorited).toBe(false);
  });
});

describe('Stage 7 — Profile Flow (end-to-end)', () => {
  it('updates a user profile with JWT auth', async () => {
    const kernel = createRealWorldKernel();

    const regResponse = await registerUser(kernel, 'profuser', 'profuser@test.com', 'password123');
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;

    const profileResponse = await kernel.handleRequest({
      method: 'update_profile',
      bio: 'I am a developer',
      image: 'http://example.com/avatar.jpg',
      token,
    });

    expect(profileResponse.error).toBeUndefined();
    expect(profileResponse.body?.profile).toBeDefined();
    const profile = profileResponse.body!.profile as Record<string, unknown>;
    expect(profile.bio).toBe('I am a developer');
    expect(profile.image).toBe('http://example.com/avatar.jpg');
  });
});

// ============================================================
// 5. Full RealWorld User Journey
// ============================================================

describe('Stage 7 — Full User Journey', () => {
  it('register → login → create article → comment → favorite → follow', async () => {
    const kernel = createRealWorldKernel();

    // 1. Register
    const regResponse = await registerUser(kernel, 'alice', 'alice@test.com', 'password123');
    expect(regResponse.body?.user).toBeDefined();
    const token = (regResponse.body?.user as Record<string, unknown>)?.token as string;
    expect(token).toBeTruthy();

    // 2. Update profile
    const profileResponse = await kernel.handleRequest({
      method: 'update_profile',
      bio: 'Hello from Alice',
      image: 'http://alice.png',
      token,
    });
    expect(profileResponse.error).toBeUndefined();

    // 3. Create an article
    const articleResponse = await kernel.handleRequest({
      method: 'create_article',
      title: 'Alice First Post',
      description: 'My first post',
      body: 'Welcome to my blog!',
      token,
    });
    expect(articleResponse.error).toBeUndefined();

    // Extract article ID from flow log
    const articleFlowLog = kernel.getFlowLog(articleResponse.flowId);
    const articleCreation = articleFlowLog.find(
      r => r.concept === 'urn:copf/Article' && r.action === 'create' && r.type === 'completion',
    );
    const articleId = articleCreation!.output?.article as string;

    // 4. Comment on the article
    const commentResponse = await kernel.handleRequest({
      method: 'create_comment',
      body: 'Self-comment!',
      article: articleId,
      token,
    });
    expect(commentResponse.error).toBeUndefined();

    // 5. Favorite the article
    const favResponse = await kernel.handleRequest({
      method: 'favorite',
      article: articleId,
      token,
    });
    expect(favResponse.error).toBeUndefined();

    // 6. Follow another user
    const followResponse = await kernel.handleRequest({
      method: 'follow',
      target: 'some-other-user',
      token,
    });
    expect(followResponse.error).toBeUndefined();

    // Verify the full journey completed successfully
    expect(followResponse.body?.following).toBe(true);
  });
});
