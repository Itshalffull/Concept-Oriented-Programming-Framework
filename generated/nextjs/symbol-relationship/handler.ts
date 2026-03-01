// SymbolRelationship — Directed relationships between symbols (extends, calls, uses)
// Supports adding typed edges, querying neighbors, and computing transitive closures.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SymbolRelationshipStorage,
  SymbolRelationshipAddInput,
  SymbolRelationshipAddOutput,
  SymbolRelationshipFindFromInput,
  SymbolRelationshipFindFromOutput,
  SymbolRelationshipFindToInput,
  SymbolRelationshipFindToOutput,
  SymbolRelationshipTransitiveClosureInput,
  SymbolRelationshipTransitiveClosureOutput,
  SymbolRelationshipGetInput,
  SymbolRelationshipGetOutput,
} from './types.js';

import {
  addOk,
  addAlreadyExists,
  findFromOk,
  findToOk,
  transitiveClosureOk,
  getOk,
  getNotfound,
} from './types.js';

export interface SymbolRelationshipError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): SymbolRelationshipError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const relationshipKey = (source: string, target: string, kind: string): string =>
  `rel_${source}_${kind}_${target}`;

export interface SymbolRelationshipHandler {
  readonly add: (
    input: SymbolRelationshipAddInput,
    storage: SymbolRelationshipStorage,
  ) => TE.TaskEither<SymbolRelationshipError, SymbolRelationshipAddOutput>;
  readonly findFrom: (
    input: SymbolRelationshipFindFromInput,
    storage: SymbolRelationshipStorage,
  ) => TE.TaskEither<SymbolRelationshipError, SymbolRelationshipFindFromOutput>;
  readonly findTo: (
    input: SymbolRelationshipFindToInput,
    storage: SymbolRelationshipStorage,
  ) => TE.TaskEither<SymbolRelationshipError, SymbolRelationshipFindToOutput>;
  readonly transitiveClosure: (
    input: SymbolRelationshipTransitiveClosureInput,
    storage: SymbolRelationshipStorage,
  ) => TE.TaskEither<SymbolRelationshipError, SymbolRelationshipTransitiveClosureOutput>;
  readonly get: (
    input: SymbolRelationshipGetInput,
    storage: SymbolRelationshipStorage,
  ) => TE.TaskEither<SymbolRelationshipError, SymbolRelationshipGetOutput>;
}

// --- Implementation ---

export const symbolRelationshipHandler: SymbolRelationshipHandler = {
  add: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('relationship', relationshipKey(input.source, input.target, input.kind)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const key = relationshipKey(input.source, input.target, input.kind);
                  await storage.put('relationship', key, {
                    id: key,
                    source: input.source,
                    target: input.target,
                    kind: input.kind,
                    metadata: JSON.stringify({}),
                    createdAt: new Date().toISOString(),
                  });
                  return addOk(key);
                },
                storageError,
              ),
            (found) => TE.right(addAlreadyExists(String(found['id']))),
          ),
        ),
      ),
    ),

  findFrom: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('relationship', { source: input.source });
          const filtered = input.kind
            ? records.filter((r) => String(r['kind']) === input.kind)
            : records;
          return findFromOk(JSON.stringify(filtered.map((r) => ({
            id: String(r['id']),
            target: String(r['target']),
            kind: String(r['kind']),
          }))));
        },
        storageError,
      ),
    ),

  findTo: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('relationship', { target: input.target });
          const filtered = input.kind
            ? records.filter((r) => String(r['kind']) === input.kind)
            : records;
          return findToOk(JSON.stringify(filtered.map((r) => ({
            id: String(r['id']),
            source: String(r['source']),
            kind: String(r['kind']),
          }))));
        },
        storageError,
      ),
    ),

  transitiveClosure: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const visited = new Set<string>();
          const allPaths: readonly string[][] = [];
          const queue: { readonly node: string; readonly path: readonly string[] }[] = [
            { node: input.start, path: [input.start] },
          ];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current.node)) continue;
            visited.add(current.node);

            const filterKey = input.direction === 'forward' ? 'source' : 'target';
            const nextKey = input.direction === 'forward' ? 'target' : 'source';
            const neighbors = await storage.find('relationship', {
              [filterKey]: current.node,
              kind: input.kind,
            });

            for (const neighbor of neighbors) {
              const nextNode = String(neighbor[nextKey]);
              if (!visited.has(nextNode)) {
                const newPath = [...current.path, nextNode];
                (allPaths as string[][]).push([...newPath]);
                queue.push({ node: nextNode, path: newPath });
              }
            }
          }

          visited.delete(input.start);
          return transitiveClosureOk(
            JSON.stringify([...visited]),
            JSON.stringify(allPaths),
          );
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('relationship', input.relationship),
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
                  String(found['source']),
                  String(found['target']),
                  String(found['kind']),
                  String(found['metadata']),
                ),
              ),
          ),
        ),
      ),
    ),
};
