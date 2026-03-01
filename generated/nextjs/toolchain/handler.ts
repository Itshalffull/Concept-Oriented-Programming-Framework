// Toolchain — Language-agnostic toolchain management, detection, selection, and configuration
// Routes resolution requests to language-specific toolchain providers.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ToolchainStorage,
  ToolchainResolveInput,
  ToolchainResolveOutput,
  ToolchainValidateInput,
  ToolchainValidateOutput,
  ToolchainListInput,
  ToolchainListOutput,
  ToolchainCapabilitiesInput,
  ToolchainCapabilitiesOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotInstalled,
  resolveVersionMismatch,
  resolvePlatformUnsupported,
  validateOk,
  validateInvalid,
  listOk,
  capabilitiesOk,
} from './types.js';

export interface ToolchainError {
  readonly code: string;
  readonly message: string;
}

export interface ToolchainHandler {
  readonly resolve: (
    input: ToolchainResolveInput,
    storage: ToolchainStorage,
  ) => TE.TaskEither<ToolchainError, ToolchainResolveOutput>;
  readonly validate: (
    input: ToolchainValidateInput,
    storage: ToolchainStorage,
  ) => TE.TaskEither<ToolchainError, ToolchainValidateOutput>;
  readonly list: (
    input: ToolchainListInput,
    storage: ToolchainStorage,
  ) => TE.TaskEither<ToolchainError, ToolchainListOutput>;
  readonly capabilities: (
    input: ToolchainCapabilitiesInput,
    storage: ToolchainStorage,
  ) => TE.TaskEither<ToolchainError, ToolchainCapabilitiesOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): ToolchainError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SUPPORTED_PLATFORMS: Record<string, readonly string[]> = {
  typescript: ['node', 'browser', 'deno', 'bun'],
  rust: ['linux-x86_64', 'linux-aarch64', 'darwin-x86_64', 'darwin-aarch64', 'windows-x86_64'],
  swift: ['darwin-x86_64', 'darwin-aarch64', 'linux-x86_64', 'linux-aarch64'],
  solidity: ['evm'],
};

const satisfiesVersion = (installed: string, constraint: string): boolean => {
  const installedParts = installed.split('.').map(Number);
  const constraintParts = constraint.replace(/[>=<^~]/g, '').split('.').map(Number);
  for (let i = 0; i < constraintParts.length; i++) {
    if ((installedParts[i] ?? 0) < (constraintParts[i] ?? 0)) return false;
    if ((installedParts[i] ?? 0) > (constraintParts[i] ?? 0)) return true;
  }
  return true;
};

// --- Implementation ---

export const toolchainHandler: ToolchainHandler = {
  resolve: (input, storage) =>
    pipe(
      TE.Do,
      TE.bind('platformCheck', () => {
        const supported = SUPPORTED_PLATFORMS[input.language];
        if (!supported || !supported.includes(input.platform)) {
          return TE.right({ supported: false as const });
        }
        return TE.right({ supported: true as const });
      }),
      TE.chain(({ platformCheck }) => {
        if (!platformCheck.supported) {
          return TE.right(resolvePlatformUnsupported(input.language, input.platform));
        }

        const toolKey = pipe(
          input.toolName,
          O.getOrElse(() => `${input.language}-default`),
        );

        return pipe(
          TE.tryCatch(
            () => storage.get('toolchains', `${input.language}:${toolKey}`),
            toStorageError,
          ),
          TE.chain((record) =>
            pipe(
              O.fromNullable(record),
              O.fold(
                () => {
                  const hints: Record<string, string> = {
                    typescript: 'npm install -g typescript',
                    rust: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh',
                    swift: 'Install Xcode or swift toolchain from swift.org',
                    solidity: 'npm install -g solc',
                  };
                  return TE.right(resolveNotInstalled(
                    input.language,
                    input.platform,
                    hints[input.language] ?? `Install ${input.language} toolchain`,
                  ) as ToolchainResolveOutput);
                },
                (rec) => {
                  const installedVersion = String((rec as Record<string, unknown>).version ?? '0.0.0');

                  const versionOk = pipe(
                    input.versionConstraint,
                    O.fold(
                      () => true,
                      (constraint) => satisfiesVersion(installedVersion, constraint),
                    ),
                  );

                  if (!versionOk) {
                    return TE.right(resolveVersionMismatch(
                      input.language,
                      installedVersion,
                      pipe(input.versionConstraint, O.getOrElse(() => 'latest')),
                    ) as ToolchainResolveOutput);
                  }

                  const toolPath = String((rec as Record<string, unknown>).path ?? `/usr/local/bin/${input.language}`);
                  const caps = (rec as Record<string, unknown>).capabilities as readonly string[] ?? ['compile', 'check'];
                  const command = String((rec as Record<string, unknown>).command ?? input.language);

                  return TE.right(resolveOk(
                    toolKey,
                    installedVersion,
                    toolPath,
                    caps,
                    {
                      command,
                      args: ['--target', input.platform],
                      outputFormat: 'json',
                      configFile: O.none,
                      env: O.none,
                    },
                  ) as ToolchainResolveOutput);
                },
              ),
            ),
          ),
        );
      }),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('toolchains', input.tool),
        toStorageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => validateInvalid(input.tool, `Toolchain '${input.tool}' not found in registry`),
            (rec) => {
              const version = String((rec as Record<string, unknown>).version ?? 'unknown');
              return validateOk(input.tool, version);
            },
          ),
        ),
      ),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('toolchains'),
        toStorageError,
      ),
      TE.map((records) => {
        const filtered = records.filter((rec) => {
          const r = rec as Record<string, unknown>;
          const langMatch = pipe(
            input.language,
            O.fold(
              () => true,
              (lang) => String(r.language ?? '') === lang,
            ),
          );
          const catMatch = pipe(
            input.category,
            O.fold(
              () => true,
              (cat) => String(r.category ?? '') === cat,
            ),
          );
          return langMatch && catMatch;
        });

        const tools = filtered.map((rec) => {
          const r = rec as Record<string, unknown>;
          return {
            language: String(r.language ?? ''),
            platform: String(r.platform ?? ''),
            category: String(r.category ?? 'compiler'),
            toolName: O.fromNullable(r.toolName as string | null),
            version: String(r.version ?? '0.0.0'),
            path: String(r.path ?? ''),
            command: String(r.command ?? ''),
            status: String(r.status ?? 'available'),
          };
        });

        return listOk(tools);
      }),
    ),

  capabilities: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('toolchains', input.tool),
        toStorageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => capabilitiesOk([]),
            (rec) => {
              const caps = (rec as Record<string, unknown>).capabilities;
              return capabilitiesOk(
                Array.isArray(caps) ? caps.map(String) : [],
              );
            },
          ),
        ),
      ),
    ),
};
