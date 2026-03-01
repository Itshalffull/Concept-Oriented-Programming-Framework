// Taxonomy — Hierarchical classification with multiple vocabularies,
// terms organized in tree structures, and entity classification.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TaxonomyStorage,
  TaxonomyCreateVocabularyInput,
  TaxonomyCreateVocabularyOutput,
  TaxonomyAddTermInput,
  TaxonomyAddTermOutput,
  TaxonomySetParentInput,
  TaxonomySetParentOutput,
  TaxonomyTagEntityInput,
  TaxonomyTagEntityOutput,
  TaxonomyUntagEntityInput,
  TaxonomyUntagEntityOutput,
} from './types.js';

import {
  createVocabularyOk,
  createVocabularyExists,
  addTermOk,
  addTermNotfound,
  setParentOk,
  setParentNotfound,
  tagEntityOk,
  tagEntityNotfound,
  untagEntityOk,
  untagEntityNotfound,
} from './types.js';

export interface TaxonomyError {
  readonly code: string;
  readonly message: string;
}

const toTaxonomyError = (error: unknown): TaxonomyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface TaxonomyHandler {
  readonly createVocabulary: (
    input: TaxonomyCreateVocabularyInput,
    storage: TaxonomyStorage,
  ) => TE.TaskEither<TaxonomyError, TaxonomyCreateVocabularyOutput>;
  readonly addTerm: (
    input: TaxonomyAddTermInput,
    storage: TaxonomyStorage,
  ) => TE.TaskEither<TaxonomyError, TaxonomyAddTermOutput>;
  readonly setParent: (
    input: TaxonomySetParentInput,
    storage: TaxonomyStorage,
  ) => TE.TaskEither<TaxonomyError, TaxonomySetParentOutput>;
  readonly tagEntity: (
    input: TaxonomyTagEntityInput,
    storage: TaxonomyStorage,
  ) => TE.TaskEither<TaxonomyError, TaxonomyTagEntityOutput>;
  readonly untagEntity: (
    input: TaxonomyUntagEntityInput,
    storage: TaxonomyStorage,
  ) => TE.TaskEither<TaxonomyError, TaxonomyUntagEntityOutput>;
}

// --- Implementation ---

export const taxonomyHandler: TaxonomyHandler = {
  // Create a new vocabulary. Returns 'exists' if the vocabulary ID is already taken.
  createVocabulary: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('vocabulary', input.vocab),
        toTaxonomyError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('vocabulary', input.vocab, {
                    vocab: input.vocab,
                    name: input.name,
                    createdAt: new Date().toISOString(),
                  });
                  return createVocabularyOk();
                },
                toTaxonomyError,
              ),
            () =>
              TE.right<TaxonomyError, TaxonomyCreateVocabularyOutput>(
                createVocabularyExists(`Vocabulary '${input.vocab}' already exists`),
              ),
          ),
        ),
      ),
    ),

  // Add a term to a vocabulary. The parent field (Option) controls hierarchy placement.
  // Returns notfound if the vocabulary does not exist.
  addTerm: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('vocabulary', input.vocab),
        toTaxonomyError,
      ),
      TE.chain((vocab) =>
        pipe(
          O.fromNullable(vocab),
          O.fold(
            () =>
              TE.right<TaxonomyError, TaxonomyAddTermOutput>(
                addTermNotfound(`Vocabulary '${input.vocab}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  const termKey = `${input.vocab}:${input.term}`;
                  const parentValue = pipe(
                    input.parent,
                    O.fold(() => null, (p) => p),
                  );
                  await storage.put('term', termKey, {
                    vocab: input.vocab,
                    term: input.term,
                    parent: parentValue,
                  });
                  return addTermOk();
                },
                toTaxonomyError,
              ),
          ),
        ),
      ),
    ),

  // Reparent a term within its vocabulary. Returns notfound if term does not exist.
  setParent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('term', `${input.vocab}:${input.term}`),
        toTaxonomyError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<TaxonomyError, TaxonomySetParentOutput>(
                setParentNotfound(`Term '${input.term}' not found in vocabulary '${input.vocab}'`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('term', `${input.vocab}:${input.term}`, {
                    ...existing,
                    parent: input.parent,
                  });
                  return setParentOk();
                },
                toTaxonomyError,
              ),
          ),
        ),
      ),
    ),

  // Classify an entity under a vocabulary term. Returns notfound if term is missing.
  tagEntity: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('term', `${input.vocab}:${input.term}`),
        toTaxonomyError,
      ),
      TE.chain((term) =>
        pipe(
          O.fromNullable(term),
          O.fold(
            () =>
              TE.right<TaxonomyError, TaxonomyTagEntityOutput>(
                tagEntityNotfound(`Term '${input.term}' not found in vocabulary '${input.vocab}'`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  const tagKey = `${input.entity}:${input.vocab}:${input.term}`;
                  await storage.put('entity_term', tagKey, {
                    entity: input.entity,
                    vocab: input.vocab,
                    term: input.term,
                  });
                  return tagEntityOk();
                },
                toTaxonomyError,
              ),
          ),
        ),
      ),
    ),

  // Remove a classification from an entity. Returns notfound if the association is missing.
  untagEntity: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const tagKey = `${input.entity}:${input.vocab}:${input.term}`;
          return storage.get('entity_term', tagKey);
        },
        toTaxonomyError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<TaxonomyError, TaxonomyUntagEntityOutput>(
                untagEntityNotfound(
                  `Entity '${input.entity}' is not tagged with '${input.term}' in '${input.vocab}'`,
                ),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  const tagKey = `${input.entity}:${input.vocab}:${input.term}`;
                  await storage.delete('entity_term', tagKey);
                  return untagEntityOk();
                },
                toTaxonomyError,
              ),
          ),
        ),
      ),
    ),
};
