// SwiftBuilder — Swift Package Manager build pipeline: SPM configuration, dependency
// resolution, target compilation, and framework/library packaging.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SwiftBuilderStorage,
  SwiftBuilderBuildInput,
  SwiftBuilderBuildOutput,
  SwiftBuilderTestInput,
  SwiftBuilderTestOutput,
  SwiftBuilderPackageInput,
  SwiftBuilderPackageOutput,
  SwiftBuilderRegisterInput,
  SwiftBuilderRegisterOutput,
} from './types.js';

import {
  buildOk,
  buildCompilationError,
  buildLinkerError,
  testOk,
  testTestFailure,
  packageOk,
  packageFormatUnsupported,
  registerOk,
} from './types.js';

export interface SwiftBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface SwiftBuilderHandler {
  readonly build: (
    input: SwiftBuilderBuildInput,
    storage: SwiftBuilderStorage,
  ) => TE.TaskEither<SwiftBuilderError, SwiftBuilderBuildOutput>;
  readonly test: (
    input: SwiftBuilderTestInput,
    storage: SwiftBuilderStorage,
  ) => TE.TaskEither<SwiftBuilderError, SwiftBuilderTestOutput>;
  readonly package: (
    input: SwiftBuilderPackageInput,
    storage: SwiftBuilderStorage,
  ) => TE.TaskEither<SwiftBuilderError, SwiftBuilderPackageOutput>;
  readonly register: (
    input: SwiftBuilderRegisterInput,
    storage: SwiftBuilderStorage,
  ) => TE.TaskEither<SwiftBuilderError, SwiftBuilderRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SwiftBuilderError => ({
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

const SUPPORTED_FORMATS: readonly string[] = ['xcframework', 'swiftpm', 'static-lib', 'dynamic-lib'] as const;

const SWIFT_CAPABILITIES: readonly string[] = [
  'compile',
  'link',
  'test',
  'package-resolve',
  'module-emit',
  'debug-info',
] as const;

// --- Implementation ---

export const swiftBuilderHandler: SwiftBuilderHandler = {
  build: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('swift-diagnostics', { source: input.source, severity: 'error' }),
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
          return TE.right(buildCompilationError(errors) as SwiftBuilderBuildOutput);
        }

        // Check for linker dependencies
        return pipe(
          TE.tryCatch(
            () => storage.find('swift-link-deps', { source: input.source }),
            toStorageError,
          ),
          TE.chain((linkDeps) => {
            const missingDeps = linkDeps.filter(
              (d) => (d as Record<string, unknown>).resolved !== true,
            );

            if (missingDeps.length > 0) {
              const names = missingDeps
                .map((d) => String((d as Record<string, unknown>).name ?? 'unknown'))
                .join(', ');
              return TE.right(buildLinkerError(
                `Unresolved link dependencies: ${names}`,
              ) as SwiftBuilderBuildOutput);
            }

            const buildId = `swiftbuild-${Date.now()}`;
            const artifactPath = `.build/${input.config.mode}/${buildId}`;
            const artifactHash = computeHash(`${input.source}:${input.platform}:${input.config.mode}`);

            return pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('builds', buildId, {
                    buildId,
                    source: input.source,
                    toolchainPath: input.toolchainPath,
                    platform: input.platform,
                    config: input.config,
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
            ], 'xctest') as SwiftBuilderTestOutput),
            () => {
              const resolvedTestType = pipe(
                input.testType,
                O.getOrElse(() => 'xctest'),
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
                    return testTestFailure(passed, failed, failures, resolvedTestType) as SwiftBuilderTestOutput;
                  }

                  return testOk(passed, failed, skipped, Date.now() - startTime, resolvedTestType) as SwiftBuilderTestOutput;
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
            ) as SwiftBuilderPackageOutput),
            () => {
              const ext = input.format === 'xcframework' ? '.xcframework'
                : input.format === 'static-lib' ? '.a'
                : input.format === 'dynamic-lib' ? '.dylib'
                : '.swift';
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
    TE.right(registerOk('swift-builder', 'swift', SWIFT_CAPABILITIES)),
};
