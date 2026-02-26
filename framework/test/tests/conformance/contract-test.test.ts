// ============================================================
// ContractTest Conformance Tests
//
// Validates cross-target interoperability verification: generating
// contract definitions from concept specs, verifying producer-
// consumer compatibility, building a contract matrix, and checking
// deployment safety across language pairs.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { contractTestHandler } from '../../implementations/typescript/contract-test.impl.js';
import type { ConceptStorage } from '@clef/runtime';

describe('ContractTest conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- generate: ok ---

  it('should generate a contract definition with actions from a valid spec', async () => {
    const result = await contractTestHandler.generate(
      {
        concept: 'Password',
        specPath: 'specs/password.concept',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.contract).toBeDefined();
    expect(typeof result.contract).toBe('string');
    expect(result.definition).toBeDefined();
    const definition = result.definition as any;
    expect(definition.actions).toBeDefined();
    expect(Array.isArray(definition.actions)).toBe(true);
    expect(definition.actions.length).toBeGreaterThan(0);
    for (const action of definition.actions) {
      expect(action.actionName).toBeDefined();
      expect(typeof action.actionName).toBe('string');
      expect(action.outputVariants).toBeDefined();
      expect(Array.isArray(action.outputVariants)).toBe(true);
    }
  });

  it('should produce deterministic contract ids for the same concept and specPath', async () => {
    const first = await contractTestHandler.generate(
      { concept: 'Token', specPath: 'specs/token.concept' },
      storage,
    );
    const second = await contractTestHandler.generate(
      { concept: 'Token', specPath: 'specs/token.concept' },
      storage,
    );
    expect(first.variant).toBe('ok');
    expect(second.variant).toBe('ok');
    expect(first.contract).toBe(second.contract);
  });

  // --- generate: specError ---

  it('should return specError when concept is missing', async () => {
    const result = await contractTestHandler.generate(
      { concept: '', specPath: 'specs/empty.concept' },
      storage,
    );
    expect(result.variant).toBe('specError');
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe('string');
  });

  it('should return specError when specPath is missing', async () => {
    const result = await contractTestHandler.generate(
      { concept: 'Session', specPath: '' },
      storage,
    );
    expect(result.variant).toBe('specError');
    expect(result.message).toBeDefined();
  });

  // --- verify: ok ---

  it('should verify contract compatibility between producer and consumer', async () => {
    const genResult = await contractTestHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    expect(genResult.variant).toBe('ok');
    const contractId = genResult.contract as string;

    const result = await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: 'dist/password.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/password_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.contract).toBe(contractId);
    expect(typeof result.passed).toBe('number');
    expect(typeof result.total).toBe('number');
    expect(result.passed).toBe(result.total);
    expect(result.passed).toBeGreaterThan(0);
  });

  // --- verify: producerUnavailable ---

  it('should return producerUnavailable when contract does not exist', async () => {
    const result = await contractTestHandler.verify(
      {
        contract: 'nonexistent-contract',
        producerArtifact: 'dist/missing.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/missing.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );
    expect(result.variant).toBe('producerUnavailable');
    expect(result.language).toBe('typescript');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  it('should return producerUnavailable when producer artifact is missing', async () => {
    const genResult = await contractTestHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    const contractId = genResult.contract as string;

    const result = await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: '',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/user_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );
    expect(result.variant).toBe('producerUnavailable');
    expect(result.language).toBe('typescript');
  });

  // --- verify: consumerUnavailable ---

  it('should return consumerUnavailable when consumer artifact is missing', async () => {
    const genResult = await contractTestHandler.generate(
      { concept: 'Session', specPath: 'specs/session.concept' },
      storage,
    );
    const contractId = genResult.contract as string;

    const result = await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: 'dist/session.js',
        producerLanguage: 'typescript',
        consumerArtifact: '',
        consumerLanguage: 'rust',
      },
      storage,
    );
    expect(result.variant).toBe('consumerUnavailable');
    expect(result.language).toBe('rust');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  // --- matrix ---

  it('should produce a contract matrix across concepts and language pairs', async () => {
    // Generate and verify Password: typescript -> rust
    const pwGen = await contractTestHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    await contractTestHandler.verify(
      {
        contract: pwGen.contract as string,
        producerArtifact: 'dist/password.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/password_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );

    // Generate and verify User: typescript -> swift
    const userGen = await contractTestHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    await contractTestHandler.verify(
      {
        contract: userGen.contract as string,
        producerArtifact: 'dist/user.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/user_consumer.swift',
        consumerLanguage: 'swift',
      },
      storage,
    );

    const result = await contractTestHandler.matrix({}, storage);
    expect(result.variant).toBe('ok');
    const matrix = result.matrix as any[];
    expect(matrix.length).toBeGreaterThanOrEqual(2);

    for (const entry of matrix) {
      expect(entry.concept).toBeDefined();
      expect(entry.pairs).toBeDefined();
      expect(Array.isArray(entry.pairs)).toBe(true);
    }
  });

  it('should filter matrix by concept names when provided', async () => {
    const pwGen = await contractTestHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      storage,
    );
    await contractTestHandler.verify(
      {
        contract: pwGen.contract as string,
        producerArtifact: 'dist/password.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/password_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );

    const userGen = await contractTestHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      storage,
    );
    await contractTestHandler.verify(
      {
        contract: userGen.contract as string,
        producerArtifact: 'dist/user.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/user_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );

    const result = await contractTestHandler.matrix(
      { concepts: ['Password'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const matrix = result.matrix as any[];
    expect(matrix).toHaveLength(1);
    expect(matrix[0].concept).toBe('Password');
  });

  // --- canDeploy: ok ---

  it('should return safe deployment when contracts are verified', async () => {
    const genResult = await contractTestHandler.generate(
      { concept: 'Token', specPath: 'specs/token.concept' },
      storage,
    );
    await contractTestHandler.verify(
      {
        contract: genResult.contract as string,
        producerArtifact: 'dist/token.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/token_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );

    const result = await contractTestHandler.canDeploy(
      { concept: 'Token', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.safe).toBe(true);
    expect(result.verifiedAgainst).toBeDefined();
    const verifiedAgainst = result.verifiedAgainst as string[];
    expect(verifiedAgainst).toContain('rust');
  });

  it('should return safe when no contracts are defined for the concept', async () => {
    const result = await contractTestHandler.canDeploy(
      { concept: 'UnknownConcept', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.safe).toBe(true);
  });

  // --- canDeploy: unverified ---

  it('should return unverified when language pair has failing verification', async () => {
    // Generate a contract
    const genResult = await contractTestHandler.generate(
      { concept: 'Audit', specPath: 'specs/audit.concept' },
      storage,
    );

    // Verify typescript -> rust (passes)
    await contractTestHandler.verify(
      {
        contract: genResult.contract as string,
        producerArtifact: 'dist/audit.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/audit_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );

    // Check canDeploy for swift (which has no verifications)
    const result = await contractTestHandler.canDeploy(
      { concept: 'Audit', language: 'swift' },
      storage,
    );
    expect(result.variant).toBe('unverified');
    expect(result.missingPairs).toBeDefined();
    const missing = result.missingPairs as any[];
    expect(missing.length).toBeGreaterThan(0);
    for (const pair of missing) {
      expect(pair.counterpart).toBeDefined();
      expect(typeof pair.counterpart).toBe('string');
    }
  });

  // --- invariant: generate->ok then verify->ok then canDeploy->ok ---

  it('should allow safe deployment after generating and verifying a contract', async () => {
    // Generate
    const genResult = await contractTestHandler.generate(
      { concept: 'Session', specPath: 'specs/session.concept' },
      storage,
    );
    expect(genResult.variant).toBe('ok');
    const contractId = genResult.contract as string;

    // Verify
    const verifyResult = await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: 'dist/session.js',
        producerLanguage: 'typescript',
        consumerArtifact: 'dist/session_consumer.rs',
        consumerLanguage: 'rust',
      },
      storage,
    );
    expect(verifyResult.variant).toBe('ok');

    // canDeploy should be safe
    const canDeployResult = await contractTestHandler.canDeploy(
      { concept: 'Session', language: 'typescript' },
      storage,
    );
    expect(canDeployResult.variant).toBe('ok');
    expect(canDeployResult.safe).toBe(true);
    const verifiedAgainst = canDeployResult.verifiedAgainst as string[];
    expect(verifiedAgainst).toContain('rust');
  });
});
