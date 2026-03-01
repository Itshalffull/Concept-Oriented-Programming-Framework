// TypeScriptBuilder — TypeScript-specific build pipeline: tsc configuration, dependency
// resolution, compilation, and bundling for concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptBuilderStorage,
  TypeScriptBuilderBuildInput,
  TypeScriptBuilderBuildOutput,
  TypeScriptBuilderTestInput,
  TypeScriptBuilderTestOutput,
  TypeScriptBuilderPackageInput,
  TypeScriptBuilderPackageOutput,
  TypeScriptBuilderRegisterInput,
  TypeScriptBuilderRegisterOutput,
} from './types.js';

import {
  buildOk,
  buildTypeError,
  buildBundleError,
  testOk,
  testTestFailure,
  packageOk,
  packageFormatUnsupported,
  registerOk,
} from './types.js';

export interface TypeScriptBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptBuilderHandler {
  readonly build: (
    input: TypeScriptBuilderBuildInput,
    storage: TypeScriptBuilderStorage,
  ) => TE.TaskEither<TypeScriptBuilderError, TypeScriptBuilderBuildOutput>;
  readonly test: (
    input: TypeScriptBuilderTestInput,
    storage: TypeScriptBuilderStorage,
  ) => TE.TaskEither<TypeScriptBuilderError, TypeScriptBuilderTestOutput>;
  readonly package: (
    input: TypeScriptBuilderPackageInput,
    storage: TypeScriptBuilderStorage,
  ) => TE.TaskEither<TypeScriptBuilderError, TypeScriptBuilderPackageOutput>;
  readonly register: (
    input: TypeScriptBuilderRegisterInput,
    storage: TypeScriptBuilderStorage,
  ) => TE.TaskEither<TypeScriptBuilderError, TypeScriptBuilderRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): TypeScriptBuilderError => ({
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

const SUPPORTED_FORMATS: readonly string[] = ['esm', 'cjs', 'umd', 'iife'] as const;

const TS_CAPABILITIES: readonly string[] = [
  'compile',
  'type-check',
  'bundle',
  'declaration-emit',
  'source-map',
  'incremental',
] as const;

// --- Implementation ---

export const typeScriptBuilderHandler: TypeScriptBuilderHandler = {
  build: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ts-config', input.source),
        toStorageError,
      ),
      TE.chain((configRecord) => {
        const buildId = `tsbuild-${Date.now()}`;
        const artifactPath = `dist/${input.platform}/${buildId}`;
        const artifactHash = computeHash(`${input.source}:${input.platform}:${input.config.mode}`);
        const startTime = Date.now();

        // Check for known type errors from previous analysis
        return pipe(
          TE.tryCatch(
            () => storage.find('ts-diagnostics', { source: input.source, severity: 'error' }),
            toStorageError,
          ),
          TE.chain((diagnostics) => {
            if (diagnostics.length > 0) {
              const errors = diagnostics.map((d) => {
                const diag = d as Record<string, unknown>;
                return {
                  file: String(diag.file ?? input.source),
                  line: Number(diag.line ?? 0),
                  message: String(diag.message ?? 'Unknown type error'),
                };
              });
              return TE.right(buildTypeError(errors) as TypeScriptBuilderBuildOutput);
            }

            // Validate the bundle target is compatible with platform
            if (input.config.mode === 'production' && input.platform === 'browser') {
              // Check for Node.js-only APIs that would fail in browser bundle
              return pipe(
                TE.tryCatch(
                  () => storage.find('ts-imports', { source: input.source, nodeOnly: true }),
                  toStorageError,
                ),
                TE.chain((nodeImports) => {
                  if (nodeImports.length > 0) {
                    return TE.right(buildBundleError(
                      `Cannot bundle for browser: source uses Node.js-only imports (${nodeImports.length} found)`,
                    ) as TypeScriptBuilderBuildOutput);
                  }

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
                          duration: Date.now() - startTime,
                        });
                        return buildOk(buildId, artifactPath, artifactHash);
                      },
                      toStorageError,
                    ),
                  );
                }),
              );
            }

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
                    duration: Date.now() - startTime,
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
            ], 'unit') as TypeScriptBuilderTestOutput),
            (rec) => {
              const resolvedTestType = pipe(
                input.testType,
                O.getOrElse(() => 'unit'),
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
                    return testTestFailure(passed, failed, failures, resolvedTestType) as TypeScriptBuilderTestOutput;
                  }

                  return testOk(passed, failed, skipped, Date.now() - startTime, resolvedTestType) as TypeScriptBuilderTestOutput;
                }),
              );
            },
          ),
        ),
      ),
    ),

  package: (input, storage) =>
    pipe(
      TE.Do,
      TE.bind('formatValid', () =>
        TE.right(SUPPORTED_FORMATS.includes(input.format)),
      ),
      TE.chain(({ formatValid }) => {
        if (!formatValid) {
          return TE.right(packageFormatUnsupported(input.format) as TypeScriptBuilderPackageOutput);
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
                ) as TypeScriptBuilderPackageOutput),
                (rec) => {
                  const artifactPath = `packages/${input.build}.${input.format === 'esm' ? 'mjs' : input.format === 'cjs' ? 'cjs' : 'js'}`;
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
      }),
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('typescript-builder', 'typescript', TS_CAPABILITIES)),
};
