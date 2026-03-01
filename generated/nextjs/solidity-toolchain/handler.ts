// SolidityToolchain — Solidity compiler toolchain detection and management: solc version
// resolution, EVM version compatibility, import remapping configuration.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SolidityToolchainStorage,
  SolidityToolchainResolveInput,
  SolidityToolchainResolveOutput,
  SolidityToolchainRegisterInput,
  SolidityToolchainRegisterOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotInstalled,
  resolveEvmVersionUnsupported,
  registerOk,
} from './types.js';

export interface SolidityToolchainError {
  readonly code: string;
  readonly message: string;
}

export interface SolidityToolchainHandler {
  readonly resolve: (
    input: SolidityToolchainResolveInput,
    storage: SolidityToolchainStorage,
  ) => TE.TaskEither<SolidityToolchainError, SolidityToolchainResolveOutput>;
  readonly register: (
    input: SolidityToolchainRegisterInput,
    storage: SolidityToolchainStorage,
  ) => TE.TaskEither<SolidityToolchainError, SolidityToolchainRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SolidityToolchainError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SOLIDITY_CAPABILITIES: readonly string[] = [
  'compile',
  'abi-gen',
  'optimizer',
  'evm-version-select',
  'metadata',
  'ir-output',
] as const;

const SUPPORTED_EVM_VERSIONS: readonly string[] = [
  'homestead', 'tangerineWhistle', 'spuriousDragon', 'byzantium',
  'constantinople', 'petersburg', 'istanbul', 'berlin', 'london',
  'paris', 'shanghai', 'cancun',
] as const;

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

export const solidityToolchainHandler: SolidityToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('solidity-installations', input.platform),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotInstalled(
              'Install solc: npm install -g solc, or use solc-select for version management',
            ) as SolidityToolchainResolveOutput),
            (rec) => {
              const solcVersion = String((rec as Record<string, unknown>).version ?? '0.0.0');
              const solcPath = String((rec as Record<string, unknown>).solcPath ?? 'solc');

              // Check version constraint
              const versionOk = pipe(
                input.versionConstraint,
                O.fold(
                  () => true,
                  (constraint) => satisfiesVersion(solcVersion, constraint),
                ),
              );

              if (!versionOk) {
                return TE.right(resolveNotInstalled(
                  `solc ${pipe(input.versionConstraint, O.getOrElse(() => 'latest'))} required, found ${solcVersion}. Use: solc-select install ${pipe(input.versionConstraint, O.getOrElse(() => 'latest'))}`,
                ) as SolidityToolchainResolveOutput);
              }

              // Check EVM version compatibility based on the platform field
              // (platform doubles as EVM target for Solidity)
              if (input.platform !== 'evm' && !SUPPORTED_EVM_VERSIONS.includes(input.platform)) {
                return TE.right(resolveEvmVersionUnsupported(
                  input.platform,
                  SUPPORTED_EVM_VERSIONS,
                ) as SolidityToolchainResolveOutput);
              }

              const toolchainId = `solc-${solcVersion}`;

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('resolved-toolchains', toolchainId, {
                      toolchainId,
                      solcPath,
                      version: solcVersion,
                      platform: input.platform,
                      capabilities: SOLIDITY_CAPABILITIES,
                    });
                    return resolveOk(toolchainId, solcPath, solcVersion, SOLIDITY_CAPABILITIES);
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
    TE.right(registerOk('solidity-toolchain', 'solidity', SOLIDITY_CAPABILITIES)),
};
