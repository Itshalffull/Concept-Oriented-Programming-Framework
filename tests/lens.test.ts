// ============================================================
// Typed Lens Tests
//
// Tests for the Lens concept, StateLens DSL, lens-based
// StorageProgram instructions, LensExtractionProvider, and
// LensStructuralDiffProvider.
//
// See Architecture doc — Lens, LensMigration, LensImpactAnalysis
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createProgram, get, put, del, merge, find,
  getLens, putLens, modifyLens,
  relation, at, field, composeLens,
  extractReadSet, extractWriteSet, classifyPurity,
  serializeProgram, pure, pureFrom,
  type StorageProgram, type StateLens,
} from '../runtime/storage-program.js';
import { lensHandler, resetLensCounter } from '../handlers/ts/monadic/lens.handler.js';
import { lensExtractionProviderHandler } from '../handlers/ts/monadic/providers/lens-extraction-provider.handler.js';
import { lensStructuralDiffProviderHandler } from '../handlers/ts/monadic/providers/lens-structural-diff-provider.handler.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
 * Walks instructions to find the first 'pure' or 'pureFrom' tag.
 */
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
    if (instr.tag === 'branch') {
      const thenVal = getPureValue(instr.thenBranch as StorageProgram<unknown>);
      const elseVal = getPureValue(instr.elseBranch as StorageProgram<unknown>);
      return thenVal || elseVal;
    }
  }
  return null;
}

// ============================================================
// StateLens DSL — Builder Functions
// ============================================================

describe('StateLens DSL', () => {
  describe('relation()', () => {
    it('creates a relation-level lens with one segment', () => {
      const lens = relation('users');
      expect(lens.segments).toEqual([{ kind: 'relation', name: 'users' }]);
      expect(lens.sourceType).toBe('store');
      expect(lens.focusType).toBe('relation<users>');
    });
  });

  describe('at()', () => {
    it('narrows a relation lens to a specific record', () => {
      const lens = at(relation('users'), 'u1');
      expect(lens.segments).toEqual([
        { kind: 'relation', name: 'users' },
        { kind: 'key', value: 'u1' },
      ]);
      expect(lens.focusType).toBe('record');
    });
  });

  describe('field()', () => {
    it('narrows a lens to a specific field', () => {
      const lens = field(at(relation('users'), 'u1'), 'email');
      expect(lens.segments).toEqual([
        { kind: 'relation', name: 'users' },
        { kind: 'key', value: 'u1' },
        { kind: 'field', name: 'email' },
      ]);
      expect(lens.focusType).toBe('email');
    });
  });

  describe('composeLens()', () => {
    it('concatenates segments from two lenses', () => {
      const outer = relation('users');
      const inner: StateLens = {
        segments: [{ kind: 'key', value: 'u1' }, { kind: 'field', name: 'email' }],
        sourceType: 'relation<users>',
        focusType: 'email',
      };
      const composed = composeLens(outer, inner);
      expect(composed.segments).toHaveLength(3);
      expect(composed.sourceType).toBe('store');
      expect(composed.focusType).toBe('email');
    });

    it('is associative', () => {
      const a = relation('users');
      const b: StateLens = {
        segments: [{ kind: 'key', value: 'u1' }],
        sourceType: 'relation<users>',
        focusType: 'record',
      };
      const c: StateLens = {
        segments: [{ kind: 'field', name: 'email' }],
        sourceType: 'record',
        focusType: 'email',
      };
      const leftAssoc = composeLens(composeLens(a, b), c);
      const rightAssoc = composeLens(a, composeLens(b, c));
      expect(leftAssoc.segments).toEqual(rightAssoc.segments);
    });
  });
});

// ============================================================
// Lens-Based StorageProgram Instructions
// ============================================================

describe('Lens StorageProgram Instructions', () => {
  describe('getLens()', () => {
    it('appends a getLens instruction and tracks read effects', () => {
      const lens = at(relation('users'), 'u1');
      let p = createProgram();
      p = getLens(p, lens, 'user');
      expect(p.instructions).toHaveLength(1);
      expect(p.instructions[0]).toEqual({ tag: 'getLens', lens, bindAs: 'user' });
      expect(p.effects.reads.has('users')).toBe(true);
      expect(p.effects.writes.has('users')).toBe(false);
    });

    it('throws on sealed program', () => {
      let p = createProgram();
      p = pure(p, 'done');
      expect(() => getLens(p, relation('x'), 'y')).toThrow('sealed');
    });
  });

  describe('putLens()', () => {
    it('appends a putLens instruction and tracks write effects', () => {
      const lens = at(relation('articles'), 'a1');
      let p = createProgram();
      p = putLens(p, lens, { title: 'Hello' });
      expect(p.instructions).toHaveLength(1);
      expect(p.instructions[0]).toMatchObject({ tag: 'putLens', lens });
      expect(p.effects.writes.has('articles')).toBe(true);
      expect(p.effects.reads.has('articles')).toBe(false);
    });
  });

  describe('modifyLens()', () => {
    it('appends a modifyLens instruction and tracks both read+write effects', () => {
      const lens = at(relation('counters'), 'c1');
      const fn = (b: Record<string, unknown>) => ({ count: 1 });
      let p = createProgram();
      p = modifyLens(p, lens, fn);
      expect(p.instructions).toHaveLength(1);
      expect(p.effects.reads.has('counters')).toBe(true);
      expect(p.effects.writes.has('counters')).toBe(true);
    });
  });

  describe('mixed string-based and lens-based instructions', () => {
    it('correctly accumulates effects from both instruction types', () => {
      let p = createProgram();
      p = get(p, 'users', 'u1', 'user');
      p = putLens(p, at(relation('articles'), 'a1'), { title: 'Test' });
      p = getLens(p, at(relation('comments'), 'c1'), 'comment');
      expect(p.effects.reads.has('users')).toBe(true);
      expect(p.effects.reads.has('comments')).toBe(true);
      expect(p.effects.writes.has('articles')).toBe(true);
    });
  });
});

// ============================================================
// Analysis Helpers — Lens Instruction Support
// ============================================================

describe('Analysis Helpers with Lens Instructions', () => {
  describe('extractReadSet', () => {
    it('includes relations from getLens instructions', () => {
      let p = createProgram();
      p = getLens(p, at(relation('users'), 'u1'), 'user');
      p = getLens(p, at(relation('profiles'), 'p1'), 'profile');
      const reads = extractReadSet(p);
      expect(reads.has('users')).toBe(true);
      expect(reads.has('profiles')).toBe(true);
    });

    it('includes relations from modifyLens instructions', () => {
      let p = createProgram();
      p = modifyLens(p, at(relation('counters'), 'c1'), () => ({ count: 1 }));
      const reads = extractReadSet(p);
      expect(reads.has('counters')).toBe(true);
    });
  });

  describe('extractWriteSet', () => {
    it('includes relations from putLens instructions', () => {
      let p = createProgram();
      p = putLens(p, at(relation('articles'), 'a1'), { title: 'Test' });
      const writes = extractWriteSet(p);
      expect(writes.has('articles')).toBe(true);
    });

    it('includes relations from modifyLens instructions', () => {
      let p = createProgram();
      p = modifyLens(p, at(relation('counters'), 'c1'), () => ({ count: 1 }));
      const writes = extractWriteSet(p);
      expect(writes.has('counters')).toBe(true);
    });
  });

  describe('classifyPurity', () => {
    it('classifies getLens-only programs as read-only', () => {
      let p = createProgram();
      p = getLens(p, at(relation('users'), 'u1'), 'user');
      expect(classifyPurity(p)).toBe('read-only');
    });

    it('classifies putLens programs as read-write', () => {
      let p = createProgram();
      p = putLens(p, at(relation('users'), 'u1'), { name: 'test' });
      expect(classifyPurity(p)).toBe('read-write');
    });

    it('classifies modifyLens programs as read-write', () => {
      let p = createProgram();
      p = modifyLens(p, at(relation('users'), 'u1'), () => ({ name: 'test' }));
      expect(classifyPurity(p)).toBe('read-write');
    });
  });
});

// ============================================================
// Serialization — Lens Instructions
// ============================================================

describe('Serialization with Lens Instructions', () => {
  it('serializes getLens instructions correctly', () => {
    let p = createProgram();
    p = getLens(p, at(relation('users'), 'u1'), 'user');
    p = pure(p, 'done');
    const json = serializeProgram(p);
    const parsed = JSON.parse(json);
    expect(parsed.instructions[0].tag).toBe('getLens');
    expect(parsed.instructions[0].lens.segments).toEqual([
      { kind: 'relation', name: 'users' },
      { kind: 'key', value: 'u1' },
    ]);
    expect(parsed.effects.reads).toContain('users');
  });

  it('serializes modifyLens instructions with fn.toString()', () => {
    let p = createProgram();
    p = modifyLens(p, at(relation('counters'), 'c1'), () => ({ count: 1 }));
    p = pure(p, 'done');
    const json = serializeProgram(p);
    const parsed = JSON.parse(json);
    expect(parsed.instructions[0].tag).toBe('modifyLens');
    expect(typeof parsed.instructions[0].fn).toBe('string');
  });
});

// ============================================================
// Lens Handler (Functional)
// ============================================================

describe('Lens Handler', () => {
  describe('create', () => {
    it('returns a StorageProgram with ok variant for new lens', () => {
      const p = lensHandler.create({
        lens: 'lens-1', relation: 'users', key: 'u1', field: 'email',
      });
      expect(p.instructions.length).toBeGreaterThan(0);
      // Should have getLens (existence check) + branch
      const tags = p.instructions.map(i => i.tag);
      expect(tags).toContain('getLens');
      expect(tags).toContain('branch');
    });

    it('builds a program that reads and writes the lenses relation', () => {
      const p = lensHandler.create({
        lens: 'lens-1', relation: 'users', key: '', field: '',
      });
      expect(p.effects.reads.has('lenses')).toBe(true);
      expect(p.effects.writes.has('lenses')).toBe(true);
    });
  });

  describe('fromRelation', () => {
    it('builds a program for relation-level lens', () => {
      const p = lensHandler.fromRelation({ lens: 'rel-1', relation: 'articles' });
      expect(p.effects.reads.has('lenses')).toBe(true);
      expect(p.effects.writes.has('lenses')).toBe(true);
    });
  });

  describe('compose', () => {
    it('builds a program that reads both source lenses', () => {
      const p = lensHandler.compose({ outer: 'lens-a', inner: 'lens-b' });
      expect(p.effects.reads.has('lenses')).toBe(true);
    });
  });

  describe('get', () => {
    it('builds a read-only program for lens lookup', () => {
      const p = lensHandler.get({ lens: 'lens-1' });
      expect(p.effects.reads.has('lenses')).toBe(true);
      // get is read-only — no writes
      expect(p.effects.writes.has('lenses')).toBe(false);
    });
  });

  describe('decompose', () => {
    it('builds a read-only program for segment extraction', () => {
      const p = lensHandler.decompose({ lens: 'lens-1' });
      expect(p.effects.reads.has('lenses')).toBe(true);
    });
  });

  describe('validate', () => {
    it('builds a program that reads lenses relation', () => {
      const p = lensHandler.validate({
        lens: 'lens-1',
        conceptSpec: JSON.stringify({ state: { users: 'set U', email: 'U -> String' } }),
      });
      expect(p.effects.reads.has('lenses')).toBe(true);
    });
  });

  describe('list', () => {
    it('builds a program using find on lenses relation', () => {
      const p = lensHandler.list({});
      expect(p.effects.reads.has('lenses')).toBe(true);
      const tags = p.instructions.map(i => i.tag);
      expect(tags).toContain('find');
    });
  });
});

// ============================================================
// LensExtractionProvider
// ============================================================

describe('LensExtractionProvider', () => {
  describe('analyze', () => {
    it('extracts lenses from string-based get instructions', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
          { tag: 'put', relation: 'articles', key: 'a1', value: {} },
        ],
        terminated: false,
        effects: { reads: ['users'], writes: ['articles'] },
      });

      const p = lensExtractionProviderHandler.analyze({ program });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');
      expect(result?.result).toBeDefined();

      const lenses = JSON.parse(result?.lenses as string);
      expect(lenses).toHaveLength(2);
      expect(lenses[0]).toMatchObject({ relation: 'users', kind: 'record', access: 'read' });
      expect(lenses[1]).toMatchObject({ relation: 'articles', kind: 'record', access: 'write' });
    });

    it('extracts lenses from getLens/putLens instructions', () => {
      const program = JSON.stringify({
        instructions: [
          {
            tag: 'getLens',
            lens: {
              segments: [
                { kind: 'relation', name: 'users' },
                { kind: 'key', value: 'u1' },
                { kind: 'field', name: 'email' },
              ],
            },
            bindAs: 'email',
          },
        ],
        terminated: false,
        effects: { reads: ['users'], writes: [] },
      });

      const p = lensExtractionProviderHandler.analyze({ program });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const lenses = JSON.parse(result?.lenses as string);
      expect(lenses).toHaveLength(1);
      expect(lenses[0]).toMatchObject({
        relation: 'users',
        key: 'u1',
        field: 'email',
        kind: 'field',
        access: 'read',
      });
    });

    it('builds access pattern summary', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
          { tag: 'merge', relation: 'users', key: 'u1', fields: {} },
        ],
        terminated: false,
        effects: { reads: ['users'], writes: ['users'] },
      });

      const p = lensExtractionProviderHandler.analyze({ program });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const pattern = JSON.parse(result?.accessPattern as string);
      // merge produces read-write
      expect(Object.values(pattern)).toContain('read-write');
    });

    it('returns error for invalid JSON', () => {
      const p = lensExtractionProviderHandler.analyze({ program: 'not-json' });
      const result = getPureValue(p);
      expect(result?.variant).toBe('error');
      expect(result?.message).toContain('Failed to analyze');
    });

    it('dogfoods putLens — writes to results via lens DSL', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'get', relation: 'users', key: 'u1', bindAs: 'x' }],
        terminated: false,
        effects: { reads: ['users'], writes: [] },
      });

      const p = lensExtractionProviderHandler.analyze({ program });
      // Should have a putLens instruction for storing results
      const tags = p.instructions.map(i => i.tag);
      expect(tags).toContain('putLens');
      expect(p.effects.writes.has('results')).toBe(true);
    });
  });
});

// ============================================================
// LensStructuralDiffProvider
// ============================================================

describe('LensStructuralDiffProvider', () => {
  describe('analyze', () => {
    it('returns identical for same schemas', () => {
      const schema = JSON.stringify([{ name: 'email', type: 'String' }]);
      const p = lensStructuralDiffProviderHandler.analyze({
        oldSchema: schema,
        newSchema: schema,
      });
      const result = getPureValue(p);
      expect(result?.variant).toBe('identical');
    });

    it('detects added fields', () => {
      const oldSchema = JSON.stringify([{ name: 'email', type: 'String' }]);
      const newSchema = JSON.stringify([
        { name: 'email', type: 'String' },
        { name: 'phone', type: 'String' },
      ]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ op: 'addField', field: 'phone', type: 'String' });
    });

    it('detects removed fields', () => {
      const oldSchema = JSON.stringify([
        { name: 'email', type: 'String' },
        { name: 'phone', type: 'String' },
      ]);
      const newSchema = JSON.stringify([{ name: 'email', type: 'String' }]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ op: 'removeField', field: 'phone', type: 'String' });
    });

    it('detects renamed fields (same type, one removed + one added)', () => {
      const oldSchema = JSON.stringify([{ name: 'email', type: 'String' }]);
      const newSchema = JSON.stringify([{ name: 'emailAddress', type: 'String' }]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ op: 'renameField', from: 'email', to: 'emailAddress' });
    });

    it('detects type changes', () => {
      const oldSchema = JSON.stringify([{ name: 'age', type: 'String' }]);
      const newSchema = JSON.stringify([{ name: 'age', type: 'Int' }]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({ op: 'changeType', field: 'age', from: 'String', to: 'Int' });
    });

    it('detects cardinality changes', () => {
      const oldSchema = JSON.stringify([{ name: 'tags', type: 'String', cardinality: 'one' }]);
      const newSchema = JSON.stringify([{ name: 'tags', type: 'String', cardinality: 'set' }]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toMatchObject({
        op: 'changeCardinality',
        field: 'tags',
        oldCardinality: 'one',
        newCardinality: 'set',
      });
    });

    it('handles complex schema evolution (add + rename + type change)', () => {
      const oldSchema = JSON.stringify([
        { name: 'email', type: 'String' },
        { name: 'age', type: 'String' },
      ]);
      const newSchema = JSON.stringify([
        { name: 'emailAddress', type: 'String' },
        { name: 'age', type: 'Int' },
        { name: 'phone', type: 'String' },
      ]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const result = getPureValue(p);
      expect(result?.variant).toBe('ok');

      const ops = JSON.parse(result?.operations as string);
      // Should detect: changeType(age), renameField(email→emailAddress), addField(phone)
      const opTypes = ops.map((o: { op: string }) => o.op);
      expect(opTypes).toContain('changeType');
      expect(opTypes).toContain('renameField');
      expect(opTypes).toContain('addField');
    });

    it('returns error for invalid JSON', () => {
      const p = lensStructuralDiffProviderHandler.analyze({
        oldSchema: 'not-json',
        newSchema: '[]',
      });
      const result = getPureValue(p);
      expect(result?.variant).toBe('error');
    });

    it('dogfoods putLens — writes to results via lens DSL', () => {
      const oldSchema = JSON.stringify([{ name: 'a', type: 'String' }]);
      const newSchema = JSON.stringify([{ name: 'b', type: 'String' }]);

      const p = lensStructuralDiffProviderHandler.analyze({ oldSchema, newSchema });
      const tags = p.instructions.map(i => i.tag);
      expect(tags).toContain('putLens');
      expect(p.effects.writes.has('results')).toBe(true);
    });
  });
});
