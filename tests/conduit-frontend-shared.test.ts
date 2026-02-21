// Conduit Frontend Shared Layer — Type and API Client Validation
// Tests the shared frontend code that all 15 framework UIs depend on.

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ROUTES, matchRoute } from '../examples/conduit/frontend/shared/routes.js';
import { saveAuth, getToken, getUser, clearAuth, isLoggedIn } from '../examples/conduit/frontend/shared/auth.js';

describe('Conduit Frontend — Shared Routes', () => {
  it('defines all 7 routes', () => {
    expect(Object.keys(ROUTES)).toHaveLength(7);
    expect(ROUTES.home.path).toBe('/');
    expect(ROUTES.login.path).toBe('/login');
    expect(ROUTES.register.path).toBe('/register');
    expect(ROUTES.editor.path).toBe('/editor');
    expect(ROUTES.settings.path).toBe('/settings');
    expect(ROUTES.article.path).toBe('/article/:slug');
    expect(ROUTES.profile.path).toBe('/profile/:username');
  });

  it('matches static routes', () => {
    const result = matchRoute('/login');
    expect(result).toBeTruthy();
    expect(result!.route.name).toBe('Login');
  });

  it('matches parameterized routes', () => {
    const result = matchRoute('/article/my-article');
    expect(result).toBeTruthy();
    expect(result!.route.name).toBe('Article');
    expect(result!.params.slug).toBe('my-article');
  });

  it('returns null for unknown routes', () => {
    const result = matchRoute('/unknown/path/here');
    expect(result).toBeNull();
  });

  it('auth routes do not require auth', () => {
    expect(ROUTES.login.requiresAuth).toBe(false);
    expect(ROUTES.register.requiresAuth).toBe(false);
  });

  it('editor and settings require auth', () => {
    expect(ROUTES.editor.requiresAuth).toBe(true);
    expect(ROUTES.settings.requiresAuth).toBe(true);
  });
});

describe('Conduit Frontend — Auth Store', () => {
  it('starts with no auth', () => {
    clearAuth();
    expect(isLoggedIn()).toBe(false);
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it('saves and retrieves auth', () => {
    saveAuth({ username: 'testuser', email: 'test@test.io', token: 'abc123' });
    expect(isLoggedIn()).toBe(true);
    expect(getToken()).toBe('abc123');
    expect(getUser()!.username).toBe('testuser');
  });

  it('clears auth', () => {
    saveAuth({ username: 'testuser', email: 'test@test.io', token: 'abc123' });
    clearAuth();
    expect(isLoggedIn()).toBe(false);
    expect(getToken()).toBeNull();
  });
});

describe('Conduit Frontend — Framework Files Exist', () => {
  const frontendDir = resolve(__dirname, '..', 'examples', 'conduit', 'frontend');

  // Web frameworks
  const webFrameworks = ['react', 'vue', 'svelte', 'solid', 'vanilla', 'ink'];
  for (const fw of webFrameworks) {
    it(`${fw}/ directory exists`, () => {
      expect(existsSync(resolve(frontendDir, fw)), `${fw}/ should exist`).toBe(true);
    });
  }

  // Native frameworks
  const nativeFrameworks = [
    'react-native', 'swiftui', 'compose', 'appkit',
    'watchkit', 'wear-compose', 'gtk', 'winui', 'nativescript',
  ];
  for (const fw of nativeFrameworks) {
    it(`${fw}/ directory exists`, () => {
      expect(existsSync(resolve(frontendDir, fw)), `${fw}/ should exist`).toBe(true);
    });
  }

  // Shared files
  const sharedFiles = ['shared/api-client.ts', 'shared/types.ts', 'shared/auth.ts', 'shared/routes.ts'];
  for (const file of sharedFiles) {
    it(`${file} exists`, () => {
      expect(existsSync(resolve(frontendDir, file)), `${file} should exist`).toBe(true);
    });
  }
});
