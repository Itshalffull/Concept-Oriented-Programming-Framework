// ActionEntity — Action definition entity registration and introspection
// Registers concept actions with typed params and variants, traces to sync rules and implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ActionEntityStorage,
  ActionEntityRegisterInput,
  ActionEntityRegisterOutput,
  ActionEntityFindByConceptInput,
  ActionEntityFindByConceptOutput,
  ActionEntityTriggeringSyncsInput,
  ActionEntityTriggeringSyncsOutput,
  ActionEntityInvokingSyncsInput,
  ActionEntityInvokingSyncsOutput,
  ActionEntityImplementationsInput,
  ActionEntityImplementationsOutput,
  ActionEntityInterfaceExposuresInput,
  ActionEntityInterfaceExposuresOutput,
  ActionEntityGetInput,
  ActionEntityGetOutput,
} from './types.js';

import {
  registerOk,
  findByConceptOk,
  triggeringSyncsOk,
  invokingSyncsOk,
  implementationsOk,
  interfaceExposuresOk,
  getOk,
  getNotfound,
} from './types.js';

export interface ActionEntityError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): ActionEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const actionKey = (concept: string, name: string): string =>
  `action_${concept}_${name}`;

export interface ActionEntityHandler {
  readonly register: (
    input: ActionEntityRegisterInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityRegisterOutput>;
  readonly findByConcept: (
    input: ActionEntityFindByConceptInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityFindByConceptOutput>;
  readonly triggeringSyncs: (
    input: ActionEntityTriggeringSyncsInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityTriggeringSyncsOutput>;
  readonly invokingSyncs: (
    input: ActionEntityInvokingSyncsInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityInvokingSyncsOutput>;
  readonly implementations: (
    input: ActionEntityImplementationsInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityImplementationsOutput>;
  readonly interfaceExposures: (
    input: ActionEntityInterfaceExposuresInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityInterfaceExposuresOutput>;
  readonly get: (
    input: ActionEntityGetInput,
    storage: ActionEntityStorage,
  ) => TE.TaskEither<ActionEntityError, ActionEntityGetOutput>;
}

// --- Implementation ---

export const actionEntityHandler: ActionEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = actionKey(input.concept, input.name);
          const variants: readonly string[] = input.variantRefs
            ? JSON.parse(input.variantRefs)
            : [];
          await storage.put('action_entity', key, {
            id: key,
            concept: input.concept,
            name: input.name,
            params: input.params,
            variantRefs: input.variantRefs,
            variantCount: variants.length,
            createdAt: new Date().toISOString(),
          });
          return registerOk(key);
        },
        storageError,
      ),
    ),

  findByConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('action_entity', { concept: input.concept });
          const actions = records.map((r) => ({
            id: String(r['id']),
            name: String(r['name']),
            variantCount: Number(r['variantCount'] ?? 0),
          }));
          return findByConceptOk(JSON.stringify(actions));
        },
        storageError,
      ),
    ),

  triggeringSyncs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find sync rules that are triggered by this action
          const syncs = await storage.find('sync_trigger', { action: input.action });
          const results = syncs.map((s) => ({
            syncId: String(s['syncId'] ?? s['id']),
            trigger: String(s['trigger'] ?? 'when'),
          }));
          return triggeringSyncsOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  invokingSyncs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find sync rules whose effects invoke this action
          const syncs = await storage.find('sync_effect', { action: input.action });
          const results = syncs.map((s) => ({
            syncId: String(s['syncId'] ?? s['id']),
            effect: String(s['effect'] ?? 'then'),
          }));
          return invokingSyncsOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  implementations: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const impls = await storage.find('implementation', { action: input.action });
          const symbols = impls.map((r) => String(r['symbol'] ?? r['id']));
          return implementationsOk(JSON.stringify(symbols));
        },
        storageError,
      ),
    ),

  interfaceExposures: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const exposures = await storage.find('interface_exposure', { action: input.action });
          const results = exposures.map((r) => ({
            interface: String(r['interface'] ?? r['id']),
            method: String(r['method'] ?? ''),
          }));
          return interfaceExposuresOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('action_entity', input.action),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['concept']),
                  String(found['name']),
                  String(found['params']),
                  Number(found['variantCount'] ?? 0),
                ),
              ),
          ),
        ),
      ),
    ),
};
