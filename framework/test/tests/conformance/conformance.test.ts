// ============================================================
// Conformance Conformance Tests
//
// Validates spec-to-implementation conformance verification:
// generating test suites from concept specs, verifying generated
// code against those suites, registering deviations, producing
// a conformance matrix, and tracing requirements to tests.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { conformanceHandler } from '../../implementations/typescript/conformance.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Conformance conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- generate: ok ---

  it('should generate a test suite with vectors from a valid concept spec', async () => {
    const result = await conformanceHandler.generate(
      {
        concept: 'Password',
        specPath: 'specs/password.concept',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.suite).toBeDefined();
    expect(typeof result.suite).toBe('string');
    expect(result.testVectors).toBeDefined();
    const vectors = result.testVectors as any[];
    expect(vectors.length).toBeGreaterThan(0);
    for (const tv of vectors) {
      expect(tv.id).toBeDefined();
      expect(tv.description).toBeDefined();
      expect(tv.input).toBeDefined();
      expect(tv.expectedOutput).toBeDefined();
    }
  });

  it('should produce deterministic suite ids for the same concept and specPath', async () => {
    const first = await conformanceHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    const second = await conformanceHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    expect(first.variant).toBe('ok');
    expect(second.variant).toBe('ok');
    expect(first.suite).toBe(second.suite);
  });

  // --- generate: specError ---

  it('should return specError when concept is missing', async () => {
    const result = await conformanceHandler.generate(
      { concept: '', specPath: 'specs/empty.concept' },
      storage,
    );
    expect(result.variant).toBe('specError');
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe('string');
  });

  it('should return specError when specPath is missing', async () => {
    const result = await conformanceHandler.generate(
      { concept: 'Token', specPath: '' },
      storage,
    );
    expect(result.variant).toBe('specError');
    expect(result.message).toBeDefined();
  });

  // --- verify: ok ---

  it('should verify all vectors pass and return coverage data', async () => {
    const genResult = await conformanceHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    expect(genResult.variant).toBe('ok');
    const suiteId = genResult.suite as string;

    const result = await conformanceHandler.verify(
      {
        suite: suiteId,
        language: 'typescript',
        artifactLocation: 'dist/password.js',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.total).toBe('number');
    expect(result.passed).toBe(result.total);
    expect(result.coveredRequirements).toBeDefined();
    const covered = result.coveredRequirements as string[];
    expect(covered.length).toBeGreaterThan(0);
  });

  // --- verify: failure ---

  it('should return failure when suite does not exist', async () => {
    const result = await conformanceHandler.verify(
      {
        suite: 'nonexistent-suite',
        language: 'typescript',
        artifactLocation: 'dist/missing.js',
      },
      storage,
    );
    expect(result.variant).toBe('failure');
    expect(result.failures).toBeDefined();
    const failures = result.failures as any[];
    expect(failures.length).toBeGreaterThan(0);
  });

  // --- registerDeviation ---

  it('should register a deviation for a concept-language-requirement triple', async () => {
    // Generate suite first so it exists
    await conformanceHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );

    const result = await conformanceHandler.registerDeviation(
      {
        concept: 'Password',
        language: 'rust',
        requirement: 'req-Password-001',
        reason: 'Rust borrow checker prevents direct translation',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.suite).toBeDefined();
  });

  it('should exclude deviated requirements from subsequent verification', async () => {
    const genResult = await conformanceHandler.generate(
      { concept: 'Session', specPath: 'specs/session.concept' },
      storage,
    );
    const suiteId = genResult.suite as string;

    // Register a deviation for one requirement
    await conformanceHandler.registerDeviation(
      {
        concept: 'Session',
        language: 'rust',
        requirement: 'req-Session-001',
        reason: 'Platform limitation',
      },
      storage,
    );

    // Verify -- deviated requirement should be excluded from covered
    const result = await conformanceHandler.verify(
      {
        suite: suiteId,
        language: 'rust',
        artifactLocation: 'dist/session.rs',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const covered = result.coveredRequirements as string[];
    expect(covered).not.toContain('req-Session-001');
  });

  // --- matrix: ok ---

  it('should produce a conformance matrix across concepts and languages', async () => {
    // Generate and verify for Password/typescript
    const pwGen = await conformanceHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    await conformanceHandler.verify(
      {
        suite: pwGen.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/password.js',
      },
      storage,
    );

    // Generate and verify for User/typescript
    const userGen = await conformanceHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    await conformanceHandler.verify(
      {
        suite: userGen.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/user.js',
      },
      storage,
    );

    const result = await conformanceHandler.matrix({}, storage);
    expect(result.variant).toBe('ok');
    const matrix = result.matrix as any[];
    expect(matrix.length).toBeGreaterThanOrEqual(2);

    for (const entry of matrix) {
      expect(entry.concept).toBeDefined();
      expect(entry.targets).toBeDefined();
    }
  });

  it('should filter matrix by concept names when provided', async () => {
    const pwGen = await conformanceHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    await conformanceHandler.verify(
      {
        suite: pwGen.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/password.js',
      },
      storage,
    );

    const userGen = await conformanceHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    await conformanceHandler.verify(
      {
        suite: userGen.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/user.js',
      },
      storage,
    );

    const result = await conformanceHandler.matrix(
      { concepts: ['Password'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matrix = result.matrix as any[];
    expect(matrix).toHaveLength(1);
    expect(matrix[0].concept).toBe('Password');
  });

  // --- traceability ---

  it('should trace requirements to test results per language', async () => {
    const genResult = await conformanceHandler.generate(
      { concept: 'Token', specPath: 'specs/token.concept' },
      storage,
    );
    await conformanceHandler.verify(
      {
        suite: genResult.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/token.js',
      },
      storage,
    );

    const result = await conformanceHandler.traceability(
      { concept: 'Token' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const requirements = result.requirements as any[];
    expect(requirements.length).toBeGreaterThan(0);
    for (const req of requirements) {
      expect(req.id).toBeDefined();
      expect(req.description).toBeDefined();
      expect(req.testedBy).toBeDefined();
      expect(Array.isArray(req.testedBy)).toBe(true);
    }
  });

  it('should return empty requirements for an unknown concept', async () => {
    const result = await conformanceHandler.traceability(
      { concept: 'NonexistentConcept' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const requirements = result.requirements as any[];
    expect(requirements).toHaveLength(0);
  });

  // --- invariant: generate->ok then verify->ok then matrix->ok ---

  it('should reflect verified conformance in the matrix after generate and verify', async () => {
    // Generate
    const genResult = await conformanceHandler.generate(
      { concept: 'Audit', specPath: 'specs/audit.concept' },
      storage,
    );
    expect(genResult.variant).toBe('ok');

    // Verify
    const verifyResult = await conformanceHandler.verify(
      {
        suite: genResult.suite as string,
        language: 'typescript',
        artifactLocation: 'dist/audit.js',
      },
      storage,
    );
    expect(verifyResult.variant).toBe('ok');

    // Matrix should include this concept with full conformance
    const matrixResult = await conformanceHandler.matrix(
      { concepts: ['Audit'] },
      storage,
    );
    expect(matrixResult.variant).toBe('ok');
    const matrix = matrixResult.matrix as any[];
    expect(matrix).toHaveLength(1);
    expect(matrix[0].concept).toBe('Audit');
    expect(matrix[0].targets.length).toBeGreaterThanOrEqual(1);

    const tsTarget = matrix[0].targets.find((t: any) => t.language === 'typescript');
    expect(tsTarget).toBeDefined();
    expect(tsTarget.conformance).toBe('full');
  });
});
