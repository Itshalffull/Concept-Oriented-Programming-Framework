// ConceptEntity — Concept definition entity with state, actions, and invariants
// Registers concept definitions, queries by capability/suite, checks compatibility.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ConceptEntityStorage,
  ConceptEntityRegisterInput,
  ConceptEntityRegisterOutput,
  ConceptEntityGetInput,
  ConceptEntityGetOutput,
  ConceptEntityFindByCapabilityInput,
  ConceptEntityFindByCapabilityOutput,
  ConceptEntityFindByKitInput,
  ConceptEntityFindByKitOutput,
  ConceptEntityGeneratedArtifactsInput,
  ConceptEntityGeneratedArtifactsOutput,
  ConceptEntityParticipatingSyncsInput,
  ConceptEntityParticipatingSyncsOutput,
  ConceptEntityCheckCompatibilityInput,
  ConceptEntityCheckCompatibilityOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  getOk,
  getNotfound,
  findByCapabilityOk,
  findByKitOk,
  generatedArtifactsOk,
  participatingSyncsOk,
  checkCompatibilityCompatible,
  checkCompatibilityIncompatible,
} from './types.js';

export interface ConceptEntityError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): ConceptEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Extract type parameters from a concept AST string for compatibility checking. */
const extractTypeParams = (ast: string): readonly string[] => {
  try {
    const parsed = JSON.parse(ast);
    return Array.isArray(parsed.typeParams) ? parsed.typeParams : [];
  } catch {
    return [];
  }
};

export interface ConceptEntityHandler {
  readonly register: (
    input: ConceptEntityRegisterInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityRegisterOutput>;
  readonly get: (
    input: ConceptEntityGetInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityGetOutput>;
  readonly findByCapability: (
    input: ConceptEntityFindByCapabilityInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityFindByCapabilityOutput>;
  readonly findByKit: (
    input: ConceptEntityFindByKitInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityFindByKitOutput>;
  readonly generatedArtifacts: (
    input: ConceptEntityGeneratedArtifactsInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityGeneratedArtifactsOutput>;
  readonly participatingSyncs: (
    input: ConceptEntityParticipatingSyncsInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityParticipatingSyncsOutput>;
  readonly checkCompatibility: (
    input: ConceptEntityCheckCompatibilityInput,
    storage: ConceptEntityStorage,
  ) => TE.TaskEither<ConceptEntityError, ConceptEntityCheckCompatibilityOutput>;
}

// --- Implementation ---

export const conceptEntityHandler: ConceptEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('concept_entity', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('concept_entity', input.name, {
                    name: input.name,
                    source: input.source,
                    ast: input.ast,
                    typeParams: JSON.stringify(extractTypeParams(input.ast)),
                    createdAt: new Date().toISOString(),
                  });
                  return registerOk(input.name);
                },
                storageError,
              ),
            (found) => TE.right(registerAlreadyRegistered(String(found['name']))),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('concept_entity', input.name),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) => TE.right(getOk(String(found['name']))),
          ),
        ),
      ),
    ),

  findByCapability: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('concept_entity');
          // A concept provides a capability if its AST references it
          const matching = records.filter((r) => {
            const ast = String(r['ast'] ?? '');
            return ast.includes(input.capability);
          });
          const names = matching.map((r) => String(r['name']));
          return findByCapabilityOk(JSON.stringify(names));
        },
        storageError,
      ),
    ),

  findByKit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('concept_entity', { kit: input.kit });
          const names = records.map((r) => String(r['name']));
          return findByKitOk(JSON.stringify(names));
        },
        storageError,
      ),
    ),

  generatedArtifacts: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const artifacts = await storage.find('generated_artifact', { concept: input.entity });
          const results = artifacts.map((r) => ({
            file: String(r['file'] ?? r['id']),
            language: String(r['language'] ?? 'unknown'),
            kind: String(r['kind'] ?? 'handler'),
          }));
          return generatedArtifactsOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  participatingSyncs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const syncs = await storage.find('sync_participant', { concept: input.entity });
          const results = syncs.map((r) => ({
            syncId: String(r['syncId'] ?? r['id']),
            role: String(r['role'] ?? 'participant'),
          }));
          return participatingSyncsOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  checkCompatibility: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entityA = await storage.get('concept_entity', input.a);
          const entityB = await storage.get('concept_entity', input.b);
          if (!entityA || !entityB) {
            return checkCompatibilityIncompatible(
              `Concept ${!entityA ? input.a : input.b} not found`,
            );
          }
          const paramsA = extractTypeParams(String(entityA['ast']));
          const paramsB = extractTypeParams(String(entityB['ast']));
          // Concepts are compatible if they share at least one type parameter
          // or if neither uses type parameters
          const shared = paramsA.filter((p) => paramsB.includes(p));
          if (paramsA.length === 0 && paramsB.length === 0) {
            return checkCompatibilityCompatible(JSON.stringify([]));
          }
          if (shared.length > 0 || paramsA.length === 0 || paramsB.length === 0) {
            return checkCompatibilityCompatible(JSON.stringify(shared));
          }
          return checkCompatibilityIncompatible(
            `No shared type parameters between ${input.a} and ${input.b}`,
          );
        },
        storageError,
      ),
    ),
};
