// Conduit SDK Integration — Go + Python Client Validation
// Validates that SDK client files exist and have correct structure.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SDKS_DIR = resolve(__dirname, '..', 'examples', 'conduit', 'sdks');

describe('Conduit SDK — Go Client', () => {
  const goDir = resolve(SDKS_DIR, 'go');

  it('main.go exists and has correct structure', () => {
    const path = resolve(goDir, 'main.go');
    expect(existsSync(path)).toBe(true);

    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('package main');
    expect(content).toContain('ConduitClient');
    expect(content).toContain('Register');
    expect(content).toContain('Login');
    expect(content).toContain('CreateArticle');
    expect(content).toContain('Follow');
    expect(content).toContain('Favorite');
    expect(content).toContain('/api/users');
    expect(content).toContain('/api/articles');
    expect(content).toContain('Authorization');
  });

  it('go.mod exists', () => {
    expect(existsSync(resolve(goDir, 'go.mod'))).toBe(true);
    const content = readFileSync(resolve(goDir, 'go.mod'), 'utf-8');
    expect(content).toContain('module');
    expect(content).toContain('go 1.');
  });
});

describe('Conduit SDK — Python Client', () => {
  const pyDir = resolve(SDKS_DIR, 'python');

  it('client.py exists and has correct structure', () => {
    const path = resolve(pyDir, 'client.py');
    expect(existsSync(path)).toBe(true);

    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('class ConduitClient');
    expect(content).toContain('def register');
    expect(content).toContain('def login');
    expect(content).toContain('def create_article');
    expect(content).toContain('def follow');
    expect(content).toContain('def favorite');
    expect(content).toContain('/api/users');
    expect(content).toContain('/api/articles');
    expect(content).toContain('Authorization');
  });

  it('requirements.txt exists', () => {
    expect(existsSync(resolve(pyDir, 'requirements.txt'))).toBe(true);
  });
});
