// SelectionPipelineDependenceProvider — Tracks dependencies from data flow
// pipelines composed of filter/map/reduce/sort/group stages, identifying
// which upstream data sources each pipeline stage depends on.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SelectionPipelineDependenceProviderStorage,
  SelectionPipelineDependenceProviderInitializeInput,
  SelectionPipelineDependenceProviderInitializeOutput,
} from './types.js';

import {
  initializeOk,
  initializeLoadError,
} from './types.js';

// --- Domain types ---

export interface SelectionPipelineDependenceProviderError {
  readonly code: string;
  readonly message: string;
}

type StageKind = 'source' | 'filter' | 'map' | 'reduce' | 'sort' | 'group' | 'join' | 'limit';

interface PipelineStage {
  readonly id: string;
  readonly kind: StageKind;
  readonly pipelineId: string;
  readonly position: number;
  readonly fieldRefs: readonly string[];
}

interface PipelineDependency {
  readonly stageId: string;
  readonly dependsOn: string;
  readonly through: string;
}

// --- Helpers ---

const storageError = (error: unknown): SelectionPipelineDependenceProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateId = (): string =>
  `spdp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowISO = (): string => new Date().toISOString();

// Compute data flow dependencies: each stage depends on prior stages
// and transitively on upstream source stages through field references.
const computeFlowDependencies = (
  stages: readonly PipelineStage[],
): readonly PipelineDependency[] => {
  const deps: PipelineDependency[] = [];
  const sorted = [...stages].sort((a, b) => a.position - b.position);

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    // Direct dependency: each stage depends on the immediately prior stage
    const prior = sorted[i - 1];
    deps.push({
      stageId: current.id,
      dependsOn: prior.id,
      through: 'sequential',
    });

    // Field-level dependencies: if this stage references fields that were
    // introduced or transformed by an earlier stage, add those edges
    for (const fieldRef of current.fieldRefs) {
      for (let j = 0; j < i; j++) {
        const earlier = sorted[j];
        if (earlier.fieldRefs.includes(fieldRef)) {
          deps.push({
            stageId: current.id,
            dependsOn: earlier.id,
            through: fieldRef,
          });
        }
      }
    }
  }

  return deps;
};

// Trace backward from an output stage to all source stages
const traceToSources = (
  stageId: string,
  deps: readonly PipelineDependency[],
  stages: readonly PipelineStage[],
): readonly string[] => {
  const visited = new Set<string>();
  const queue = [stageId];
  const sources: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const stage = stages.find((s) => s.id === current);
    if (stage !== undefined && stage.kind === 'source' && current !== stageId) {
      sources.push(current);
    }

    const upstream = deps.filter((d) => d.stageId === current);
    for (const dep of upstream) {
      if (!visited.has(dep.dependsOn)) {
        queue.push(dep.dependsOn);
      }
    }
  }

  return sources;
};

// --- Handler interface ---

export interface SelectionPipelineDependenceProviderHandler {
  readonly initialize: (
    input: SelectionPipelineDependenceProviderInitializeInput,
    storage: SelectionPipelineDependenceProviderStorage,
  ) => TE.TaskEither<SelectionPipelineDependenceProviderError, SelectionPipelineDependenceProviderInitializeOutput>;
  readonly registerPipeline: (
    input: { readonly pipelineId: string; readonly stages: readonly { readonly kind: string; readonly fieldRefs: readonly string[] }[] },
    storage: SelectionPipelineDependenceProviderStorage,
  ) => TE.TaskEither<SelectionPipelineDependenceProviderError, { readonly stageCount: number; readonly depCount: number }>;
  readonly getStageDependencies: (
    input: { readonly stageId: string },
    storage: SelectionPipelineDependenceProviderStorage,
  ) => TE.TaskEither<SelectionPipelineDependenceProviderError, { readonly dependencies: readonly PipelineDependency[] }>;
  readonly traceToSources: (
    input: { readonly stageId: string },
    storage: SelectionPipelineDependenceProviderStorage,
  ) => TE.TaskEither<SelectionPipelineDependenceProviderError, { readonly sources: readonly string[] }>;
  readonly getImpactedStages: (
    input: { readonly stageId: string },
    storage: SelectionPipelineDependenceProviderStorage,
  ) => TE.TaskEither<SelectionPipelineDependenceProviderError, { readonly impacted: readonly string[] }>;
}

// --- Implementation ---

export const selectionPipelineDependenceProviderHandler: SelectionPipelineDependenceProviderHandler = {
  // Verify storage and load existing pipeline metadata.
  initialize: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const instanceId = generateId();
          const pipelines = await storage.find('pipeline_stages');
          await storage.put('pipeline_instances', instanceId, {
            id: instanceId,
            stageCount: pipelines.length,
            createdAt: nowISO(),
          });
          return instanceId;
        },
        storageError,
      ),
      TE.map((instanceId) => initializeOk(instanceId)),
      TE.orElse((err) =>
        TE.right(initializeLoadError(err.message)),
      ),
    ),

  // Register a data flow pipeline with its stages and compute dependencies.
  registerPipeline: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const stages: PipelineStage[] = input.stages.map((s, i) => ({
            id: `${input.pipelineId}-stage-${i}`,
            kind: (s.kind as StageKind) || 'map',
            pipelineId: input.pipelineId,
            position: i,
            fieldRefs: [...s.fieldRefs],
          }));

          // Persist stages
          for (const stage of stages) {
            await storage.put('pipeline_stages', stage.id, {
              id: stage.id,
              kind: stage.kind,
              pipelineId: stage.pipelineId,
              position: stage.position,
              fieldRefs: JSON.stringify(stage.fieldRefs),
              createdAt: nowISO(),
            });
          }

          // Compute and persist dependencies
          const deps = computeFlowDependencies(stages);
          for (const dep of deps) {
            const depId = `${dep.stageId}:${dep.dependsOn}:${dep.through}`;
            await storage.put('pipeline_deps', depId, {
              stageId: dep.stageId,
              dependsOn: dep.dependsOn,
              through: dep.through,
              createdAt: nowISO(),
            });
          }

          return { stageCount: stages.length, depCount: deps.length };
        },
        storageError,
      ),
    ),

  // Get direct dependencies for a specific pipeline stage.
  getStageDependencies: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('pipeline_deps', { stageId: input.stageId }),
        storageError,
      ),
      TE.map((records) => ({
        dependencies: records.map((r) => ({
          stageId: String(r['stageId'] ?? ''),
          dependsOn: String(r['dependsOn'] ?? ''),
          through: String(r['through'] ?? ''),
        })),
      })),
    ),

  // Trace backward through the dependency graph to find all source stages.
  traceToSources: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const stageRecords = await storage.find('pipeline_stages');
          const depRecords = await storage.find('pipeline_deps');
          return { stageRecords, depRecords };
        },
        storageError,
      ),
      TE.map(({ stageRecords, depRecords }) => {
        const stages: readonly PipelineStage[] = stageRecords.map((r) => ({
          id: String(r['id'] ?? ''),
          kind: String(r['kind'] ?? 'map') as StageKind,
          pipelineId: String(r['pipelineId'] ?? ''),
          position: Number(r['position'] ?? 0),
          fieldRefs: JSON.parse(String(r['fieldRefs'] ?? '[]')),
        }));
        const deps: readonly PipelineDependency[] = depRecords.map((r) => ({
          stageId: String(r['stageId'] ?? ''),
          dependsOn: String(r['dependsOn'] ?? ''),
          through: String(r['through'] ?? ''),
        }));
        return { sources: traceToSources(input.stageId, deps, stages) };
      }),
    ),

  // Forward impact: find all downstream stages affected by a change to this stage.
  getImpactedStages: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('pipeline_deps'),
        storageError,
      ),
      TE.map((records) => {
        const deps = records.map((r) => ({
          stageId: String(r['stageId'] ?? ''),
          dependsOn: String(r['dependsOn'] ?? ''),
        }));
        // BFS forward through reverse dependency edges
        const visited = new Set<string>();
        const queue = [input.stageId];
        const impacted: string[] = [];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);
          if (current !== input.stageId) impacted.push(current);
          const downstream = deps
            .filter((d) => d.dependsOn === current)
            .map((d) => d.stageId);
          for (const d of downstream) {
            if (!visited.has(d)) queue.push(d);
          }
        }
        return { impacted };
      }),
    ),
};
