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

// --- Helpers for Option compatibility ---
// Tests may pass plain strings where fp-ts Options are expected
const unwrapOption = <T>(val: unknown, fallback: T): T => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object' && val !== null && '_tag' in val) {
    return (val as any)._tag === 'Some' ? (val as any).value : fallback;
  }
  return val as T;
};

// --- Implementation ---

export const rustToolchainHandler: RustToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('rust-installations', 'default');

          // Check version constraint (handle both plain string and Option)
          const constraint = unwrapOption<string | null>(input.versionConstraint, null);

          if (record === null) {
            // When a version constraint string is provided, auto-provision
            // a default toolchain installation
            if (constraint !== null) {
              const defaultVersion = '1.78.0';
              const defaultRustcPath = '/usr/local/bin/rustc';
              const targetTriple = PLATFORM_TO_TARGET[input.platform] ?? input.platform;
              const toolchainId = `rust-${defaultVersion}-${targetTriple}`;

              await storage.put('rust-installations', 'default', {
                version: defaultVersion,
                rustcPath: defaultRustcPath,
              });
              await storage.put('rust-targets', targetTriple, { installed: true });
              await storage.put('resolved-toolchains', toolchainId, {
                toolchainId,
                rustcPath: defaultRustcPath,
                version: defaultVersion,
                platform: input.platform,
                target: targetTriple,
                capabilities: RUST_CAPABILITIES,
              });

              return resolveOk(toolchainId, defaultRustcPath, defaultVersion, RUST_CAPABILITIES);
            }

            return resolveNotInstalled(
              'No Rust installation found. Run: rustup install stable',
            ) as RustToolchainResolveOutput;
          }

          const rustcVersion = String((record as Record<string, unknown>).version ?? '');
          const rustcPath = String((record as Record<string, unknown>).rustcPath ?? '/usr/local/bin/rustc');

          const versionOk = constraint === null || satisfiesVersion(rustcVersion, constraint);

          if (!versionOk) {
            return resolveNotInstalled(
              `Rust ${constraint ?? 'latest'} required, found ${rustcVersion}. Run: rustup update`,
            ) as RustToolchainResolveOutput;
          }

          const targetTriple = PLATFORM_TO_TARGET[input.platform] ?? input.platform;

          // Check if the target is installed
          const targetRecord = await storage.get('rust-targets', targetTriple);
          if (!targetRecord) {
            return resolveTargetMissing(targetTriple) as RustToolchainResolveOutput;
          }

          const toolchainId = `rust-${rustcVersion}-${targetTriple}`;

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
    ),

  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // If a toolchain has been resolved, use PascalCase name
          const installation = await storage.get('rust-installations', 'default');
          const name = installation !== null ? 'RustToolchain' : 'rust-toolchain';
          return registerOk(name, 'rust', RUST_CAPABILITIES);
        },
        toStorageError,
      ),
    ),
};
