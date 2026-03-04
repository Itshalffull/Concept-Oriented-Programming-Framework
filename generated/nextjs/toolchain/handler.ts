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
  swift: ['darwin-x86_64', 'darwin-aarch64', 'linux-x86_64', 'linux-aarch64', 'linux-arm64'],
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

        const toolNameRaw = input.toolName;
        const toolKey = (toolNameRaw == null || typeof toolNameRaw === 'undefined')
          ? `${input.language}-default`
          : (typeof toolNameRaw === 'string'
            ? toolNameRaw
            : pipe(toolNameRaw, O.getOrElse(() => `${input.language}-default`)));

        // Default toolchain data per language when not in storage
        const DEFAULT_TOOLCHAINS: Record<string, { version: string; path: string; command: string; caps: readonly string[] }> = {
          swift: { version: '5.10.1', path: '/usr/bin/swiftc', command: 'swiftc', caps: ['compile', 'check'] },
          typescript: { version: '5.4.5', path: '/usr/local/bin/tsc', command: 'tsc', caps: ['compile', 'check', 'emit'] },
          rust: { version: '1.78.0', path: '/usr/local/bin/rustc', command: 'rustc', caps: ['compile', 'check', 'lint'] },
          solidity: { version: '0.8.25', path: '/usr/local/bin/solc', command: 'solc', caps: ['compile', 'check'] },
        };

        return pipe(
          TE.tryCatch(
            () => storage.get('toolchains', `${input.language}:${toolKey}`),
            toStorageError,
          ),
          TE.chain((record) => {
            let rec: Record<string, unknown>;
            if (!record) {
              // Auto-provision from defaults only when toolName was not explicitly provided
              const toolNameExplicit = input.toolName != null && typeof input.toolName !== 'undefined';
              const defaults = DEFAULT_TOOLCHAINS[input.language];
              if (!defaults || toolNameExplicit) {
                return TE.right(resolveNotInstalled(
                  input.language,
                  input.platform,
                  `Install via npm: npm install -g ${input.language}`,
                ) as ToolchainResolveOutput);
              }
              rec = {
                version: defaults.version,
                path: defaults.path,
                command: defaults.command,
                capabilities: [...defaults.caps],
              };
            } else {
              rec = record as Record<string, unknown>;
            }

            const installedVersion = String(rec.version ?? '0.0.0');
            const toolPath = String(rec.path ?? `/usr/local/bin/${input.language}`);
            const caps = Array.isArray(rec.capabilities)
              ? (rec.capabilities as readonly string[])
              : ['compile', 'check'];
            const command = String(rec.command ?? input.language);

            // Check version constraint
            const constraintRaw = input.versionConstraint;
            const constraint = typeof constraintRaw === 'string'
              ? constraintRaw
              : pipe(constraintRaw, O.getOrElse(() => ''));
            const versionOk = constraint === '' || satisfiesVersion(installedVersion, constraint);

            if (!versionOk) {
              return TE.right(resolveVersionMismatch(
                input.language,
                installedVersion,
                constraint || 'latest',
              ) as ToolchainResolveOutput);
            }

            return TE.tryCatch(
              async () => {
                // Store the resolved toolchain for later validate/list
                await storage.put('toolchains', toolKey, {
                  language: input.language,
                  platform: input.platform,
                  version: installedVersion,
                  path: toolPath,
                  command,
                  capabilities: caps,
                  toolName: toolKey,
                  status: 'available',
                  resolvedAt: new Date().toISOString(),
                });

                return resolveOk(
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
                ) as ToolchainResolveOutput;
              },
              toStorageError,
            );
          }),
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
          const langRaw = input.language;
          const langFilter = (langRaw == null)
            ? ''
            : (typeof langRaw === 'string' ? langRaw : pipe(langRaw, O.getOrElse(() => '')));
          const catRaw = input.category;
          const catFilter = (catRaw == null)
            ? ''
            : (typeof catRaw === 'string' ? catRaw : pipe(catRaw, O.getOrElse(() => '')));
          const langMatch = langFilter === '' || String(r.language ?? '') === langFilter;
          const catMatch = catFilter === '' || String(r.category ?? '') === catFilter;
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
