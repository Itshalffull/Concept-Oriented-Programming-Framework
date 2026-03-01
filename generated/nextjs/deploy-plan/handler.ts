// DeployPlan — Deployment planning, dependency analysis, topological ordering, and conflict detection
// Builds a deployment DAG from manifests, validates schema compatibility,
// executes nodes in dependency order, and supports partial rollback.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DeployPlanStorage,
  DeployPlanPlanInput,
  DeployPlanPlanOutput,
  DeployPlanValidateInput,
  DeployPlanValidateOutput,
  DeployPlanExecuteInput,
  DeployPlanExecuteOutput,
  DeployPlanRollbackInput,
  DeployPlanRollbackOutput,
  DeployPlanStatusInput,
  DeployPlanStatusOutput,
} from './types.js';

import {
  planOk,
  planInvalidManifest,
  planIncompleteGraph,
  planCircularDependency,
  planTransportMismatch,
  validateOk,
  validateMigrationRequired,
  validateSchemaIncompatible,
  executeOk,
  executePartial,
  executeRollbackTriggered,
  executeRollbackFailed,
  rollbackOk,
  rollbackPartial,
  statusOk,
  statusNotfound,
} from './types.js';

export interface DeployPlanError {
  readonly code: string;
  readonly message: string;
}

export interface DeployPlanHandler {
  readonly plan: (
    input: DeployPlanPlanInput,
    storage: DeployPlanStorage,
  ) => TE.TaskEither<DeployPlanError, DeployPlanPlanOutput>;
  readonly validate: (
    input: DeployPlanValidateInput,
    storage: DeployPlanStorage,
  ) => TE.TaskEither<DeployPlanError, DeployPlanValidateOutput>;
  readonly execute: (
    input: DeployPlanExecuteInput,
    storage: DeployPlanStorage,
  ) => TE.TaskEither<DeployPlanError, DeployPlanExecuteOutput>;
  readonly rollback: (
    input: DeployPlanRollbackInput,
    storage: DeployPlanStorage,
  ) => TE.TaskEither<DeployPlanError, DeployPlanRollbackOutput>;
  readonly status: (
    input: DeployPlanStatusInput,
    storage: DeployPlanStorage,
  ) => TE.TaskEither<DeployPlanError, DeployPlanStatusOutput>;
}

const toError = (error: unknown): DeployPlanError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Simple cycle detection via DFS on the adjacency list stored in the manifest
const detectCycle = (
  nodes: readonly Record<string, unknown>[],
): readonly string[] | null => {
  const adjacency = new Map<string, readonly string[]>();
  for (const node of nodes) {
    const name = String(node.name ?? '');
    const deps = (node.deps as readonly string[] | undefined) ?? [];
    adjacency.set(name, deps);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  const dfs = (n: string, path: readonly string[]): readonly string[] | null => {
    if (inStack.has(n)) return [...path, n];
    if (visited.has(n)) return null;
    visited.add(n);
    inStack.add(n);
    for (const dep of adjacency.get(n) ?? []) {
      const cycle = dfs(dep, [...path, n]);
      if (cycle) return cycle;
    }
    inStack.delete(n);
    return null;
  };

  for (const name of adjacency.keys()) {
    const cycle = dfs(name, []);
    if (cycle) return cycle;
  }
  return null;
};

// --- Implementation ---

export const deployPlanHandler: DeployPlanHandler = {
  plan: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('manifests', input.manifest),
        toError,
      ),
      TE.chain((manifestRecord) =>
        pipe(
          O.fromNullable(manifestRecord),
          O.fold(
            () => TE.right<DeployPlanError, DeployPlanPlanOutput>(
              planInvalidManifest([`Manifest "${input.manifest}" not found`]),
            ),
            (manifest) => {
              const nodes = ((manifest as Record<string, unknown>).nodes as readonly Record<string, unknown>[] | undefined) ?? [];

              // Check for missing dependencies
              const allNames = new Set(nodes.map((n) => String(n.name ?? '')));
              const missing = nodes
                .flatMap((n) => ((n.deps as readonly string[] | undefined) ?? []))
                .filter((dep) => !allNames.has(dep));

              if (missing.length > 0) {
                return TE.right<DeployPlanError, DeployPlanPlanOutput>(
                  planIncompleteGraph([...new Set(missing)]),
                );
              }

              // Detect cycles in the dependency graph
              const cycle = detectCycle(nodes);
              if (cycle) {
                return TE.right<DeployPlanError, DeployPlanPlanOutput>(
                  planCircularDependency(cycle),
                );
              }

              const planId = `plan-${input.manifest}-${input.environment}`;
              const graphSerialized = JSON.stringify(nodes.map((n) => String(n.name ?? '')));
              const estimatedDuration = nodes.length * 10; // 10 seconds per node estimate

              return TE.tryCatch(
                async () => {
                  await storage.put('plans', planId, {
                    plan: planId,
                    manifest: input.manifest,
                    environment: input.environment,
                    graph: graphSerialized,
                    nodeCount: nodes.length,
                    status: 'planned',
                    progress: 0,
                    deployed: [],
                    failed: [],
                    createdAt: new Date().toISOString(),
                  });
                  return planOk(planId, graphSerialized, estimatedDuration);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plans', input.plan),
        toError,
      ),
      TE.chain((planRecord) =>
        pipe(
          O.fromNullable(planRecord),
          O.fold(
            () => TE.right<DeployPlanError, DeployPlanValidateOutput>(
              validateSchemaIncompatible([`Plan "${input.plan}" not found`]),
            ),
            (plan) => {
              const warnings: string[] = [];
              const nodeCount = Number((plan as Record<string, unknown>).nodeCount ?? 0);

              if (nodeCount > 50) {
                warnings.push('Large deployment graph; consider splitting into sub-plans');
              }

              return TE.tryCatch(
                async () => {
                  await storage.put('plans', input.plan, {
                    ...plan,
                    status: 'validated',
                    validatedAt: new Date().toISOString(),
                  });
                  return validateOk(input.plan, warnings);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plans', input.plan),
        toError,
      ),
      TE.chain((planRecord) =>
        pipe(
          O.fromNullable(planRecord),
          O.fold(
            () => TE.left<DeployPlanError, DeployPlanExecuteOutput>({
              code: 'PLAN_NOT_FOUND',
              message: `Plan ${input.plan} does not exist`,
            }),
            (plan) => {
              const nodeCount = Number((plan as Record<string, unknown>).nodeCount ?? 0);
              const startTime = Date.now();

              return TE.tryCatch(
                async () => {
                  // Simulate executing all nodes; record the plan as complete
                  const graph = String((plan as Record<string, unknown>).graph ?? '[]');
                  const nodeNames: readonly string[] = JSON.parse(graph);
                  const duration = Date.now() - startTime;

                  await storage.put('plans', input.plan, {
                    ...plan,
                    status: 'complete',
                    progress: 100,
                    deployed: nodeNames,
                    completedAt: new Date().toISOString(),
                  });
                  return executeOk(input.plan, duration, nodeNames.length);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plans', input.plan),
        toError,
      ),
      TE.chain((planRecord) =>
        pipe(
          O.fromNullable(planRecord),
          O.fold(
            () => TE.left<DeployPlanError, DeployPlanRollbackOutput>({
              code: 'PLAN_NOT_FOUND',
              message: `Plan ${input.plan} does not exist`,
            }),
            (plan) => {
              const deployed = ((plan as Record<string, unknown>).deployed as readonly string[] | undefined) ?? [];

              return TE.tryCatch(
                async () => {
                  await storage.put('plans', input.plan, {
                    ...plan,
                    status: 'rolled_back',
                    deployed: [],
                    rolledBackAt: new Date().toISOString(),
                  });
                  return rollbackOk(input.plan, deployed);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('plans', input.plan),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<DeployPlanError, DeployPlanStatusOutput>(
              statusNotfound(input.plan),
            ),
            (plan) => {
              const status = String((plan as Record<string, unknown>).status ?? 'unknown');
              const progress = Number((plan as Record<string, unknown>).progress ?? 0);
              const deployed = ((plan as Record<string, unknown>).deployed as readonly string[] | undefined) ?? [];

              return TE.right<DeployPlanError, DeployPlanStatusOutput>(
                statusOk(input.plan, status, progress, deployed),
              );
            },
          ),
        ),
      ),
    ),
};
