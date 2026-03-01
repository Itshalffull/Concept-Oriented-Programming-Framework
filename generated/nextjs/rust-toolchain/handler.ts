// RustToolchain — Rust toolchain detection and management: rustc/cargo version resolution,
// compilation target installation checking, Cargo.toml validation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RustToolchainStorage,
  RustToolchainResolveInput,
  RustToolchainResolveOutput,
  RustToolchainRegisterInput,
  RustToolchainRegisterOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotInstalled,
  resolveTargetMissing,
  registerOk,
} from './types.js';

export interface RustToolchainError {
  readonly code: string;
  readonly message: string;
}

export interface RustToolchainHandler {
  readonly resolve: (
    input: RustToolchainResolveInput,
    storage: RustToolchainStorage,
  ) => TE.TaskEither<RustToolchainError, RustToolchainResolveOutput>;
  readonly register: (
    input: RustToolchainRegisterInput,
    storage: RustToolchainStorage,
  ) => TE.TaskEither<RustToolchainError, RustToolchainRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): RustToolchainError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const RUST_CAPABILITIES: readonly string[] = [
  'compile',
  'check',
  'clippy',
  'fmt',
  'doc',
  'test',
  'cross-compile',
  'miri',
] as const;

// Map platform identifiers to rustc target triples
const PLATFORM_TO_TARGET: Record<string, string> = {
  'linux-x86_64': 'x86_64-unknown-linux-gnu',
  'linux-aarch64': 'aarch64-unknown-linux-gnu',
  'darwin-x86_64': 'x86_64-apple-darwin',
  'darwin-aarch64': 'aarch64-apple-darwin',
  'windows-x86_64': 'x86_64-pc-windows-msvc',
  'wasm32': 'wasm32-unknown-unknown',
  'wasm32-wasi': 'wasm32-wasi',
};

const satisfiesVersion = (installed: string, required: string): boolean => {
  const iParts = installed.split('.').map(Number);
  const rParts = required.replace(/[>=<^~]/g, '').split('.').map(Number);
  for (let i = 0; i < rParts.length; i++) {
    if ((iParts[i] ?? 0) < (rParts[i] ?? 0)) return false;
    if ((iParts[i] ?? 0) > (rParts[i] ?? 0)) return true;
  }
  return true;
};

// --- Implementation ---

export const rustToolchainHandler: RustToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rust-installations', 'default'),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotInstalled(
              'Install Rust: curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh',
            ) as RustToolchainResolveOutput),
            (rec) => {
              const rustcVersion = String((rec as Record<string, unknown>).version ?? '0.0.0');
              const rustcPath = String((rec as Record<string, unknown>).rustcPath ?? 'rustc');

              // Check version constraint
              const versionOk = pipe(
                input.versionConstraint,
                O.fold(
                  () => true,
                  (constraint) => satisfiesVersion(rustcVersion, constraint),
                ),
              );

              if (!versionOk) {
                return TE.right(resolveNotInstalled(
                  `Rust ${pipe(input.versionConstraint, O.getOrElse(() => 'latest'))} required, found ${rustcVersion}. Run: rustup update`,
                ) as RustToolchainResolveOutput);
              }

              // Check if the compilation target is installed
              const targetTriple = PLATFORM_TO_TARGET[input.platform] ?? input.platform;

              return pipe(
                TE.tryCatch(
                  () => storage.get('rust-targets', targetTriple),
                  toStorageError,
                ),
                TE.chain((targetRecord) =>
                  pipe(
                    O.fromNullable(targetRecord),
                    O.fold(
                      () => TE.right(resolveTargetMissing(
                        targetTriple,
                        `rustup target add ${targetTriple}`,
                      ) as RustToolchainResolveOutput),
                      () => {
                        const toolchainId = `rust-${rustcVersion}-${targetTriple}`;

                        return pipe(
                          TE.tryCatch(
                            async () => {
                              await storage.put('resolved-toolchains', toolchainId, {
                                toolchainId,
                                rustcPath,
                                version: rustcVersion,
                                platform: input.platform,
                                target: targetTriple,
                                capabilities: RUST_CAPABILITIES,
                              });
                              return resolveOk(toolchainId, rustcPath, rustcVersion, RUST_CAPABILITIES);
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
          ),
        ),
      ),
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('rust-toolchain', 'rust', RUST_CAPABILITIES)),
};
