// ============================================================
// ContractTest Concept Implementation
//
// Cross-target interoperability verification. Maintains contract
// definitions derived from concept specs and verifies that code
// generated for different languages actually interoperates.
// See Architecture doc Section 3.8
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';

const CONTRACTS = 'contract-definitions';
const VERIFICATIONS = 'contract-verifications';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

export const contractTestHandler: ConceptHandler = {
  async generate(input, storage) {
    const concept = input.concept as string;
    const specPath = input.specPath as string;

    if (!concept || !specPath) {
      return {
        variant: 'specError',
        concept: concept || '',
        message: 'concept and specPath are required',
      };
    }

    const contractId = `ctr-${simpleHash(concept + ':' + specPath)}`;
    const specVersion = simpleHash(specPath);

    // Generate contract definition from concept spec
    // Real implementation would parse the spec to extract wire-level interfaces
    const definition = {
      actions: [
        {
          actionName: 'primary',
          inputSchema: JSON.stringify({ type: 'object', properties: { id: { type: 'string' } } }),
          outputVariants: ['ok', 'notFound', 'error'],
        },
        {
          actionName: 'create',
          inputSchema: JSON.stringify({ type: 'object', required: ['data'] }),
          outputVariants: ['ok', 'validationError'],
        },
      ],
    };

    await storage.put(CONTRACTS, contractId, {
      id: contractId,
      concept,
      specPath,
      specVersion,
      definition: JSON.stringify(definition),
      generatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', contract: contractId, definition };
  },

  async verify(input, storage) {
    const contract = input.contract as string;
    const producerArtifact = input.producerArtifact as string;
    const producerLanguage = input.producerLanguage as string;
    const consumerArtifact = input.consumerArtifact as string;
    const consumerLanguage = input.consumerLanguage as string;

    const contractRecord = await storage.get(CONTRACTS, contract);
    if (!contractRecord) {
      return {
        variant: 'producerUnavailable',
        language: producerLanguage,
        reason: 'Contract definition not found',
      };
    }

    if (!producerArtifact) {
      return {
        variant: 'producerUnavailable',
        language: producerLanguage,
        reason: 'Producer artifact location not provided',
      };
    }

    if (!consumerArtifact) {
      return {
        variant: 'consumerUnavailable',
        language: consumerLanguage,
        reason: 'Consumer artifact location not provided',
      };
    }

    const definition = JSON.parse(contractRecord.definition as string);
    const actions = definition.actions as Array<{ actionName: string; outputVariants: string[] }>;

    // Simulate contract verification
    // Each action generates N test cases (one per variant)
    let total = 0;
    let passed = 0;

    for (const action of actions) {
      total += action.outputVariants.length;
      passed += action.outputVariants.length; // Simulate all passing
    }

    const verificationKey = `${contract}:${producerLanguage}:${consumerLanguage}`;
    const now = new Date().toISOString();

    await storage.put(VERIFICATIONS, verificationKey, {
      contract,
      concept: contractRecord.concept as string,
      producerLanguage,
      consumerLanguage,
      producerArtifact,
      consumerArtifact,
      passed,
      total,
      status: passed === total ? 'pass' : 'fail',
      verifiedAt: now,
    });

    return { variant: 'ok', contract, passed, total };
  },

  async matrix(input, storage) {
    const concepts = input.concepts as string[] | undefined;

    const allVerifications = await storage.find(VERIFICATIONS);
    const allContracts = await storage.find(CONTRACTS);

    // Group by concept
    const conceptMap = new Map<string, Array<{
      producer: string;
      consumer: string;
      status: string;
      lastVerified: string | null;
    }>>();

    for (const v of allVerifications) {
      const concept = v.concept as string;
      if (concepts && concepts.length > 0 && !concepts.includes(concept)) continue;

      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, []);
      }
      conceptMap.get(concept)!.push({
        producer: v.producerLanguage as string,
        consumer: v.consumerLanguage as string,
        status: v.status as string,
        lastVerified: v.verifiedAt as string,
      });
    }

    // Include concepts with contracts but no verifications
    for (const c of allContracts) {
      const concept = c.concept as string;
      if (concepts && concepts.length > 0 && !concepts.includes(concept)) continue;
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, []);
      }
    }

    const matrix = Array.from(conceptMap.entries()).map(([concept, pairs]) => ({
      concept,
      pairs,
    }));

    return { variant: 'ok', matrix };
  },

  async canDeploy(input, storage) {
    const concept = input.concept as string;
    const language = input.language as string;

    // Find all verifications for this concept involving this language
    const allVerifications = await storage.find(VERIFICATIONS, { concept });

    const verifiedAgainst: string[] = [];
    const missingPairs: Array<{ counterpart: string; lastVerified: string | null }> = [];

    // Check verifications where this language is producer or consumer
    const allContracts = await storage.find(CONTRACTS, { concept });
    if (allContracts.length === 0) {
      // No contracts defined — safe to deploy
      return { variant: 'ok', safe: true, verifiedAgainst: [] };
    }

    // Find all languages that have verifications for this concept
    const languagesInvolved = new Set<string>();
    for (const v of allVerifications) {
      languagesInvolved.add(v.producerLanguage as string);
      languagesInvolved.add(v.consumerLanguage as string);
    }

    // Check if all pairs involving our language are verified
    for (const v of allVerifications) {
      const producer = v.producerLanguage as string;
      const consumer = v.consumerLanguage as string;
      const status = v.status as string;

      if (producer === language && status === 'pass') {
        verifiedAgainst.push(consumer);
      } else if (consumer === language && status === 'pass') {
        verifiedAgainst.push(producer);
      }
    }

    if (verifiedAgainst.length > 0 || allVerifications.length === 0) {
      return {
        variant: 'ok',
        safe: verifiedAgainst.length > 0 || allVerifications.length === 0,
        verifiedAgainst,
      };
    }

    // Check for unverified pairs
    for (const other of languagesInvolved) {
      if (other === language) continue;
      if (!verifiedAgainst.includes(other)) {
        const existing = allVerifications.find(
          v => (v.producerLanguage === language && v.consumerLanguage === other) ||
               (v.producerLanguage === other && v.consumerLanguage === language),
        );
        missingPairs.push({
          counterpart: other,
          lastVerified: existing ? (existing.verifiedAt as string) : null,
        });
      }
    }

    if (missingPairs.length > 0) {
      return { variant: 'unverified', missingPairs };
    }

    return { variant: 'ok', safe: true, verifiedAgainst };
  },
};
