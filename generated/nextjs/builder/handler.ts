// Builder — Abstract build pipeline with step registration, graph management, and execution
// Orchestrates language-specific builders through a unified build/test/status interface.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  BuilderStorage,
  BuilderBuildInput,
  BuilderBuildOutput,
  BuilderBuildAllInput,
  BuilderBuildAllOutput,
  BuilderTestInput,
  BuilderTestOutput,
  BuilderStatusInput,
  BuilderStatusOutput,
  BuilderHistoryInput,
  BuilderHistoryOutput,
} from './types.js';

import {
  buildOk,
  buildCompilationError,
  buildToolchainError,
  buildAllOk,
  buildAllPartial,
  testOk,
  testNotBuilt,
  testRunnerNotFound,
  statusOk,
  historyOk,
} from './types.js';

export interface BuilderError {
  readonly code: string;
  readonly message: string;
}

export interface BuilderHandler {
  readonly build: (
    input: BuilderBuildInput,
    storage: BuilderStorage,
  ) => TE.TaskEither<BuilderError, BuilderBuildOutput>;
  readonly buildAll: (
    input: BuilderBuildAllInput,
    storage: BuilderStorage,
  ) => TE.TaskEither<BuilderError, BuilderBuildAllOutput>;
  readonly test: (
    input: BuilderTestInput,
    storage: BuilderStorage,
  ) => TE.TaskEither<BuilderError, BuilderTestOutput>;
  readonly status: (
    input: BuilderStatusInput,
    storage: BuilderStorage,
  ) => TE.TaskEither<BuilderError, BuilderStatusOutput>;
  readonly history: (
    input: BuilderHistoryInput,
    storage: BuilderStorage,
  ) => TE.TaskEither<BuilderError, BuilderHistoryOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): BuilderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const computeArtifactHash = (concept: string, language: string, source: string): string => {
  const raw = `${concept}:${language}:${source}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(8, '0')}`;
};

const generateBuildId = (concept: string, language: string): string =>
  `build-${concept}-${language}-${Date.now()}`;

const SUPPORTED_LANGUAGES: readonly string[] = ['typescript', 'rust', 'swift', 'solidity'] as const;

// --- Implementation ---

export const builderHandler: BuilderHandler = {
  build: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('toolchains', input.language),
        toStorageError,
      ),
      TE.chain((toolchainRecord) =>
        pipe(
          O.fromNullable(toolchainRecord),
          O.fold(
            () => TE.right(buildToolchainError(
              input.concept,
              input.language,
              `No toolchain registered for language '${input.language}'`,
            ) as BuilderBuildOutput),
            () => {
              const buildId = generateBuildId(input.concept, input.language);
              const artifactHash = computeArtifactHash(input.concept, input.language, input.source);
              const artifactLocation = `artifacts/${input.concept}/${input.language}/${buildId}`;
              const startTime = Date.now();

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('builds', buildId, {
                      buildId,
                      concept: input.concept,
                      source: input.source,
                      language: input.language,
                      platform: input.platform,
                      config: input.config,
                      artifactHash,
                      artifactLocation,
                      status: 'completed',
                      startedAt: new Date().toISOString(),
                      duration: Date.now() - startTime,
                    });
                    return buildOk(buildId, artifactHash, artifactLocation, Date.now() - startTime);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),

  buildAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const completed: { readonly concept: string; readonly language: string; readonly artifactHash: string }[] = [];
          const failed: { readonly concept: string; readonly language: string; readonly error: string }[] = [];
          const results: { readonly concept: string; readonly language: string; readonly artifactHash: string; readonly duration: number }[] = [];

          for (const concept of input.concepts) {
            for (const target of input.targets) {
              const toolchain = await storage.get('toolchains', target.language);
              if (toolchain === null) {
                failed.push({
                  concept,
                  language: target.language,
                  error: `No toolchain for '${target.language}'`,
                });
                continue;
              }

              const startTime = Date.now();
              const artifactHash = computeArtifactHash(concept, target.language, input.source);
              const buildId = generateBuildId(concept, target.language);

              await storage.put('builds', buildId, {
                buildId,
                concept,
                source: input.source,
                language: target.language,
                platform: target.platform,
                artifactHash,
                status: 'completed',
                duration: Date.now() - startTime,
              });

              completed.push({ concept, language: target.language, artifactHash });
              results.push({ concept, language: target.language, artifactHash, duration: Date.now() - startTime });
            }
          }

          if (failed.length > 0) {
            return buildAllPartial(completed, failed);
          }
          return buildAllOk(results);
        },
        toStorageError,
      ),
    ),

  test: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('builds', { concept: input.concept, language: input.language }),
        toStorageError,
      ),
      TE.chain((records) => {
        if (records.length === 0) {
          return TE.right(testNotBuilt(input.concept, input.language) as BuilderTestOutput);
        }

        const resolvedTestType = pipe(
          input.testType,
          O.getOrElse(() => 'unit'),
        );

        return pipe(
          TE.tryCatch(
            () => storage.get('test-runners', `${input.language}:${resolvedTestType}`),
            toStorageError,
          ),
          TE.chain((runner) =>
            pipe(
              O.fromNullable(runner),
              O.fold(
                () => {
                  const hints: Record<string, string> = {
                    typescript: 'npm install --save-dev vitest',
                    rust: 'cargo test is built-in',
                    swift: 'swift test is built-in with SPM',
                    solidity: 'npm install --save-dev hardhat',
                  };
                  return TE.right(testRunnerNotFound(
                    input.language,
                    resolvedTestType,
                    hints[input.language] ?? `Install a ${resolvedTestType} runner for ${input.language}`,
                  ) as BuilderTestOutput);
                },
                () => {
                  const startTime = Date.now();
                  return TE.right(testOk(
                    0, 0, 0,
                    Date.now() - startTime,
                    resolvedTestType,
                  ) as BuilderTestOutput);
                },
              ),
            ),
          ),
        );
      }),
    ),

  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('builds', input.build),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(statusOk(
              input.build,
              'not_found',
              O.none,
            )),
            (rec) => TE.right(statusOk(
              input.build,
              String((rec as Record<string, unknown>).status ?? 'unknown'),
              pipe(
                O.fromNullable((rec as Record<string, unknown>).duration as number | null),
              ),
            )),
          ),
        ),
      ),
    ),

  history: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('builds', { concept: input.concept }),
        toStorageError,
      ),
      TE.map((records) => {
        const filtered = pipe(
          input.language,
          O.fold(
            () => records,
            (lang) => records.filter((r) => (r as Record<string, unknown>).language === lang),
          ),
        );

        const builds = filtered.map((r) => {
          const rec = r as Record<string, unknown>;
          return {
            language: String(rec.language ?? ''),
            platform: String(rec.platform ?? ''),
            artifactHash: String(rec.artifactHash ?? ''),
            duration: Number(rec.duration ?? 0),
            completedAt: new Date(String(rec.startedAt ?? new Date().toISOString())),
            testsPassed: Number(rec.testsPassed ?? 0),
          };
        });

        return historyOk(builds);
      }),
    ),
};
