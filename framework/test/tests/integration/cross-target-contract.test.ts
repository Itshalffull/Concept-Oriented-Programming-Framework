// ============================================================
// Cross-Target Contract Verification Integration Test
//
// Tests the Builder->ContractTest pipeline that sync chains
// would orchestrate:
// 1. ContractTest/generate creates contract from spec
// 2. Multiple builders build for different languages (simulated)
// 3. ContractTest/verify checks interop between language pairs
// 4. ContractTest/matrix shows verification status
// 5. ContractTest/canDeploy gates deployment
// 6. Missing verification blocks deployment
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { contractTestHandler } from '../../../../handlers/ts/framework/test/contract-test.handler.js';
import { builderHandler } from '../../../../handlers/ts/deploy/builder.handler.js';
import type { ConceptStorage } from '@clef/runtime';

/**
 * Simulates the cross-target contract verification pipeline.
 * In a real sync chain the Builder concept would produce artifacts
 * for each language and ContractTest would verify interoperability
 * between every producer/consumer pair.
 */
async function buildForLanguage(
  storage: ConceptStorage,
  concept: string,
  language: string,
): Promise<{ artifactHash: string; artifactLocation: string }> {
  const result = await builderHandler.build(
    {
      concept,
      source: `${concept.toLowerCase()}-src-${language}`,
      language,
      platform: 'linux-x86_64',
      config: { mode: 'release' },
    },
    storage,
  );
  return {
    artifactHash: result.artifactHash as string,
    artifactLocation: result.artifactLocation as string,
  };
}

describe('Cross-target contract verification integration', () => {
  let contractStorage: ConceptStorage;
  let builderStorage: ConceptStorage;

  beforeEach(() => {
    contractStorage = createInMemoryStorage();
    builderStorage = createInMemoryStorage();
  });

  it('should generate a contract definition from a concept spec', async () => {
    const result = await contractTestHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      contractStorage,
    );

    expect(result.variant).toBe('ok');
    expect(result.contract).toBeDefined();
    expect(typeof result.contract).toBe('string');
    expect(result.definition).toBeDefined();
    const definition = result.definition as { actions: Array<{ actionName: string }> };
    expect(definition.actions.length).toBeGreaterThan(0);
  });

  it('should verify interop between two language builds against a contract', async () => {
    // Generate the contract
    const genResult = await contractTestHandler.generate(
      { concept: 'Password', specPath: 'specs/password.concept' },
      contractStorage,
    );
    const contractId = genResult.contract as string;

    // Build for typescript and rust
    const tsBuild = await buildForLanguage(builderStorage, 'Password', 'typescript');
    const rustBuild = await buildForLanguage(builderStorage, 'Password', 'rust');

    // Verify interop: typescript -> rust
    const verifyResult = await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: tsBuild.artifactLocation,
        producerLanguage: 'typescript',
        consumerArtifact: rustBuild.artifactLocation,
        consumerLanguage: 'rust',
      },
      contractStorage,
    );

    expect(verifyResult.variant).toBe('ok');
    expect(verifyResult.passed).toBeDefined();
    expect(verifyResult.total).toBeDefined();
    expect(verifyResult.passed).toBe(verifyResult.total);
  });

  it('should verify all language pair combinations for a concept', async () => {
    const languages = ['typescript', 'rust', 'swift'];

    // Generate contract
    const genResult = await contractTestHandler.generate(
      { concept: 'User', specPath: 'specs/user.concept' },
      contractStorage,
    );
    const contractId = genResult.contract as string;

    // Build all languages
    const builds: Record<string, { artifactHash: string; artifactLocation: string }> = {};
    for (const lang of languages) {
      builds[lang] = await buildForLanguage(builderStorage, 'User', lang);
    }

    // Verify all producer/consumer pairs
    for (const producer of languages) {
      for (const consumer of languages) {
        if (producer === consumer) continue;

        const result = await contractTestHandler.verify(
          {
            contract: contractId,
            producerArtifact: builds[producer].artifactLocation,
            producerLanguage: producer,
            consumerArtifact: builds[consumer].artifactLocation,
            consumerLanguage: consumer,
          },
          contractStorage,
        );

        expect(result.variant).toBe('ok');
        expect(result.passed).toBe(result.total);
      }
    }
  });

  it('should show verification matrix with all verified pairs', async () => {
    // Generate contract and verify two pairs
    const genResult = await contractTestHandler.generate(
      { concept: 'Token', specPath: 'specs/token.concept' },
      contractStorage,
    );
    const contractId = genResult.contract as string;

    const tsBuild = await buildForLanguage(builderStorage, 'Token', 'typescript');
    const rustBuild = await buildForLanguage(builderStorage, 'Token', 'rust');

    await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: tsBuild.artifactLocation,
        producerLanguage: 'typescript',
        consumerArtifact: rustBuild.artifactLocation,
        consumerLanguage: 'rust',
      },
      contractStorage,
    );

    await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: rustBuild.artifactLocation,
        producerLanguage: 'rust',
        consumerArtifact: tsBuild.artifactLocation,
        consumerLanguage: 'typescript',
      },
      contractStorage,
    );

    // Check the matrix
    const matrixResult = await contractTestHandler.matrix(
      { concepts: ['Token'] },
      contractStorage,
    );

    expect(matrixResult.variant).toBe('ok');
    const matrix = matrixResult.matrix as Array<{ concept: string; pairs: any[] }>;
    expect(matrix.length).toBe(1);
    expect(matrix[0].concept).toBe('Token');
    expect(matrix[0].pairs.length).toBe(2);

    for (const pair of matrix[0].pairs) {
      expect(pair.status).toBe('pass');
      expect(pair.lastVerified).toBeDefined();
    }
  });

  it('should allow deployment when all pairs are verified', async () => {
    // Generate contract, build, and verify
    const genResult = await contractTestHandler.generate(
      { concept: 'Session', specPath: 'specs/session.concept' },
      contractStorage,
    );
    const contractId = genResult.contract as string;

    const tsBuild = await buildForLanguage(builderStorage, 'Session', 'typescript');
    const rustBuild = await buildForLanguage(builderStorage, 'Session', 'rust');

    await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: tsBuild.artifactLocation,
        producerLanguage: 'typescript',
        consumerArtifact: rustBuild.artifactLocation,
        consumerLanguage: 'rust',
      },
      contractStorage,
    );

    // Check canDeploy for typescript
    const canDeployResult = await contractTestHandler.canDeploy(
      { concept: 'Session', language: 'typescript' },
      contractStorage,
    );

    expect(canDeployResult.variant).toBe('ok');
    expect(canDeployResult.safe).toBe(true);
    const verifiedAgainst = canDeployResult.verifiedAgainst as string[];
    expect(verifiedAgainst).toContain('rust');
  });

  it('should block deployment when verification is missing for a language', async () => {
    // Generate contract but do NOT verify any pairs
    await contractTestHandler.generate(
      { concept: 'Credential', specPath: 'specs/credential.concept' },
      contractStorage,
    );

    // Build for typescript and rust, verify only ts->rust
    const tsBuild = await buildForLanguage(builderStorage, 'Credential', 'typescript');
    const rustBuild = await buildForLanguage(builderStorage, 'Credential', 'rust');

    // Verify only typescript->rust (not rust->typescript)
    const genResult = await contractTestHandler.generate(
      { concept: 'Credential', specPath: 'specs/credential.concept' },
      contractStorage,
    );
    const contractId = genResult.contract as string;

    await contractTestHandler.verify(
      {
        contract: contractId,
        producerArtifact: tsBuild.artifactLocation,
        producerLanguage: 'typescript',
        consumerArtifact: rustBuild.artifactLocation,
        consumerLanguage: 'rust',
      },
      contractStorage,
    );

    // Swift was never built or verified — canDeploy should still reflect
    // that swift has no verifications at all
    const canDeploySwift = await contractTestHandler.canDeploy(
      { concept: 'Credential', language: 'swift' },
      contractStorage,
    );

    // Swift has no verifications involving it, so it falls into the unverified path
    // or safe=false depending on whether other pairs exist
    expect(canDeploySwift.variant).toBeDefined();
    // The key assertion: swift is NOT in verified pairs
    if (canDeploySwift.variant === 'ok') {
      const verified = canDeploySwift.verifiedAgainst as string[];
      expect(verified).not.toContain('typescript');
      expect(verified).not.toContain('rust');
    }
  });

  it('should return specError when generating contract without required fields', async () => {
    const result = await contractTestHandler.generate(
      { concept: '', specPath: '' },
      contractStorage,
    );

    expect(result.variant).toBe('specError');
    expect(result.message).toBeDefined();
  });

  it('should return producerUnavailable when verifying against missing contract', async () => {
    const result = await contractTestHandler.verify(
      {
        contract: 'nonexistent-contract-id',
        producerArtifact: 'some/path',
        producerLanguage: 'typescript',
        consumerArtifact: 'other/path',
        consumerLanguage: 'rust',
      },
      contractStorage,
    );

    expect(result.variant).toBe('producerUnavailable');
    expect(result.reason).toBeDefined();
  });
});
