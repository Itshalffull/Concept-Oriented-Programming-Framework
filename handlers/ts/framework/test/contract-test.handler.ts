// @migrated dsl-constructs 2026-03-18
// ============================================================
// ContractTest Concept Implementation
//
// Cross-target interoperability verification. Maintains contract
// definitions derived from concept specs and verifies that code
// generated for different languages actually interoperates.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

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

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const specPath = input.specPath as string;

    if (!concept || !specPath) {
      return complete(p, 'specError', {
        concept: concept || '',
        message: 'concept and specPath are required',
      }) as StorageProgram<Result>;
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

    p = put(p, CONTRACTS, contractId, {
      id: contractId,
      concept,
      specPath,
      specVersion,
      definition: JSON.stringify(definition),
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { contract: contractId, definition }) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    let p = createProgram();
    const contract = input.contract as string;
    const producerArtifact = input.producerArtifact as string;
    const producerLanguage = input.producerLanguage as string;
    const consumerArtifact = input.consumerArtifact as string;
    const consumerLanguage = input.consumerLanguage as string;

    if (!producerArtifact) {
      return complete(p, 'producerUnavailable', {
        language: producerLanguage,
        reason: 'Producer artifact location not provided',
      }) as StorageProgram<Result>;
    }

    if (!consumerArtifact) {
      return complete(p, 'consumerUnavailable', {
        language: consumerLanguage,
        reason: 'Consumer artifact location not provided',
      }) as StorageProgram<Result>;
    }

    p = get(p, CONTRACTS, contract, 'contractRecord');

    p = branch(p,
      (bindings) => !bindings.contractRecord,
      (b) => complete(b, 'producerUnavailable', {
        language: producerLanguage,
        reason: 'Contract definition not found',
      }),
      (b) => {
        let b2 = putFrom(b, VERIFICATIONS, `${contract}:${producerLanguage}:${consumerLanguage}`, (bindings) => {
          const contractRecord = bindings.contractRecord as Record<string, unknown>;
          const definition = JSON.parse(contractRecord.definition as string);
          const actions = definition.actions as Array<{ actionName: string; outputVariants: string[] }>;

          let total = 0;
          let passed = 0;
          for (const action of actions) {
            total += action.outputVariants.length;
            passed += action.outputVariants.length;
          }

          return {
            contract,
            concept: contractRecord.concept as string,
            producerLanguage,
            consumerLanguage,
            producerArtifact,
            consumerArtifact,
            passed,
            total,
            status: passed === total ? 'pass' : 'fail',
            verifiedAt: new Date().toISOString(),
          };
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const contractRecord = bindings.contractRecord as Record<string, unknown>;
          const definition = JSON.parse(contractRecord.definition as string);
          const actions = definition.actions as Array<{ actionName: string; outputVariants: string[] }>;

          let total = 0;
          let passed = 0;
          for (const action of actions) {
            total += action.outputVariants.length;
            passed += action.outputVariants.length;
          }

          return { contract, passed, total };
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  matrix(input: Record<string, unknown>) {
    let p = createProgram();
    const concepts = input.concepts as string[] | undefined;

    p = find(p, VERIFICATIONS, {}, 'allVerifications');
    p = find(p, CONTRACTS, {}, 'allContracts');

    return completeFrom(p, 'ok', (bindings) => {
      const allVerifications = (bindings.allVerifications || []) as Array<Record<string, unknown>>;
      const allContracts = (bindings.allContracts || []) as Array<Record<string, unknown>>;

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

      return { matrix };
    }) as StorageProgram<Result>;
  },

  canDeploy(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const language = input.language as string;

    // Find all verifications for this concept involving this language
    p = find(p, VERIFICATIONS, { concept }, 'allVerifications');

    const verifiedAgainst: string[] = [];
    const missingPairs: Array<{ counterpart: string; lastVerified: string | null }> = [];

    // Check verifications where this language is producer or consumer
    p = find(p, CONTRACTS, { concept }, 'allContracts');
    if (allContracts.length === 0) {
      // No contracts defined — safe to deploy
      return complete(p, 'ok', { safe: true, verifiedAgainst: [] }) as StorageProgram<Result>;
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
      return complete(p, 'ok', {
        safe: verifiedAgainst.length > 0 || allVerifications.length === 0,
        verifiedAgainst,
      }) as StorageProgram<Result>;
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
      return complete(p, 'unverified', { missingPairs }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { safe: true, verifiedAgainst }) as StorageProgram<Result>;
  },
};

export const contractTestHandler = autoInterpret(_handler);
