// RustBuilder — Rust/Cargo build pipeline: Cargo.toml configuration, crate resolution,
// target compilation, feature flag management, and artifact packaging.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RustBuilderStorage,
  RustBuilderBuildInput,
  RustBuilderBuildOutput,
  RustBuilderTestInput,
  RustBuilderTestOutput,
  RustBuilderPackageInput,
  RustBuilderPackageOutput,
  RustBuilderRegisterInput,
  RustBuilderRegisterOutput,
} from './types.js';

import {
  buildOk,
  buildCompilationError,
  buildFeatureConflict,
  testOk,
  testTestFailure,
  packageOk,
  packageFormatUnsupported,
  registerOk,
} from './types.js';

export interface RustBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface RustBuilderHandler {
  readonly build: (
    input: RustBuilderBuildInput,
    storage: RustBuilderStorage,
  ) => TE.TaskEither<RustBuilderError, RustBuilderBuildOutput>;
  readonly test: (
    input: RustBuilderTestInput,
    storage: RustBuilderStorage,
  ) => TE.TaskEither<RustBuilderError, RustBuilderTestOutput>;
  readonly package: (
    input: RustBuilderPackageInput,
    storage: RustBuilderStorage,
  ) => TE.TaskEither<RustBuilderError, RustBuilderPackageOutput>;
  readonly register: (
    input: RustBuilderRegisterInput,
    storage: RustBuilderStorage,
  ) => TE.TaskEither<RustBuilderError, RustBuilderRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): RustBuilderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const computeHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(8, '0')}`;
};

const SUPPORTED_FORMATS: readonly string[] = ['crate', 'static-lib', 'dynamic-lib', 'cdylib', 'rlib'] as const;

const RUST_CAPABILITIES: readonly string[] = [
  'compile',
  'check',
  'clippy',
  'test',
  'doc',
  'feature-flags',
  'cross-compile',
] as const;

const detectFeatureConflicts = (features: readonly string[]): readonly string[] => {
  // Known mutually exclusive feature pairs in common Rust patterns
  const exclusivePairs: readonly (readonly [string, string])[] = [
    ['std', 'no_std'],
    ['sync', 'async'],
    ['blocking', 'non-blocking'],
  ];

  const conflicts: string[] = [];
  for (const [a, b] of exclusivePairs) {
    if (features.includes(a) && features.includes(b)) {
      conflicts.push(a, b);
    }
  }
  return conflicts;
};

// --- Implementation ---

export const rustBuilderHandler: RustBuilderHandler = {
  build: (input, storage) =>
    pipe(
      TE.Do,
      TE.bind('features', () => {
        const featureList = pipe(
          input.config.features,
          O.getOrElse((): readonly string[] => []),
        );
        return TE.right(featureList);
      }),
      TE.chain(({ features }) => {
        // Check for mutually exclusive features
        const conflicts = detectFeatureConflicts(features);
        if (conflicts.length > 0) {
          return TE.right(buildFeatureConflict(conflicts) as RustBuilderBuildOutput);
        }

        // Check for compilation errors from static analysis
        return pipe(
          TE.tryCatch(
            () => storage.find('rust-diagnostics', { source: input.source, severity: 'error' }),
            toStorageError,
          ),
          TE.chain((diagnostics) => {
            if (diagnostics.length > 0) {
              const errors = diagnostics.map((d) => {
                const diag = d as Record<string, unknown>;
                return {
                  file: String(diag.file ?? input.source),
                  line: Number(diag.line ?? 0),
                  message: String(diag.message ?? 'Compilation error'),
                };
              });
              return TE.right(buildCompilationError(errors) as RustBuilderBuildOutput);
            }

            const profile = input.config.mode === 'production' ? 'release' : 'debug';
            const buildId = `rustbuild-${Date.now()}`;
            const artifactPath = `target/${profile}/${buildId}`;
            const artifactHash = computeHash(
              `${input.source}:${input.platform}:${profile}:${features.join(',')}`,
            );

            return pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('builds', buildId, {
                    buildId,
                    source: input.source,
                    toolchainPath: input.toolchainPath,
                    platform: input.platform,
                    config: input.config,
                    features,
                    profile,
                    artifactPath,
                    artifactHash,
                    status: 'completed',
                  });
                  return buildOk(buildId, artifactPath, artifactHash);
                },
                toStorageError,
              ),
            );
          }),
        );
      }),
    ),

  test: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('builds', input.build),
        toStorageError,
      ),
      TE.chain((buildRecord) =>
        pipe(
          O.fromNullable(buildRecord),
          O.fold(
            () => TE.right(testTestFailure(0, 1, [
              { test: 'build-exists', message: `Build '${input.build}' not found` },
            ], 'cargo-test') as RustBuilderTestOutput),
            () => {
              const resolvedTestType = pipe(
                input.testType,
                O.getOrElse(() => 'cargo-test'),
              );
              const startTime = Date.now();

              return pipe(
                TE.tryCatch(
                  () => storage.find('test-results', { build: input.build, testType: resolvedTestType }),
                  toStorageError,
                ),
                TE.map((results) => {
                  const passed = results.filter((r) => (r as Record<string, unknown>).passed === true).length;
                  const failed = results.filter((r) => (r as Record<string, unknown>).passed === false).length;
                  const skipped = results.filter((r) => (r as Record<string, unknown>).skipped === true).length;

                  if (failed > 0) {
                    const failures = results
                      .filter((r) => (r as Record<string, unknown>).passed === false)
                      .map((r) => ({
                        test: String((r as Record<string, unknown>).name ?? 'unknown'),
                        message: String((r as Record<string, unknown>).message ?? 'Test failed'),
                      }));
                    return testTestFailure(passed, failed, failures, resolvedTestType) as RustBuilderTestOutput;
                  }

                  return testOk(passed, failed, skipped, Date.now() - startTime, resolvedTestType) as RustBuilderTestOutput;
                }),
              );
            },
          ),
        ),
      ),
    ),

  package: (input, storage) => {
    if (!SUPPORTED_FORMATS.includes(input.format)) {
      return TE.right(packageFormatUnsupported(input.format));
    }

    return pipe(
      TE.tryCatch(
        () => storage.get('builds', input.build),
        toStorageError,
      ),
      TE.chain((buildRecord) =>
        pipe(
          O.fromNullable(buildRecord),
          O.fold(
            () => TE.right(packageFormatUnsupported(
              `Build '${input.build}' not found`,
            ) as RustBuilderPackageOutput),
            () => {
              const ext = input.format === 'crate' ? '.crate'
                : input.format === 'static-lib' ? '.a'
                : input.format === 'dynamic-lib' ? '.so'
                : input.format === 'cdylib' ? '.so'
                : '.rlib';
              const artifactPath = `packages/${input.build}${ext}`;
              const artifactHash = computeHash(`${input.build}:${input.format}`);

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('packages', `${input.build}:${input.format}`, {
                      build: input.build,
                      format: input.format,
                      artifactPath,
                      artifactHash,
                    });
                    return packageOk(artifactPath, artifactHash);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    );
  },

  register: (_input, _storage) =>
    TE.right(registerOk('rust-builder', 'rust', RUST_CAPABILITIES)),
};
