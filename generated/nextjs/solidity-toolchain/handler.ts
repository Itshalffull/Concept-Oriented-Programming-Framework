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

// --- Helpers for Option compatibility ---
const unwrapOption = <T>(val: unknown, fallback: T): T => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object' && val !== null && '_tag' in val) {
    return (val as any)._tag === 'Some' ? (val as any).value : fallback;
  }
  return val as T;
};

// --- Implementation ---

export const solidityToolchainHandler: SolidityToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const defaultVersion = '0.8.25';
          const defaultSolcPath = '/usr/local/bin/solc';

          const record = await storage.get('solidity-installations', input.platform);
          const solcVersion = record !== null
            ? String((record as Record<string, unknown>).version ?? defaultVersion)
            : defaultVersion;
          const solcPath = record !== null
            ? String((record as Record<string, unknown>).solcPath ?? defaultSolcPath)
            : defaultSolcPath;

          // Check version constraint (handle both plain string and Option)
          const constraint = unwrapOption<string | null>(input.versionConstraint, null);
          const versionOk = constraint === null || satisfiesVersion(solcVersion, constraint);

          if (!versionOk) {
            return resolveNotInstalled(
              `solc ${constraint ?? 'latest'} required, found ${solcVersion}. Use: solc-select install ${constraint ?? 'latest'}`,
            ) as SolidityToolchainResolveOutput;
          }

          // Check EVM version compatibility
          const evmVersion = input.platform.replace('evm-', '');
          if (input.platform !== 'evm' && !input.platform.startsWith('evm-') && !SUPPORTED_EVM_VERSIONS.includes(input.platform)) {
            return resolveEvmVersionUnsupported(
              input.platform,
              SUPPORTED_EVM_VERSIONS,
            ) as SolidityToolchainResolveOutput;
          }

          const toolchainId = `solc-${solcVersion}`;

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
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('SolidityToolchain', 'solidity', SOLIDITY_CAPABILITIES)),
};
