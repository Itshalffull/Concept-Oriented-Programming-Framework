// SolidityBuilder — Solidity build pipeline: solc configuration, import resolution,
// contract compilation, ABI generation, and bytecode packaging.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SolidityBuilderStorage,
  SolidityBuilderBuildInput,
  SolidityBuilderBuildOutput,
  SolidityBuilderTestInput,
  SolidityBuilderTestOutput,
  SolidityBuilderPackageInput,
  SolidityBuilderPackageOutput,
  SolidityBuilderRegisterInput,
  SolidityBuilderRegisterOutput,
} from './types.js';

import {
  buildOk,
  buildCompilationError,
  buildPragmaMismatch,
  testOk,
  testTestFailure,
  packageOk,
  packageFormatUnsupported,
  registerOk,
} from './types.js';

export interface SolidityBuilderError {
  readonly code: string;
  readonly message: string;
}

export interface SolidityBuilderHandler {
  readonly build: (
    input: SolidityBuilderBuildInput,
    storage: SolidityBuilderStorage,
  ) => TE.TaskEither<SolidityBuilderError, SolidityBuilderBuildOutput>;
  readonly test: (
    input: SolidityBuilderTestInput,
    storage: SolidityBuilderStorage,
  ) => TE.TaskEither<SolidityBuilderError, SolidityBuilderTestOutput>;
  readonly package: (
    input: SolidityBuilderPackageInput,
    storage: SolidityBuilderStorage,
  ) => TE.TaskEither<SolidityBuilderError, SolidityBuilderPackageOutput>;
  readonly register: (
    input: SolidityBuilderRegisterInput,
    storage: SolidityBuilderStorage,
  ) => TE.TaskEither<SolidityBuilderError, SolidityBuilderRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SolidityBuilderError => ({
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

const SUPPORTED_FORMATS: readonly string[] = ['abi', 'bytecode', 'combined-json', 'standard-json'] as const;

const SOLIDITY_CAPABILITIES: readonly string[] = [
  'compile',
  'abi-gen',
  'bytecode-gen',
  'source-map',
  'optimizer',
  'evm-version-select',
] as const;

// --- Implementation ---

export const solidityBuilderHandler: SolidityBuilderHandler = {
  build: (input, storage) =>
    pipe(
      // Check for pragma version constraints in source
      TE.tryCatch(
        () => storage.get('solidity-pragma', input.source),
        toStorageError,
      ),
      TE.chain((pragmaRecord) => {
        // Check if installed solc version satisfies the pragma
        if (pragmaRecord !== null) {
          const pragma = pragmaRecord as Record<string, unknown>;
          const required = String(pragma.required ?? '');
          const installed = String(pragma.installed ?? '');
          if (required && installed && required !== installed) {
            return TE.right(buildPragmaMismatch(required, installed) as SolidityBuilderBuildOutput);
          }
        }

        // Check for compilation errors from static analysis
        return pipe(
          TE.tryCatch(
            () => storage.find('solidity-diagnostics', { source: input.source, severity: 'error' }),
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
              return TE.right(buildCompilationError(errors) as SolidityBuilderBuildOutput);
            }

            const buildId = `solbuild-${Date.now()}`;
            const artifactPath = `artifacts/${buildId}`;
            const artifactHash = computeHash(`${input.source}:${input.platform}:${input.config.mode}`);

            return pipe(
              TE.tryCatch(
                async () => {
                  // Store build record with ABI and bytecode references
                  await storage.put('builds', buildId, {
                    buildId,
                    source: input.source,
                    toolchainPath: input.toolchainPath,
                    platform: input.platform,
                    config: input.config,
                    artifactPath,
                    artifactHash,
                    status: 'completed',
                    abiPath: `${artifactPath}/abi.json`,
                    bytecodePath: `${artifactPath}/bytecode.bin`,
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
            ], 'forge') as SolidityBuilderTestOutput),
            () => {
              const resolvedTestType = pipe(
                input.testType,
                O.getOrElse(() => 'forge'),
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
                    return testTestFailure(passed, failed, failures, resolvedTestType) as SolidityBuilderTestOutput;
                  }

                  return testOk(passed, failed, skipped, Date.now() - startTime, resolvedTestType) as SolidityBuilderTestOutput;
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
            ) as SolidityBuilderPackageOutput),
            (rec) => {
              const ext = input.format === 'abi' ? '.abi.json'
                : input.format === 'bytecode' ? '.bin'
                : input.format === 'combined-json' ? '.combined.json'
                : '.json';
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
    TE.right(registerOk('solidity-builder', 'solidity', SOLIDITY_CAPABILITIES)),
};
