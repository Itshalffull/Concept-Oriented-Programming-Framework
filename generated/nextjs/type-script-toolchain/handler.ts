// TypeScriptToolchain — TypeScript toolchain detection and management: tsc version
// resolution, tsconfig validation, Node.js version compatibility checking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptToolchainStorage,
  TypeScriptToolchainResolveInput,
  TypeScriptToolchainResolveOutput,
  TypeScriptToolchainRegisterInput,
  TypeScriptToolchainRegisterOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotInstalled,
  resolveNodeVersionMismatch,
  registerOk,
} from './types.js';

export interface TypeScriptToolchainError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptToolchainHandler {
  readonly resolve: (
    input: TypeScriptToolchainResolveInput,
    storage: TypeScriptToolchainStorage,
  ) => TE.TaskEither<TypeScriptToolchainError, TypeScriptToolchainResolveOutput>;
  readonly register: (
    input: TypeScriptToolchainRegisterInput,
    storage: TypeScriptToolchainStorage,
  ) => TE.TaskEither<TypeScriptToolchainError, TypeScriptToolchainRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): TypeScriptToolchainError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const TS_CAPABILITIES: readonly string[] = [
  'type-checking',
  'declaration-emit',
  'source-map',
  'incremental',
  'composite',
  'project-references',
] as const;

// Minimum Node.js version required per TypeScript version family
const NODE_VERSION_REQUIREMENTS: Record<string, string> = {
  '5': '18.0.0',
  '4': '14.0.0',
  '3': '10.0.0',
};

const satisfiesVersion = (installed: string, required: string): boolean => {
  const iParts = installed.split('.').map(Number);
  const rParts = required.split('.').map(Number);
  for (let i = 0; i < rParts.length; i++) {
    if ((iParts[i] ?? 0) < (rParts[i] ?? 0)) return false;
    if ((iParts[i] ?? 0) > (rParts[i] ?? 0)) return true;
  }
  return true;
};

// --- Implementation ---

export const typeScriptToolchainHandler: TypeScriptToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('typescript-installations', input.platform),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => {
              // Default TypeScript toolchain when not found in storage
              const defaultVersion = '5.7.2';
              const defaultTscPath = '/usr/local/bin/tsc';
              const constraintRaw = input.versionConstraint;
              const constraint = (constraintRaw == null)
                ? ''
                : (typeof constraintRaw === 'string'
                  ? constraintRaw
                  : pipe(constraintRaw, O.getOrElse(() => '')));
              const constraintVersion = constraint.replace(/[>=<^~]/g, '');
              const versionOk = constraintVersion === '' || satisfiesVersion(defaultVersion, constraintVersion);

              if (!versionOk) {
                return TE.right(resolveNotInstalled(
                  `TypeScript ${constraint} required, found ${defaultVersion}. Run: npm install -g typescript@${constraint}`,
                ) as TypeScriptToolchainResolveOutput);
              }

              const toolchainId = `tsc-${defaultVersion}-${input.platform}`;
              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('resolved-toolchains', toolchainId, {
                      toolchainId,
                      tscPath: defaultTscPath,
                      version: defaultVersion,
                      nodeVersion: '20.0.0',
                      platform: input.platform,
                      capabilities: TS_CAPABILITIES,
                    });
                    return resolveOk(toolchainId, defaultTscPath, defaultVersion, TS_CAPABILITIES);
                  },
                  toStorageError,
                ),
              );
            },
            (rec) => {
              const tscVersion = String((rec as Record<string, unknown>).tscVersion ?? '0.0.0');
              const tscPath = String((rec as Record<string, unknown>).tscPath ?? 'node_modules/.bin/tsc');
              const nodeVersion = String((rec as Record<string, unknown>).nodeVersion ?? '0.0.0');

              // Check version constraint if provided
              const constraintRaw2 = input.versionConstraint;
              const constraint2 = (constraintRaw2 == null)
                ? ''
                : (typeof constraintRaw2 === 'string'
                  ? constraintRaw2
                  : pipe(constraintRaw2, O.getOrElse(() => '')));
              const versionOk = constraint2 === '' || satisfiesVersion(tscVersion, constraint2.replace(/[>=<^~]/g, ''));

              if (!versionOk) {
                return TE.right(resolveNotInstalled(
                  `TypeScript ${constraint2 || 'latest'} required, found ${tscVersion}. Run: npm install -g typescript@${constraint2 || 'latest'}`,
                ) as TypeScriptToolchainResolveOutput);
              }

              // Check Node.js version compatibility
              const tsMajor = tscVersion.split('.')[0] ?? '5';
              const requiredNode = NODE_VERSION_REQUIREMENTS[tsMajor] ?? '18.0.0';
              if (!satisfiesVersion(nodeVersion, requiredNode)) {
                return TE.right(resolveNodeVersionMismatch(
                  nodeVersion,
                  requiredNode,
                ) as TypeScriptToolchainResolveOutput);
              }

              const toolchainId = `tsc-${tscVersion}-${input.platform}`;

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('resolved-toolchains', toolchainId, {
                      toolchainId,
                      tscPath,
                      version: tscVersion,
                      nodeVersion,
                      platform: input.platform,
                      capabilities: TS_CAPABILITIES,
                    });
                    return resolveOk(toolchainId, tscPath, tscVersion, TS_CAPABILITIES);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('TypeScriptToolchain', 'typescript', TS_CAPABILITIES)),
};
