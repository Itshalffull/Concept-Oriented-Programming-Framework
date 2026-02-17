// ============================================================
// RealWorld End-to-End Flow Tests
//
// Validates kernel-driven flows for the Conduit/RealWorld app:
//   - Login (email/password → JWT)
//   - Article creation (JWT auth → create)
//   - Article deletion with cascade comment deletion
//   - Comment creation (JWT auth → create)
//   - Follow / unfollow
//   - Favorite / unfavorite
//   - Profile update
//   - Full user journey
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createKernel } from '../implementations/typescript/framework/kernel-factory.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';

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

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

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
// 1. Login Flow
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

// ============================================================
// 2. Article CRUD Flow
// ============================================================

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

// ============================================================
// 3. Cascade Delete Comments
// ============================================================

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

// ============================================================
// 4. Comment Flow
// ============================================================

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

// ============================================================
// 5. Follow Flow
// ============================================================

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

// ============================================================
// 6. Favorite Flow
// ============================================================

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

// ============================================================
// 7. Profile Flow
// ============================================================

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
// 8. Full RealWorld User Journey
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
