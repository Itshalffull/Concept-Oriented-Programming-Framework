// ============================================================
// Effect Typing & Purity Validation Tests
//
// Tests structural effect accumulation in StorageProgram DSL
// builders and purity validation in FunctionalHandler.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProgram,
  get,
  find,
  put,
  del,
  merge,
  delFrom,
  putFrom,
  mergeFrom,
  branch,
  mapBindings,
  pure,
  pureFrom,
  compose,
  purityOf,
  validatePurity,
  serializeProgram,
  classifyPurity,
} from '../runtime/storage-program.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { functionalHandlerHandler } from '../handlers/ts/monadic/functional-handler.handler.js';

// ============================================================
// Structural Effect Accumulation
// ============================================================

describe('Structural Effect Accumulation', () => {
  it('empty program has no effects', () => {
    const p = createProgram();
    expect(p.effects.reads.size).toBe(0);
    expect(p.effects.writes.size).toBe(0);
  });

  it('get adds to read set', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.writes.size).toBe(0);
  });

  it('find adds to read set', () => {
    const p = find(createProgram(), 'posts', { author: 'alice' }, 'posts');
    expect(p.effects.reads.has('posts')).toBe(true);
    expect(p.effects.writes.size).toBe(0);
  });

  it('put adds to write set', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    expect(p.effects.writes.has('users')).toBe(true);
    expect(p.effects.reads.size).toBe(0);
  });

  it('del adds to write set', () => {
    const p = del(createProgram(), 'sessions', 's1');
    expect(p.effects.writes.has('sessions')).toBe(true);
    expect(p.effects.reads.size).toBe(0);
  });

  it('merge adds to both read and write sets', () => {
    const p = merge(createProgram(), 'users', 'u1', { age: 30 });
    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.writes.has('users')).toBe(true);
  });

  it('delFrom adds to write set', () => {
    const p = delFrom(createProgram(), 'tokens', (_b) => 'tok-1');
    expect(p.effects.writes.has('tokens')).toBe(true);
    expect(p.effects.reads.size).toBe(0);
  });

  it('putFrom adds to write set', () => {
    const p = putFrom(createProgram(), 'logs', 'l1', (_b) => ({ msg: 'hi' }));
    expect(p.effects.writes.has('logs')).toBe(true);
    expect(p.effects.reads.size).toBe(0);
  });

  it('mergeFrom adds to both read and write sets', () => {
    const p = mergeFrom(createProgram(), 'profiles', 'p1', (_b) => ({ bio: 'x' }));
    expect(p.effects.reads.has('profiles')).toBe(true);
    expect(p.effects.writes.has('profiles')).toBe(true);
  });

  it('mapBindings adds no effects', () => {
    const p0 = get(createProgram(), 'users', 'u1', 'user');
    const p = mapBindings(p0, (_b) => 'derived', 'result');
    expect(p.effects.reads.size).toBe(1);
    expect(p.effects.writes.size).toBe(0);
  });

  it('pure adds no effects', () => {
    const p0 = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    const p = pure(p0, { variant: 'ok' });
    expect(p.effects.writes.size).toBe(1);
    expect(p.effects.reads.size).toBe(0);
  });

  it('pureFrom adds no effects', () => {
    const p0 = get(createProgram(), 'users', 'u1', 'user');
    const p = pureFrom(p0, (_b) => ({ variant: 'ok' }));
    expect(p.effects.reads.size).toBe(1);
    expect(p.effects.writes.size).toBe(0);
  });

  it('accumulates effects across multiple instructions', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = get(p, 'sessions', 's1', 'session');
    p = put(p, 'audit', 'a1', { event: 'login' });
    p = del(p, 'tokens', 't1');

    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.reads.has('sessions')).toBe(true);
    expect(p.effects.writes.has('audit')).toBe(true);
    expect(p.effects.writes.has('tokens')).toBe(true);
    expect(p.effects.reads.size).toBe(2);
    expect(p.effects.writes.size).toBe(2);
  });

  it('deduplicates repeated relations', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'a');
    p = get(p, 'users', 'u2', 'b');
    p = put(p, 'users', 'u1', { name: 'Updated' });

    expect(p.effects.reads.size).toBe(1);
    expect(p.effects.writes.size).toBe(1);
  });
});

// ============================================================
// Branch Effect Merging
// ============================================================

describe('Branch Effect Merging', () => {
  it('branch merges effects from both arms conservatively', () => {
    const thenArm = put(createProgram(), 'users', 'u1', { active: true });
    const elseArm = del(createProgram(), 'sessions', 's1');

    const p = branch(createProgram(), (_b) => true, thenArm, elseArm);
    expect(p.effects.writes.has('users')).toBe(true);
    expect(p.effects.writes.has('sessions')).toBe(true);
  });

  it('branch merges reads from both arms', () => {
    const thenArm = get(createProgram(), 'users', 'u1', 'user');
    const elseArm = find(createProgram(), 'posts', {}, 'posts');

    const p = branch(createProgram(), (_b) => true, thenArm, elseArm);
    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.reads.has('posts')).toBe(true);
  });

  it('branch includes effects from instructions before the branch', () => {
    let p = createProgram();
    p = get(p, 'config', 'c1', 'cfg');

    const thenArm = put(createProgram(), 'users', 'u1', { active: true });
    const elseArm = pure(createProgram(), { variant: 'noop' });

    p = branch(p, (_b) => true, thenArm, elseArm);
    expect(p.effects.reads.has('config')).toBe(true);
    expect(p.effects.writes.has('users')).toBe(true);
  });
});

// ============================================================
// Compose Effect Merging
// ============================================================

describe('Compose Effect Merging', () => {
  it('compose merges effects from both programs', () => {
    const first = pure(get(createProgram(), 'users', 'u1', 'user'), { variant: 'ok' });
    const second = pure(put(createProgram(), 'audit', 'a1', { event: 'read' }), { variant: 'ok' });

    const composed = compose(first, 'result', second);
    expect(composed.effects.reads.has('users')).toBe(true);
    expect(composed.effects.writes.has('audit')).toBe(true);
  });
});

// ============================================================
// purityOf
// ============================================================

describe('purityOf', () => {
  it('returns pure for empty program', () => {
    expect(purityOf(createProgram())).toBe('pure');
  });

  it('returns read-only for read-only program', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    expect(purityOf(p)).toBe('read-only');
  });

  it('returns read-write for program with writes', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    expect(purityOf(p)).toBe('read-write');
  });

  it('returns read-write when both reads and writes present', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = put(p, 'audit', 'a1', { event: 'check' });
    expect(purityOf(p)).toBe('read-write');
  });
});

// ============================================================
// validatePurity (runtime/storage-program.ts)
// ============================================================

describe('validatePurity (runtime)', () => {
  it('returns null for valid pure program', () => {
    const p = pure(createProgram(), { variant: 'ok' });
    expect(validatePurity(p, 'pure')).toBeNull();
  });

  it('returns null for valid read-only program', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    expect(validatePurity(p, 'read-only')).toBeNull();
  });

  it('returns null for valid read-write program', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    expect(validatePurity(p, 'read-write')).toBeNull();
  });

  it('returns null when declared purity is more permissive than actual', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    expect(validatePurity(p, 'read-write')).toBeNull();
  });

  it('returns error when pure declaration has reads', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    const err = validatePurity(p, 'pure');
    expect(err).not.toBeNull();
    expect(err).toContain('reads from');
    expect(err).toContain('users');
  });

  it('returns error when pure declaration has writes', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    const err = validatePurity(p, 'pure');
    expect(err).not.toBeNull();
    expect(err).toContain('writes to');
    expect(err).toContain('users');
  });

  it('returns error when read-only declaration has writes', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    const err = validatePurity(p, 'read-only');
    expect(err).not.toBeNull();
    expect(err).toContain('writes to');
    expect(err).toContain('users');
  });

  it('read-write always passes', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = put(p, 'audit', 'a1', { event: 'x' });
    p = del(p, 'sessions', 's1');
    expect(validatePurity(p, 'read-write')).toBeNull();
  });
});

// ============================================================
// classifyPurity (prefers structural effects)
// ============================================================

describe('classifyPurity', () => {
  it('returns pure for empty program', () => {
    expect(classifyPurity(createProgram())).toBe('pure');
  });

  it('returns read-only for read-only program via structural effects', () => {
    const p = get(createProgram(), 'users', 'u1', 'user');
    expect(classifyPurity(p)).toBe('read-only');
  });

  it('returns read-write for program with writes via structural effects', () => {
    const p = put(createProgram(), 'users', 'u1', { name: 'Alice' });
    expect(classifyPurity(p)).toBe('read-write');
  });
});

// ============================================================
// serializeProgram includes effects
// ============================================================

describe('serializeProgram includes structural effects', () => {
  it('serializes read and write effects', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = put(p, 'audit', 'a1', { event: 'read' });
    p = pure(p, { variant: 'ok' });

    const serialized = JSON.parse(serializeProgram(p));
    expect(serialized.effects).toBeDefined();
    expect(serialized.effects.reads).toContain('users');
    expect(serialized.effects.writes).toContain('audit');
  });

  it('serializes empty effects for pure programs', () => {
    const p = pure(createProgram(), { variant: 'ok' });
    const serialized = JSON.parse(serializeProgram(p));
    expect(serialized.effects.reads).toEqual([]);
    expect(serialized.effects.writes).toEqual([]);
  });
});

// ============================================================
// FunctionalHandler validatePurity Action
// ============================================================

describe('FunctionalHandler validatePurity', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(async () => {
    storage = createInMemoryStorage();
    // Register a read-only handler
    await functionalHandlerHandler.register(
      { handler: 'h-ro', concept: 'User', action: 'check', purity: 'read-only' },
      storage,
    );
    // Register a pure handler
    await functionalHandlerHandler.register(
      { handler: 'h-pure', concept: 'Config', action: 'get', purity: 'pure' },
      storage,
    );
    // Register a read-write handler
    await functionalHandlerHandler.register(
      { handler: 'h-rw', concept: 'User', action: 'create', purity: 'read-write' },
      storage,
    );
  });

  it('returns notfound for unknown handler', async () => {
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'unknown', program: '{}' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('validates read-only handler with read-only program', async () => {
    const program = JSON.stringify({
      effects: { reads: ['users'], writes: [] },
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-ro', program },
      storage,
    );
    expect(result.variant).toBe('valid');
    expect(result.declaredPurity).toBe('read-only');
    expect(result.actualPurity).toBe('read-only');
  });

  it('detects violation: read-only handler with writes', async () => {
    const program = JSON.stringify({
      effects: { reads: ['users'], writes: ['users'] },
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-ro', program },
      storage,
    );
    expect(result.variant).toBe('violation');
    expect(result.declaredPurity).toBe('read-only');
    expect(result.actualPurity).toBe('read-write');
    expect(result.message).toContain('writes to');
  });

  it('detects violation: pure handler with reads', async () => {
    const program = JSON.stringify({
      effects: { reads: ['config'], writes: [] },
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-pure', program },
      storage,
    );
    expect(result.variant).toBe('violation');
    expect(result.declaredPurity).toBe('pure');
    expect(result.actualPurity).toBe('read-only');
    expect(result.message).toContain('reads from');
  });

  it('validates read-write handler with any effects', async () => {
    const program = JSON.stringify({
      effects: { reads: ['users', 'sessions'], writes: ['audit', 'users'] },
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-rw', program },
      storage,
    );
    expect(result.variant).toBe('valid');
    expect(result.declaredPurity).toBe('read-write');
    expect(result.actualPurity).toBe('read-write');
  });

  it('validates pure handler with pure program', async () => {
    const program = JSON.stringify({
      effects: { reads: [], writes: [] },
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-pure', program },
      storage,
    );
    expect(result.variant).toBe('valid');
    expect(result.declaredPurity).toBe('pure');
    expect(result.actualPurity).toBe('pure');
  });

  it('falls back to instruction walk when no structural effects', async () => {
    const program = JSON.stringify({
      instructions: [
        { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
        { tag: 'put', relation: 'audit', key: 'a1', value: {} },
      ],
    });
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-ro', program },
      storage,
    );
    expect(result.variant).toBe('violation');
    expect(result.actualPurity).toBe('read-write');
  });

  it('handles unparseable program gracefully', async () => {
    const result = await functionalHandlerHandler.validatePurity(
      { handler: 'h-ro', program: 'not-json{{{' },
      storage,
    );
    expect(result.variant).toBe('violation');
    expect(result.message).toContain('Failed to parse');
  });
});
