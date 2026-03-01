// KindSystem — handler.ts
// Type/kind taxonomy for intermediate representations: define kinds with categories,
// connect them via directed edges, find transformation routes via BFS,
// validate pipelines, and query dependency/producer/consumer graphs.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  KindSystemStorage,
  KindSystemDefineInput,
  KindSystemDefineOutput,
  KindSystemConnectInput,
  KindSystemConnectOutput,
  KindSystemRouteInput,
  KindSystemRouteOutput,
  KindSystemValidateInput,
  KindSystemValidateOutput,
  KindSystemDependentsInput,
  KindSystemDependentsOutput,
  KindSystemProducersInput,
  KindSystemProducersOutput,
  KindSystemConsumersInput,
  KindSystemConsumersOutput,
  KindSystemGraphInput,
  KindSystemGraphOutput,
} from './types.js';

import {
  defineOk,
  defineExists,
  connectOk,
  connectInvalid,
  routeOk,
  routeUnreachable,
  validateOk,
  validateInvalid,
  dependentsOk,
  producersOk,
  consumersOk,
  graphOk,
} from './types.js';

export interface KindSystemError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): KindSystemError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface KindSystemHandler {
  readonly define: (
    input: KindSystemDefineInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemDefineOutput>;
  readonly connect: (
    input: KindSystemConnectInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemConnectOutput>;
  readonly route: (
    input: KindSystemRouteInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemRouteOutput>;
  readonly validate: (
    input: KindSystemValidateInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemValidateOutput>;
  readonly dependents: (
    input: KindSystemDependentsInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemDependentsOutput>;
  readonly producers: (
    input: KindSystemProducersInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemProducersOutput>;
  readonly consumers: (
    input: KindSystemConsumersInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemConsumersOutput>;
  readonly graph: (
    input: KindSystemGraphInput,
    storage: KindSystemStorage,
  ) => TE.TaskEither<KindSystemError, KindSystemGraphOutput>;
}

// --- Implementation ---

export const kindSystemHandler: KindSystemHandler = {
  // Register a new kind; reject if already defined
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('kind', input.name),
        toError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('kind', input.name, {
                    name: input.name,
                    category: input.category,
                  });
                  return defineOk(input.name);
                },
                toError,
              ),
            () => TE.right(defineExists(input.name)),
          ),
        ),
      ),
    ),

  // Create a directed edge between two kinds; both must exist
  connect: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const fromKind = await storage.get('kind', input.from);
          const toKind = await storage.get('kind', input.to);
          if (!fromKind) return connectInvalid(`Kind '${input.from}' not found`);
          if (!toKind) return connectInvalid(`Kind '${input.to}' not found`);

          const edgeKey = `${input.from}->${input.to}`;
          const transformName = pipe(input.transformName, O.toNullable);
          await storage.put('edge', edgeKey, {
            from: input.from,
            to: input.to,
            relation: input.relation,
            transformName: transformName ?? null,
          });
          return connectOk();
        },
        toError,
      ),
    ),

  // BFS to find the shortest transformation route between two kinds
  route: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allEdges = await storage.find('edge');

          // Build adjacency list
          const adjacency = new Map<string, Array<{ readonly to: string; readonly relation: string; readonly transform: O.Option<string> }>>();
          for (const e of allEdges) {
            const from = e.from as string;
            const to = e.to as string;
            const list = adjacency.get(from) ?? [];
            list.push({
              to,
              relation: (e.relation as string) ?? '',
              transform: e.transformName ? O.some(e.transformName as string) : O.none,
            });
            adjacency.set(from, list);
          }

          // BFS
          const visited = new Set<string>([input.from]);
          const queue: Array<{ readonly kind: string; readonly path: readonly { readonly kind: string; readonly relation: string; readonly transform: O.Option<string> }[] }> = [
            { kind: input.from, path: [] },
          ];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.kind === input.to) {
              return routeOk(current.path);
            }
            const neighbors = adjacency.get(current.kind) ?? [];
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor.to)) {
                visited.add(neighbor.to);
                queue.push({
                  kind: neighbor.to,
                  path: [...current.path, { kind: neighbor.to, relation: neighbor.relation, transform: neighbor.transform }],
                });
              }
            }
          }

          return routeUnreachable(`No route from '${input.from}' to '${input.to}'`);
        },
        toError,
      ),
    ),

  // Validate that a transformation pipeline from->to exists
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const fromKind = await storage.get('kind', input.from);
          const toKind = await storage.get('kind', input.to);
          if (!fromKind) return validateInvalid(`Kind '${input.from}' not defined`);
          if (!toKind) return validateInvalid(`Kind '${input.to}' not defined`);

          // Check reachability via edges
          const allEdges = await storage.find('edge');
          const adjacency = new Map<string, string[]>();
          for (const e of allEdges) {
            const from = e.from as string;
            const to = e.to as string;
            const list = adjacency.get(from) ?? [];
            list.push(to);
            adjacency.set(from, list);
          }

          const visited = new Set<string>([input.from]);
          const stack = [input.from];
          while (stack.length > 0) {
            const current = stack.pop()!;
            if (current === input.to) return validateOk();
            for (const next of adjacency.get(current) ?? []) {
              if (!visited.has(next)) {
                visited.add(next);
                stack.push(next);
              }
            }
          }

          return validateInvalid(`No valid pipeline from '${input.from}' to '${input.to}'`);
        },
        toError,
      ),
    ),

  // Find all kinds downstream (reachable) from the given kind
  dependents: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allEdges = await storage.find('edge');
          const adjacency = new Map<string, string[]>();
          for (const e of allEdges) {
            const from = e.from as string;
            const list = adjacency.get(from) ?? [];
            list.push(e.to as string);
            adjacency.set(from, list);
          }

          const downstream: string[] = [];
          const visited = new Set<string>([input.kind]);
          const stack = [input.kind];
          while (stack.length > 0) {
            const current = stack.pop()!;
            for (const next of adjacency.get(current) ?? []) {
              if (!visited.has(next)) {
                visited.add(next);
                downstream.push(next);
                stack.push(next);
              }
            }
          }

          return dependentsOk(downstream);
        },
        toError,
      ),
    ),

  // Find all transforms that produce the given kind (edges pointing to it)
  producers: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allEdges = await storage.find('edge');
          const producers = allEdges
            .filter((e) => e.to === input.kind)
            .map((e) => ({
              fromKind: (e.from as string) ?? '',
              transformName: e.transformName ? O.some(e.transformName as string) : O.none,
            }));
          return producersOk(producers);
        },
        toError,
      ),
    ),

  // Find all transforms that consume the given kind (edges from it)
  consumers: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allEdges = await storage.find('edge');
          const consumers = allEdges
            .filter((e) => e.from === input.kind)
            .map((e) => ({
              toKind: (e.to as string) ?? '',
              transformName: e.transformName ? O.some(e.transformName as string) : O.none,
            }));
          return consumersOk(consumers);
        },
        toError,
      ),
    ),

  // Return the full kind graph: all kinds and all edges
  graph: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allKinds = await storage.find('kind');
          const allEdges = await storage.find('edge');

          const kinds = allKinds.map((k) => ({
            name: (k.name as string) ?? '',
            category: (k.category as string) ?? '',
          }));

          const edges = allEdges.map((e) => ({
            from: (e.from as string) ?? '',
            to: (e.to as string) ?? '',
            relation: (e.relation as string) ?? '',
            transform: e.transformName ? O.some(e.transformName as string) : O.none,
          }));

          return graphOk(kinds, edges);
        },
        toError,
      ),
    ),
};
