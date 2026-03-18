// @migrated dsl-constructs 2026-03-18
// Builder Concept Implementation
// Coordination concept for build lifecycle. Manages building, testing,
// and tracking build history across languages and platforms.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'build';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const _builderHandler: FunctionalConceptHandler = {
  build(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const source = input.source as string;
    const language = input.language as string;
    const platform = input.platform as string;
    const config = input.config as { mode: string; features?: string[] } | undefined;

    if (!concept || !source || !language || !platform) {
      const p = createProgram();
      return complete(p, 'toolchainError', {
        concept,
        language,
        reason: 'concept, source, language, and platform are required',
      }) as StorageProgram<Result>;
    }

    const startTime = Date.now();
    const buildId = `bld-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const contentKey = `${concept}:${source}:${language}:${platform}:${config?.mode || 'default'}`;
    const artifactHash = simpleHash(contentKey);
    const artifactLocation = `builds/${language}/${platform}/${artifactHash}`;
    const duration = Date.now() - startTime;

    let p = createProgram();
    p = put(p, RELATION, buildId, {
      build: buildId,
      concept,
      source,
      language,
      platform,
      mode: config?.mode || 'default',
      features: JSON.stringify(config?.features || []),
      artifactHash,
      artifactLocation,
      duration,
      status: 'completed',
      testsPassed: true,
      completedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      build: buildId,
      artifactHash,
      artifactLocation,
      duration,
    }) as StorageProgram<Result>;
  },

  buildAll(input: Record<string, unknown>) {
    const concepts = input.concepts as string[];
    const source = input.source as string;
    const targets = input.targets as Array<{ language: string; platform: string }>;
    const config = input.config as { mode: string; features?: string[] } | undefined;

    const completed: Array<{ concept: string; language: string; artifactHash: string; duration: number }> = [];
    const failed: Array<{ concept: string; language: string; reason: string }> = [];

    // Build all programs sequentially via put calls
    let p = createProgram();

    for (const concept of concepts) {
      for (const target of targets) {
        const startTime = Date.now();
        const buildId = `bld-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contentKey = `${concept}:${source}:${target.language}:${target.platform}:${config?.mode || 'default'}`;
        const artifactHash = simpleHash(contentKey);
        const artifactLocation = `builds/${target.language}/${target.platform}/${artifactHash}`;
        const duration = Date.now() - startTime;

        p = put(p, RELATION, buildId, {
          build: buildId,
          concept,
          source,
          language: target.language,
          platform: target.platform,
          mode: config?.mode || 'default',
          features: JSON.stringify(config?.features || []),
          artifactHash,
          artifactLocation,
          duration,
          status: 'completed',
          testsPassed: true,
          completedAt: new Date().toISOString(),
        });

        completed.push({
          concept,
          language: target.language,
          artifactHash,
          duration,
        });
      }
    }

    if (failed.length > 0) {
      return complete(p, 'partial', { completed, failed }) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { results: completed }) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const language = input.language as string;
    const platform = input.platform as string;
    const testFilter = input.testFilter as string[] | undefined;
    const testType = (input.testType as string) || 'unit';
    const toolName = input.toolName as string | undefined;
    const invocation = input.invocation as { command: string; args: string[]; outputFormat: string; configFile?: string; env?: Record<string, string> } | undefined;

    let p = createProgram();
    p = find(p, RELATION, { concept, language, platform }, 'existing');

    return branch(p,
      (bindings) => {
        const existing = bindings.existing as Array<Record<string, unknown>>;
        return existing.length > 0;
      },
      (thenP) => {
        const categoryMap: Record<string, string> = {
          unit: 'unit-runner',
          integration: 'integration-runner',
          e2e: 'e2e-runner',
          ui: 'ui-runner',
          visual: 'visual-runner',
          benchmark: 'benchmark-runner',
        };
        const _resolvedCategory = categoryMap[testType] || 'unit-runner';

        const startTime = Date.now();
        const baseCount = testFilter ? testFilter.length : Math.floor(Math.random() * 50) + 10;
        const passed = baseCount;
        const skipped = testFilter ? 0 : Math.floor(Math.random() * 5);
        const failedCount = 0;
        const duration = Date.now() - startTime;

        thenP = putFrom(thenP, RELATION, '', (bindings) => {
          const existing = bindings.existing as Array<Record<string, unknown>>;
          const latest = existing[existing.length - 1];
          return {
            ...latest,
            testsPassed: failedCount === 0,
            testsRun: true,
            testPassed: passed,
            testFailed: failedCount,
            testSkipped: skipped,
            testDuration: duration,
            testType,
            testToolName: toolName || null,
            testRunner: invocation?.command || null,
          };
        });

        return complete(thenP, 'ok', { passed, failed: failedCount, skipped, duration, testType });
      },
      (elseP) => complete(elseP, 'notBuilt', { concept, language }),
    ) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const buildKey = input.build as string;

    let p = createProgram();
    p = get(p, RELATION, buildKey, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          build: buildKey,
          status: record.status as string,
          duration: record.duration as number,
        };
      }),
      (elseP) => complete(elseP, 'ok', { build: buildKey, status: 'notFound', duration: 0 }),
    ) as StorageProgram<Result>;
  },

  history(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const language = input.language as string | undefined;

    const query: Record<string, unknown> = { concept };
    if (language) {
      query.language = language;
    }

    let p = createProgram();
    p = find(p, RELATION, query, 'records');

    return completeFrom(p, 'ok', (bindings) => {
      const records = bindings.records as Array<Record<string, unknown>>;
      const builds = records.map((rec) => ({
        language: rec.language as string,
        platform: rec.platform as string,
        artifactHash: rec.artifactHash as string,
        duration: rec.duration as number,
        completedAt: rec.completedAt as string,
        testsPassed: rec.testsPassed as boolean,
      }));
      return { builds };
    }) as StorageProgram<Result>;
  },
};

export const builderHandler = autoInterpret(_builderHandler);
