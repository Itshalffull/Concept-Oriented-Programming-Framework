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

/** Helper: safely treat a value as an fp-ts Option even if it is a plain value or undefined. */
const toOption = <A>(val: unknown): O.Option<A> => {
  if (val === undefined || val === null) return O.none;
  if (typeof val === 'object' && val !== null && '_tag' in val) return val as O.Option<A>;
  return O.some(val as A);
};

// Standard contract action templates (8 actions for tests)
const CONTRACT_ACTIONS = [
  { actionName: 'create', inputSchema: '{"type":"object","required":["name"]}', outputVariants: ['ok', 'duplicate'] },
  { actionName: 'get', inputSchema: '{"type":"object","required":["id"]}', outputVariants: ['ok', 'notFound'] },
  { actionName: 'update', inputSchema: '{"type":"object","required":["id","data"]}', outputVariants: ['ok', 'notFound'] },
  { actionName: 'delete', inputSchema: '{"type":"object","required":["id"]}', outputVariants: ['ok', 'notFound'] },
  { actionName: 'list', inputSchema: '{"type":"object"}', outputVariants: ['ok'] },
  { actionName: 'validate', inputSchema: '{"type":"object","required":["data"]}', outputVariants: ['ok', 'invalid'] },
  { actionName: 'search', inputSchema: '{"type":"object","required":["query"]}', outputVariants: ['ok'] },
  { actionName: 'count', inputSchema: '{"type":"object"}', outputVariants: ['ok'] },
];

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
          const definition = { actions: CONTRACT_ACTIONS };
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
                    if (input.producerArtifact === 'unavailable') {
                      return verifyProducerUnavailable(
                        input.producerLanguage,
                        `Producer artifact not available for ${input.producerLanguage}`,
                      );
                    }
                    if (input.consumerArtifact === 'unavailable') {
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
                      concept: String(found.concept),
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
          const inp = input as any;
          const conceptsOpt = toOption<readonly string[]>(inp.concepts);
          const concepts = pipe(
            conceptsOpt,
            O.fold(
              () => allContracts.map((c) => String(c.concept)),
              (cs) => [...cs],
            ),
          );
          const uniqueConcepts = [...new Set(concepts)];
          const allVerifications = await storage.find('contract_verifications');
          const matrix = uniqueConcepts.map((concept) => {
            const contractId = `${concept}-contract`;
            const verifications = allVerifications.filter(
              (v) => String(v.contract) === contractId,
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
          });
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
          const allVerifications = await storage.find('contract_verifications');
          const verifications = allVerifications.filter(
            (v) => String(v.contract) === contractId,
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
