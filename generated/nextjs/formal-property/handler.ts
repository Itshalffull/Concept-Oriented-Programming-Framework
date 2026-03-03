// FormalProperty — handler.ts
// Formal property definition, verification, and coverage tracking.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FormalPropertyStorage,
  FormalPropertyDefineInput,
  FormalPropertyDefineOutput,
  FormalPropertyProveInput,
  FormalPropertyProveOutput,
  FormalPropertyRefuteInput,
  FormalPropertyRefuteOutput,
  FormalPropertyCheckInput,
  FormalPropertyCheckOutput,
  FormalPropertySynthesizeInput,
  FormalPropertySynthesizeOutput,
  FormalPropertyCoverageInput,
  FormalPropertyCoverageOutput,
  FormalPropertyListInput,
  FormalPropertyListOutput,
  FormalPropertyInvalidateInput,
  FormalPropertyInvalidateOutput,
} from './types.js';

import {
  defineOk,
  defineInvalid,
  proveOk,
  proveNotfound,
  refuteOk,
  refuteNotfound,
  checkOk,
  checkTimeout,
  checkUnknown,
  synthesizeOk,
  synthesizeInvalid,
  coverageOk,
  listOk,
  invalidateOk,
  invalidateNotfound,
} from './types.js';

export interface FormalPropertyError {
  readonly code: string;
  readonly message: string;
}

export interface FormalPropertyHandler {
  readonly define: (
    input: FormalPropertyDefineInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyDefineOutput>;
  readonly prove: (
    input: FormalPropertyProveInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyProveOutput>;
  readonly refute: (
    input: FormalPropertyRefuteInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyRefuteOutput>;
  readonly check: (
    input: FormalPropertyCheckInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyCheckOutput>;
  readonly synthesize: (
    input: FormalPropertySynthesizeInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertySynthesizeOutput>;
  readonly coverage: (
    input: FormalPropertyCoverageInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyCoverageOutput>;
  readonly list: (
    input: FormalPropertyListInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyListOutput>;
  readonly invalidate: (
    input: FormalPropertyInvalidateInput,
    storage: FormalPropertyStorage,
  ) => TE.TaskEither<FormalPropertyError, FormalPropertyInvalidateOutput>;
}

const storageErr = (error: unknown): FormalPropertyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const formalPropertyHandler: FormalPropertyHandler = {
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Generate a deterministic property ID
          const allProps = await storage.find('formalproperty');
          const count = allProps.length;
          const propertyId = `prop-${count + 1}`;

          await storage.put('formalproperty', propertyId, {
            property: propertyId,
            target_symbol: input.target_symbol,
            kind: input.kind,
            property_text: input.property_text,
            formal_language: input.formal_language,
            scope: input.scope,
            priority: input.priority,
            status: 'defined',
            createdAt: new Date().toISOString(),
          });
          return defineOk(propertyId);
        },
        storageErr,
      ),
    ),

  prove: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('formalproperty', input.property);
          if (record === null) {
            return proveNotfound(`Property '${input.property}' not found`);
          }
          await storage.put('formalproperty', input.property, {
            ...record,
            status: 'proved',
            evidence_ref: input.evidence_ref,
          });
          return proveOk(input.property, input.evidence_ref);
        },
        storageErr,
      ),
    ),

  refute: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('formalproperty', input.property);
          if (record === null) {
            return refuteNotfound(`Property '${input.property}' not found`);
          }
          await storage.put('formalproperty', input.property, {
            ...record,
            status: 'refuted',
            evidence_ref: input.evidence_ref,
          });
          return refuteOk(input.property, input.evidence_ref);
        },
        storageErr,
      ),
    ),

  check: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('formalproperty', input.property);
          if (record === null) {
            return checkUnknown(input.property);
          }
          // Simulate proof checking — mark as 'proved' for well-formed properties
          const status = String((record as any).status ?? 'defined');
          if (status === 'defined') {
            // Auto-prove: update status to proved
            await storage.put('formalproperty', input.property, {
              ...record,
              status: 'proved',
              checkedAt: new Date().toISOString(),
              solver: input.solver,
            });
            return checkOk(input.property, 'proved');
          }
          return checkOk(input.property, status);
        },
        storageErr,
      ),
    ),

  synthesize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.put('formalproperty_synth', input.target_symbol, {
            target_symbol: input.target_symbol,
            intent_ref: input.intent_ref,
          });
          return synthesizeOk([]);
        },
        storageErr,
      ),
    ),

  coverage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find all properties for this target symbol
          const allProps = await storage.find('formalproperty');
          const matching = allProps.filter(
            (p) => String((p as any).target_symbol ?? '') === input.target_symbol,
          );

          const total = matching.length;
          let proved = 0;
          let refuted = 0;
          let unknown = 0;
          let timeout = 0;

          for (const prop of matching) {
            const status = String((prop as any).status ?? 'defined');
            switch (status) {
              case 'proved':
                proved++;
                break;
              case 'refuted':
                refuted++;
                break;
              case 'timeout':
                timeout++;
                break;
              default:
                unknown++;
                break;
            }
          }

          const coveragePct = total > 0 ? Math.round((proved / total) * 100) : 0;

          return coverageOk(total, proved, refuted, unknown, timeout, coveragePct);
        },
        storageErr,
      ),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('formalproperty');
          return listOk(records.map((r) => String((r as any).property ?? '')));
        },
        storageErr,
      ),
    ),

  invalidate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('formalproperty', input.property),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(invalidateNotfound(`${input.property} not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('formalproperty', input.property);
                  return invalidateOk();
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
