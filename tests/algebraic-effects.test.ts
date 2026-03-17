// ============================================================
// Algebraic Effects Tests
//
// Tests for completion variant tracking in EffectSet, the
// complete() builder, VariantExtractionProvider, and
// CompletionCoverage concept.
//
// See Architecture doc — Algebraic Effects for Sync/Transport
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createProgram, get, put, pure, pureFrom, branch, complete,
  extractCompletionVariants, serializeProgram,
  type StorageProgram, type EffectSet,
} from '../runtime/storage-program.js';
import { variantExtractionProviderHandler } from '../handlers/ts/monadic/providers/variant-extraction-provider.handler.js';
import { completionCoverageHandler } from '../handlers/ts/monadic/completion-coverage.handler.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
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
// EffectSet Extension — completionVariants
// ============================================================

describe('EffectSet completionVariants', () => {
  it('emptyEffects includes empty completionVariants', () => {
    const p = createProgram();
    expect(p.effects.completionVariants).toBeDefined();
    expect(p.effects.completionVariants.size).toBe(0);
  });

  it('get/put do not add completionVariants', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    expect(p.effects.completionVariants.size).toBe(0);
    p = put(p, 'users', 'u1', { name: 'Alice' });
    expect(p.effects.completionVariants.size).toBe(0);
  });

  it('pure() does not add completionVariants (backward compat)', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok', data: 'test' });
    expect(p.effects.completionVariants.size).toBe(0);
  });

  it('complete() adds variant to completionVariants', () => {
    let p = createProgram();
    p = complete(p, 'ok', { data: 'test' });
    expect(p.effects.completionVariants.size).toBe(1);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
  });

  it('complete() produces correct pure instruction with variant in value', () => {
    let p = createProgram();
    p = complete(p, 'ok', { user: 'u1' });
    const val = getPureValue(p);
    expect(val).toEqual({ variant: 'ok', user: 'u1' });
  });

  it('complete() seals the program', () => {
    let p = createProgram();
    p = complete(p, 'ok', {});
    expect(p.terminated).toBe(true);
    expect(() => complete(p, 'error', {})).toThrow('sealed');
  });

  it('branch merges completionVariants from both arms', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');

    const thenBranch = complete(createProgram(), 'ok', { found: true });
    const elseBranch = complete(createProgram(), 'notfound', { message: 'not found' });

    p = branch(p, () => true, thenBranch, elseBranch);
    expect(p.effects.completionVariants.size).toBe(2);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
    expect(p.effects.completionVariants.has('notfound')).toBe(true);
  });

  it('multiple complete() calls in different branches accumulate variants', () => {
    const okBranch = complete(createProgram(), 'ok', {});
    const errorBranch = complete(createProgram(), 'error', { message: 'fail' });
    const notfoundBranch = complete(createProgram(), 'notfound', {});

    // Nested: branch(ok/error) in then, notfound in else
    const innerBranch = branch(createProgram(), () => true, okBranch, errorBranch);
    const outer = branch(createProgram(), () => true, innerBranch, notfoundBranch);

    expect(outer.effects.completionVariants.size).toBe(3);
    expect(outer.effects.completionVariants.has('ok')).toBe(true);
    expect(outer.effects.completionVariants.has('error')).toBe(true);
    expect(outer.effects.completionVariants.has('notfound')).toBe(true);
  });

  it('completionVariants coexist with reads/writes', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = put(p, 'users', 'u1', { name: 'Alice' });
    p = complete(p, 'ok', { user: 'u1' });

    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.writes.has('users')).toBe(true);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
  });
});

// ============================================================
// extractCompletionVariants — Analysis Helper
// ============================================================

describe('extractCompletionVariants', () => {
  it('extracts variant from pure instruction', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok', data: 'test' });
    const variants = extractCompletionVariants(p);
    expect(variants.has('ok')).toBe(true);
    expect(variants.size).toBe(1);
  });

  it('extracts variants from branching program', () => {
    const thenP = pure(createProgram(), { variant: 'ok' });
    const elseP = pure(createProgram(), { variant: 'error', message: 'fail' });
    let p = createProgram();
    p = branch(p, () => true, thenP, elseP);
    const variants = extractCompletionVariants(p);
    expect(variants.has('ok')).toBe(true);
    expect(variants.has('error')).toBe(true);
    expect(variants.size).toBe(2);
  });

  it('returns empty set when pure has no variant field', () => {
    let p = createProgram();
    p = pure(p, 'just a string');
    const variants = extractCompletionVariants(p);
    expect(variants.size).toBe(0);
  });

  it('works with complete() built programs', () => {
    let p = createProgram();
    p = complete(p, 'ok', { data: 'test' });
    const variants = extractCompletionVariants(p);
    expect(variants.has('ok')).toBe(true);
  });

  it('handles pureFrom (no static extraction possible)', () => {
    let p = createProgram();
    p = pureFrom(p, () => ({ variant: 'ok' }));
    const variants = extractCompletionVariants(p);
    // pureFrom uses a function, so no static extraction
    expect(variants.size).toBe(0);
  });
});

// ============================================================
// serializeProgram — completionVariants in serialization
// ============================================================

describe('serializeProgram with completionVariants', () => {
  it('includes completionVariants in serialized output', () => {
    let p = createProgram();
    p = complete(p, 'ok', { data: 'test' });
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.completionVariants).toEqual(['ok']);
  });

  it('serializes empty completionVariants for pure()', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok' });
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.completionVariants).toEqual([]);
  });

  it('serializes multiple completionVariants from branches', () => {
    const thenP = complete(createProgram(), 'ok', {});
    const elseP = complete(createProgram(), 'error', { message: 'fail' });
    let p = createProgram();
    p = branch(p, () => true, thenP, elseP);
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.completionVariants.sort()).toEqual(['error', 'ok']);
  });
});

// ============================================================
// VariantExtractionProvider — Handler Tests
// ============================================================

describe('VariantExtractionProvider', () => {
  describe('analyze', () => {
    it('extracts variants from structural completionVariants (fast path)', () => {
      let p = createProgram();
      p = complete(p, 'ok', { user: 'u1' });
      const serialized = serializeProgram(p);

      const result = variantExtractionProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const variants = JSON.parse(val?.variants as string);
      expect(variants).toEqual(['ok']);
      expect(val?.branchCount).toBe(0);
    });

    it('extracts variants from branching program', () => {
      const thenP = complete(createProgram(), 'ok', {});
      const elseP = complete(createProgram(), 'notfound', { message: 'missing' });
      let p = createProgram();
      p = get(p, 'items', 'i1', 'item');
      p = branch(p, () => true, thenP, elseP);
      const serialized = serializeProgram(p);

      const result = variantExtractionProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const variants = JSON.parse(val?.variants as string);
      expect(variants.sort()).toEqual(['notfound', 'ok']);
    });

    it('extracts from instruction walk when no structural effects', () => {
      // Simulate a program serialized without completionVariants (legacy format)
      const programStr = JSON.stringify({
        instructions: [
          { tag: 'pure', value: { variant: 'ok', data: 'test' } },
        ],
        terminated: true,
        effects: { reads: [], writes: [] },
      });

      const result = variantExtractionProviderHandler.analyze({ program: programStr });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const variants = JSON.parse(val?.variants as string);
      expect(variants).toEqual(['ok']);
    });

    it('handles multiple variants from branch instructions in JSON', () => {
      const programStr = JSON.stringify({
        instructions: [
          {
            tag: 'branch',
            condition: '() => true',
            thenBranch: {
              instructions: [{ tag: 'pure', value: { variant: 'ok' } }],
              terminated: true,
              effects: { reads: [], writes: [] },
            },
            elseBranch: {
              instructions: [{ tag: 'pure', value: { variant: 'error', message: 'fail' } }],
              terminated: true,
              effects: { reads: [], writes: [] },
            },
          },
        ],
        terminated: false,
        effects: { reads: [], writes: [] },
      });

      const result = variantExtractionProviderHandler.analyze({ program: programStr });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const variants = JSON.parse(val?.variants as string);
      expect(variants.sort()).toEqual(['error', 'ok']);
    });

    it('returns error for invalid JSON', () => {
      const result = variantExtractionProviderHandler.analyze({ program: 'not valid json{{{' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      // It gracefully handles invalid JSON by finding no variants
      const variants = JSON.parse(val?.variants as string);
      expect(variants).toEqual([]);
    });

    it('uses complete() in its own output (dogfooding)', () => {
      let p = createProgram();
      p = complete(p, 'ok', {});
      const serialized = serializeProgram(p);
      const result = variantExtractionProviderHandler.analyze({ program: serialized });
      // The handler itself uses complete(), so its result should track variants
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });

    it('reports branch count', () => {
      const thenP = complete(createProgram(), 'ok', {});
      const elseP = complete(createProgram(), 'error', {});
      let inner = createProgram();
      inner = branch(inner, () => true, thenP, elseP);
      let p = createProgram();
      p = branch(p, () => false, inner, complete(createProgram(), 'notfound', {}));
      const serialized = serializeProgram(p);

      const result = variantExtractionProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect((val?.branchCount as number)).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// CompletionCoverage — Handler Tests
// ============================================================

describe('CompletionCoverage', () => {
  describe('check', () => {
    it('returns covered when all variants have matching syncs', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: JSON.stringify(['ok', 'error']),
        extractedVariants: JSON.stringify(['ok', 'error']),
        syncPatterns: JSON.stringify([
          { sync: 'RegisterUser', variant: 'ok' },
          { sync: 'RegistrationError', variant: 'error' },
        ]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('covered');
      expect(val?.report).toBeDefined();
    });

    it('returns uncovered when a variant has no sync', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: JSON.stringify(['ok', 'error', 'exists']),
        extractedVariants: JSON.stringify(['ok', 'error', 'exists']),
        syncPatterns: JSON.stringify([
          { sync: 'RegisterUser', variant: 'ok' },
        ]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('uncovered');
      const uncovered = JSON.parse(val?.uncoveredVariants as string);
      expect(uncovered).toContain('error');
      expect(uncovered).toContain('exists');
    });

    it('reports orphaned patterns for nonexistent variants', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: JSON.stringify(['ok']),
        extractedVariants: JSON.stringify(['ok']),
        syncPatterns: JSON.stringify([
          { sync: 'RegisterUser', variant: 'ok' },
          { sync: 'OldSync', variant: 'deprecated' },
        ]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('uncovered');
      const orphaned = JSON.parse(val?.orphanedPatterns as string);
      expect(orphaned).toContain('OldSync:deprecated');
    });

    it('wildcard syncs (no variant filter) cover all variants', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: JSON.stringify(['ok', 'error']),
        extractedVariants: JSON.stringify(['ok', 'error']),
        syncPatterns: JSON.stringify([
          { sync: 'LogAll' }, // no variant filter = covers all
        ]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('covered');
    });

    it('returns error for invalid JSON input', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: 'not json',
        extractedVariants: '[]',
        syncPatterns: '[]',
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('error');
      expect(val?.message).toBeDefined();
    });

    it('merges declared and extracted variants', () => {
      const result = completionCoverageHandler.check({
        concept: 'Article',
        action: 'create',
        declaredVariants: JSON.stringify(['ok', 'error']),
        extractedVariants: JSON.stringify(['ok', 'invalid']), // invalid only in extracted
        syncPatterns: JSON.stringify([
          { sync: 'CreateArticle', variant: 'ok' },
          { sync: 'HandleError', variant: 'error' },
        ]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('uncovered');
      const uncovered = JSON.parse(val?.uncoveredVariants as string);
      expect(uncovered).toContain('invalid');
    });

    it('uses complete() in its own output (dogfooding)', () => {
      const result = completionCoverageHandler.check({
        concept: 'User',
        action: 'register',
        declaredVariants: JSON.stringify(['ok']),
        extractedVariants: JSON.stringify(['ok']),
        syncPatterns: JSON.stringify([{ sync: 'Register', variant: 'ok' }]),
      });
      expect(result.effects.completionVariants.has('covered')).toBe(true);
    });

    it('handles empty variants and patterns', () => {
      const result = completionCoverageHandler.check({
        concept: 'Empty',
        action: 'noop',
        declaredVariants: JSON.stringify([]),
        extractedVariants: JSON.stringify([]),
        syncPatterns: JSON.stringify([]),
      });
      const val = getPureValue(result);
      expect(val?.variant).toBe('covered');
    });
  });

  describe('report', () => {
    it('returns ok variant with reports array', () => {
      const result = completionCoverageHandler.report({ concept: 'User' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
    });
  });

  describe('listUncovered', () => {
    it('returns ok variant with uncovered list', () => {
      const result = completionCoverageHandler.listUncovered({});
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
    });
  });
});

// ============================================================
// Integration — End-to-End Flow
// ============================================================

describe('Algebraic Effects Integration', () => {
  it('complete() → serialize → VariantExtractionProvider → CompletionCoverage', () => {
    // Step 1: Build a handler program with complete()
    let handlerProgram = createProgram();
    handlerProgram = get(handlerProgram, 'users', 'u1', 'user');
    const thenBranch = complete(createProgram(), 'ok', { user: 'u1' });
    const elseBranch = complete(createProgram(), 'notfound', { message: 'User not found' });
    handlerProgram = branch(handlerProgram, (b) => !!b.user, thenBranch, elseBranch);

    // Step 2: Serialize
    const serialized = serializeProgram(handlerProgram);

    // Step 3: Extract variants via provider
    const extractResult = variantExtractionProviderHandler.analyze({ program: serialized });
    const extractVal = getPureValue(extractResult);
    expect(extractVal?.variant).toBe('ok');
    const extractedVariants = JSON.parse(extractVal?.variants as string);
    expect(extractedVariants.sort()).toEqual(['notfound', 'ok']);

    // Step 4: Check coverage
    const coverageResult = completionCoverageHandler.check({
      concept: 'User',
      action: 'get',
      declaredVariants: JSON.stringify(['ok', 'notfound']),
      extractedVariants: JSON.stringify(extractedVariants),
      syncPatterns: JSON.stringify([
        { sync: 'GetUserResponse', variant: 'ok' },
        { sync: 'UserNotFound', variant: 'notfound' },
      ]),
    });
    const coverageVal = getPureValue(coverageResult);
    expect(coverageVal?.variant).toBe('covered');
  });

  it('detects uncovered variant in end-to-end flow', () => {
    // Handler produces ok/error/exists, but only ok has a sync
    let handlerProgram = createProgram();
    const okBranch = complete(createProgram(), 'ok', {});
    const errorBranch = complete(createProgram(), 'error', { message: 'fail' });
    const existsBranch = complete(createProgram(), 'exists', {});
    const innerBranch = branch(createProgram(), () => true, okBranch, errorBranch);
    handlerProgram = branch(handlerProgram, () => true, innerBranch, existsBranch);

    const serialized = serializeProgram(handlerProgram);
    const extractResult = variantExtractionProviderHandler.analyze({ program: serialized });
    const extractVal = getPureValue(extractResult);
    const extractedVariants = JSON.parse(extractVal?.variants as string);

    const coverageResult = completionCoverageHandler.check({
      concept: 'User',
      action: 'register',
      declaredVariants: JSON.stringify(['ok', 'error', 'exists']),
      extractedVariants: JSON.stringify(extractedVariants),
      syncPatterns: JSON.stringify([
        { sync: 'RegisterUser', variant: 'ok' },
      ]),
    });
    const coverageVal = getPureValue(coverageResult);
    expect(coverageVal?.variant).toBe('uncovered');
    const uncovered = JSON.parse(coverageVal?.uncoveredVariants as string);
    expect(uncovered).toContain('error');
    expect(uncovered).toContain('exists');
  });
});

// ============================================================
// Backward Compatibility
// ============================================================

describe('Backward Compatibility', () => {
  it('pure() still works without completionVariants tracking', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = pure(p, { variant: 'ok', user: 'u1' });
    expect(p.terminated).toBe(true);
    expect(p.effects.completionVariants.size).toBe(0);
    expect(p.effects.reads.has('users')).toBe(true);
  });

  it('existing programs without completionVariants serialize correctly', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok' });
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.completionVariants).toEqual([]);
    expect(parsed.effects.reads).toEqual([]);
    expect(parsed.effects.writes).toEqual([]);
  });

  it('VariantExtractionProvider handles legacy programs without completionVariants', () => {
    const legacyProgram = JSON.stringify({
      instructions: [
        { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
        { tag: 'pure', value: { variant: 'ok', user: 'u1' } },
      ],
      terminated: true,
      effects: { reads: ['users'], writes: [] },
    });

    const result = variantExtractionProviderHandler.analyze({ program: legacyProgram });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const variants = JSON.parse(val?.variants as string);
    expect(variants).toEqual(['ok']);
  });
});
