// SyncEntity — Sync rule entity registration and chain analysis
// Registers sync rules with triggers/guards/effects, detects dead ends and orphan variants.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncEntityStorage,
  SyncEntityRegisterInput,
  SyncEntityRegisterOutput,
  SyncEntityFindByConceptInput,
  SyncEntityFindByConceptOutput,
  SyncEntityFindTriggerableByInput,
  SyncEntityFindTriggerableByOutput,
  SyncEntityChainFromInput,
  SyncEntityChainFromOutput,
  SyncEntityFindDeadEndsInput,
  SyncEntityFindDeadEndsOutput,
  SyncEntityFindOrphanVariantsInput,
  SyncEntityFindOrphanVariantsOutput,
  SyncEntityGetInput,
  SyncEntityGetOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  findByConceptOk,
  findTriggerableByOk,
  chainFromOk,
  chainFromNoChain,
  findDeadEndsOk,
  findOrphanVariantsOk,
  getOk,
  getNotfound,
} from './types.js';

export interface SyncEntityError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SyncEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse compiled sync spec to extract when/then counts and annotations. */
const parseSyncSpec = (compiled: string): {
  readonly whenPatternCount: number;
  readonly thenActionCount: number;
  readonly annotations: string;
  readonly tier: string;
} => {
  try {
    const parsed = JSON.parse(compiled);
    return {
      whenPatternCount: Array.isArray(parsed.when) ? parsed.when.length : 0,
      thenActionCount: Array.isArray(parsed.then) ? parsed.then.length : 0,
      annotations: JSON.stringify(parsed.annotations ?? {}),
      tier: String(parsed.tier ?? 'default'),
    };
  } catch {
    return { whenPatternCount: 0, thenActionCount: 0, annotations: '{}', tier: 'default' };
  }
};

export interface SyncEntityHandler {
  readonly register: (
    input: SyncEntityRegisterInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityRegisterOutput>;
  readonly findByConcept: (
    input: SyncEntityFindByConceptInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityFindByConceptOutput>;
  readonly findTriggerableBy: (
    input: SyncEntityFindTriggerableByInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityFindTriggerableByOutput>;
  readonly chainFrom: (
    input: SyncEntityChainFromInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityChainFromOutput>;
  readonly findDeadEnds: (
    input: SyncEntityFindDeadEndsInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityFindDeadEndsOutput>;
  readonly findOrphanVariants: (
    input: SyncEntityFindOrphanVariantsInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityFindOrphanVariantsOutput>;
  readonly get: (
    input: SyncEntityGetInput,
    storage: SyncEntityStorage,
  ) => TE.TaskEither<SyncEntityError, SyncEntityGetOutput>;
}

// --- Implementation ---

export const syncEntityHandler: SyncEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_entity', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const spec = parseSyncSpec(input.compiled);
                  await storage.put('sync_entity', input.name, {
                    name: input.name,
                    source: input.source,
                    compiled: input.compiled,
                    whenPatternCount: spec.whenPatternCount,
                    thenActionCount: spec.thenActionCount,
                    annotations: spec.annotations,
                    tier: spec.tier,
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

  findByConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('sync_entity');
          // A sync belongs to a concept if its compiled spec references the concept
          const matching = all.filter((r) => {
            const compiled = String(r['compiled'] ?? '');
            return compiled.includes(input.concept);
          });
          const syncs = matching.map((r) => ({
            name: String(r['name']),
            tier: String(r['tier'] ?? 'default'),
          }));
          return findByConceptOk(JSON.stringify(syncs));
        },
        storageError,
      ),
    ),

  findTriggerableBy: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('sync_entity');
          const matching = all.filter((r) => {
            const compiled = String(r['compiled'] ?? '');
            try {
              const parsed = JSON.parse(compiled);
              const whenClauses = Array.isArray(parsed.when) ? parsed.when : [];
              return whenClauses.some(
                (w: Record<string, unknown>) =>
                  String(w['action']) === input.action &&
                  String(w['variant']) === input.variant,
              );
            } catch {
              return false;
            }
          });
          const syncs = matching.map((r) => String(r['name']));
          return findTriggerableByOk(JSON.stringify(syncs));
        },
        storageError,
      ),
    ),

  chainFrom: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const visited = new Set<string>();
          const chain: string[] = [];
          let currentAction = input.action;
          let currentVariant = input.variant;
          let depth = 0;

          while (depth < input.depth) {
            const key = `${currentAction}:${currentVariant}`;
            if (visited.has(key)) break;
            visited.add(key);

            const all = await storage.find('sync_entity');
            const triggered = all.find((r) => {
              const compiled = String(r['compiled'] ?? '');
              try {
                const parsed = JSON.parse(compiled);
                return (parsed.when ?? []).some(
                  (w: Record<string, unknown>) =>
                    String(w['action']) === currentAction &&
                    String(w['variant']) === currentVariant,
                );
              } catch {
                return false;
              }
            });

            if (!triggered) break;

            chain.push(String(triggered['name']));
            // Follow the chain by looking at the then-clause actions
            try {
              const parsed = JSON.parse(String(triggered['compiled']));
              const thenClauses = Array.isArray(parsed.then) ? parsed.then : [];
              if (thenClauses.length === 0) break;
              currentAction = String(thenClauses[0]['action'] ?? '');
              currentVariant = String(thenClauses[0]['variant'] ?? '');
            } catch {
              break;
            }
            depth++;
          }

          if (chain.length === 0) {
            return chainFromNoChain();
          }
          return chainFromOk(JSON.stringify(chain));
        },
        storageError,
      ),
    ),

  findDeadEnds: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('sync_entity');
          // A dead end is a sync whose then-clause actions are never triggered by any other sync
          const deadEnds = all.filter((r) => {
            const thenCount = Number(r['thenActionCount'] ?? 0);
            return thenCount === 0;
          });
          const names = deadEnds.map((r) => String(r['name']));
          return findDeadEndsOk(JSON.stringify(names));
        },
        storageError,
      ),
    ),

  findOrphanVariants: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('sync_entity');
          // Collect all variant references from when-clauses
          const referencedVariants = new Set<string>();
          const declaredVariants = new Set<string>();

          for (const r of all) {
            try {
              const parsed = JSON.parse(String(r['compiled'] ?? ''));
              for (const w of parsed.when ?? []) {
                referencedVariants.add(String(w['variant']));
              }
              for (const t of parsed.then ?? []) {
                declaredVariants.add(String(t['variant']));
              }
            } catch {
              // skip unparseable
            }
          }

          // Orphan variants are declared but never referenced as triggers
          const orphans = [...declaredVariants].filter((v) => !referencedVariants.has(v));
          return findOrphanVariantsOk(JSON.stringify(orphans));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sync_entity', input.sync),
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
                  String(found['name']),
                  String(found['name']),
                  String(found['annotations'] ?? '{}'),
                  String(found['tier'] ?? 'default'),
                  Number(found['whenPatternCount'] ?? 0),
                  Number(found['thenActionCount'] ?? 0),
                ),
              ),
          ),
        ),
      ),
    ),
};
