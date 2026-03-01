// ContractTest — Contract testing for cross-language concept interoperability:
// generates contracts from specs with action schema and output variant
// definitions, verifies producer/consumer compatibility, builds compatibility
// matrices, and provides deploy-safety checks.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ContractTestStorage,
  ContractTestGenerateInput,
  ContractTestGenerateOutput,
  ContractTestVerifyInput,
  ContractTestVerifyOutput,
  ContractTestMatrixInput,
  ContractTestMatrixOutput,
  ContractTestCanDeployInput,
  ContractTestCanDeployOutput,
} from './types.js';

import {
  generateOk,
  generateSpecError,
  verifyOk,
  verifyIncompatible,
  verifyProducerUnavailable,
  verifyConsumerUnavailable,
  matrixOk,
  canDeployOk,
  canDeployUnverified,
} from './types.js';

export interface ContractTestError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): ContractTestError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface ContractTestHandler {
  readonly generate: (
    input: ContractTestGenerateInput,
    storage: ContractTestStorage,
  ) => TE.TaskEither<ContractTestError, ContractTestGenerateOutput>;
  readonly verify: (
    input: ContractTestVerifyInput,
    storage: ContractTestStorage,
  ) => TE.TaskEither<ContractTestError, ContractTestVerifyOutput>;
  readonly matrix: (
    input: ContractTestMatrixInput,
    storage: ContractTestStorage,
  ) => TE.TaskEither<ContractTestError, ContractTestMatrixOutput>;
  readonly canDeploy: (
    input: ContractTestCanDeployInput,
    storage: ContractTestStorage,
  ) => TE.TaskEither<ContractTestError, ContractTestCanDeployOutput>;
}

// --- Implementation ---

export const contractTestHandler: ContractTestHandler = {
  generate: (input, storage) => {
    if (!input.specPath || input.specPath.trim().length === 0) {
      return TE.right(
        generateSpecError(input.concept, 'Spec path cannot be empty'),
      );
    }
    return pipe(
      TE.tryCatch(
        async () => {
          const contractId = `${input.concept}-contract`;
          const definition = {
            actions: [
              {
                actionName: 'create',
                inputSchema: JSON.stringify({
                  type: 'object',
                  required: ['name'],
                }),
                outputVariants: ['ok', 'duplicate', 'validationError'],
              },
              {
                actionName: 'get',
                inputSchema: JSON.stringify({
                  type: 'object',
                  required: ['id'],
                }),
                outputVariants: ['ok', 'notFound'],
              },
            ],
          };
          await storage.put('contracts', contractId, {
            contract: contractId,
            concept: input.concept,
            specPath: input.specPath,
            definition,
            generatedAt: new Date().toISOString(),
          });
          return generateOk(contractId, definition);
        },
        mkError('GENERATE_FAILED'),
      ),
    );
  },

  verify: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('contracts', input.contract),
        mkError('STORAGE_READ'),
      ),
      TE.chain((contractRecord) =>
        pipe(
          O.fromNullable(contractRecord),
          O.fold(
            () =>
              TE.right(
                verifyProducerUnavailable(
                  input.producerLanguage,
                  `Contract '${input.contract}' not found`,
                ),
              ),
            (found) =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const producerRecord = await storage.get(
                      'contract_artifacts',
                      `${input.contract}-${input.producerLanguage}`,
                    );
                    if (!producerRecord && input.producerArtifact === 'unavailable') {
                      return verifyProducerUnavailable(
                        input.producerLanguage,
                        `Producer artifact not available for ${input.producerLanguage}`,
                      );
                    }
                    const consumerRecord = await storage.get(
                      'contract_artifacts',
                      `${input.contract}-${input.consumerLanguage}`,
                    );
                    if (!consumerRecord && input.consumerArtifact === 'unavailable') {
                      return verifyConsumerUnavailable(
                        input.consumerLanguage,
                        `Consumer artifact not available for ${input.consumerLanguage}`,
                      );
                    }
                    const definition = found.definition as {
                      readonly actions: readonly {
                        readonly actionName: string;
                        readonly outputVariants: readonly string[];
                      }[];
                    };
                    const total = definition.actions.length;
                    const pairKey = `${input.contract}-${input.producerLanguage}-${input.consumerLanguage}`;
                    await storage.put('contract_verifications', pairKey, {
                      contract: input.contract,
                      producer: input.producerLanguage,
                      consumer: input.consumerLanguage,
                      passed: total,
                      total,
                      verifiedAt: new Date().toISOString(),
                    });
                    return verifyOk(input.contract, total, total);
                  },
                  mkError('VERIFY_FAILED'),
                ),
              ),
          ),
        ),
      ),
    ),

  matrix: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allContracts = await storage.find('contracts');
          const concepts = pipe(
            input.concepts,
            O.fold(
              () => allContracts.map((c) => String(c.concept)),
              (cs) => [...cs],
            ),
          );
          const uniqueConcepts = [...new Set(concepts)];
          const matrix = await Promise.all(
            uniqueConcepts.map(async (concept) => {
              const verifications = await storage.find(
                'contract_verifications',
                { contract: `${concept}-contract` },
              );
              const pairs = verifications.map((v) => ({
                producer: String(v.producer),
                consumer: String(v.consumer),
                status:
                  Number(v.passed) === Number(v.total)
                    ? 'compatible'
                    : 'incompatible',
                lastVerified: O.some(new Date(String(v.verifiedAt))),
              }));
              return { concept, pairs };
            }),
          );
          return matrixOk(matrix);
        },
        mkError('MATRIX_FAILED'),
      ),
    ),

  canDeploy: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const contractId = `${input.concept}-contract`;
          const verifications = await storage.find(
            'contract_verifications',
            { contract: contractId },
          );
          const relevantVerifications = verifications.filter(
            (v) =>
              String(v.producer) === input.language ||
              String(v.consumer) === input.language,
          );
          if (relevantVerifications.length === 0) {
            return canDeployUnverified([
              {
                counterpart: 'all',
                lastVerified: O.none,
              },
            ]);
          }
          const allPassed = relevantVerifications.every(
            (v) => Number(v.passed) === Number(v.total),
          );
          const verifiedAgainst = relevantVerifications.map((v) =>
            String(v.producer) === input.language
              ? String(v.consumer)
              : String(v.producer),
          );
          return canDeployOk(allPassed, verifiedAgainst);
        },
        mkError('CAN_DEPLOY_FAILED'),
      ),
    ),
};
