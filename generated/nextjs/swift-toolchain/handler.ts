// SwiftToolchain — Swift toolchain detection and management: swiftc version resolution,
// Package.swift validation, Xcode requirement checking, platform compatibility.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SwiftToolchainStorage,
  SwiftToolchainResolveInput,
  SwiftToolchainResolveOutput,
  SwiftToolchainRegisterInput,
  SwiftToolchainRegisterOutput,
} from './types.js';

import {
  resolveOk,
  resolveNotInstalled,
  resolveXcodeRequired,
  registerOk,
} from './types.js';

export interface SwiftToolchainError {
  readonly code: string;
  readonly message: string;
}

export interface SwiftToolchainHandler {
  readonly resolve: (
    input: SwiftToolchainResolveInput,
    storage: SwiftToolchainStorage,
  ) => TE.TaskEither<SwiftToolchainError, SwiftToolchainResolveOutput>;
  readonly register: (
    input: SwiftToolchainRegisterInput,
    storage: SwiftToolchainStorage,
  ) => TE.TaskEither<SwiftToolchainError, SwiftToolchainRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SwiftToolchainError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SWIFT_CAPABILITIES: readonly string[] = [
  'compile',
  'link',
  'package-resolve',
  'test',
  'module-interface',
  'concurrency',
] as const;

const XCODE_REQUIRED_PLATFORMS: readonly string[] = [
  'ios', 'tvos', 'watchos', 'visionos',
];

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

export const swiftToolchainHandler: SwiftToolchainHandler = {
  resolve: (input, storage) => {
    // Check if the target platform requires Xcode
    if (XCODE_REQUIRED_PLATFORMS.some((p) => input.platform.includes(p))) {
      return pipe(
        TE.tryCatch(
          () => storage.get('xcode-installations', input.platform),
          toStorageError,
        ),
        TE.chain((xcodeRecord) =>
          pipe(
            O.fromNullable(xcodeRecord),
            O.fold(
              () => TE.right(resolveXcodeRequired(
                `Platform '${input.platform}' requires Xcode with appropriate SDKs installed`,
              ) as SwiftToolchainResolveOutput),
              () =>
                // Xcode found, continue with swiftc resolution
                resolveSwiftc(input, storage),
            ),
          ),
        ),
      );
    }

    return resolveSwiftc(input, storage);
  },

  register: (_input, _storage) =>
    TE.right(registerOk('swift-toolchain', 'swift', SWIFT_CAPABILITIES)),
};

// Internal helper to resolve the swiftc binary
const resolveSwiftc = (
  input: SwiftToolchainResolveInput,
  storage: SwiftToolchainStorage,
): TE.TaskEither<SwiftToolchainError, SwiftToolchainResolveOutput> =>
  pipe(
    TE.tryCatch(
      () => storage.get('swift-installations', input.platform),
      toStorageError,
    ),
    TE.chain((record) =>
      pipe(
        O.fromNullable(record),
        O.fold(
          () => {
            const hint = input.platform.includes('darwin')
              ? 'Install Xcode from the App Store, or download Swift from swift.org/download'
              : 'Download Swift from swift.org/download for your platform';
            return TE.right(resolveNotInstalled(hint) as SwiftToolchainResolveOutput);
          },
          (rec) => {
            const swiftVersion = String((rec as Record<string, unknown>).version ?? '0.0.0');
            const swiftcPath = String((rec as Record<string, unknown>).swiftcPath ?? '/usr/bin/swiftc');

            // Check version constraint if provided
            const versionOk = pipe(
              input.versionConstraint,
              O.fold(
                () => true,
                (constraint) => satisfiesVersion(swiftVersion, constraint),
              ),
            );

            if (!versionOk) {
              return TE.right(resolveNotInstalled(
                `Swift ${pipe(input.versionConstraint, O.getOrElse(() => 'latest'))} required, found ${swiftVersion}. Update via Xcode or swiftenv.`,
              ) as SwiftToolchainResolveOutput);
            }

            const toolchainId = `swift-${swiftVersion}-${input.platform}`;

            return pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('resolved-toolchains', toolchainId, {
                    toolchainId,
                    swiftcPath,
                    version: swiftVersion,
                    platform: input.platform,
                    capabilities: SWIFT_CAPABILITIES,
                  });
                  return resolveOk(toolchainId, swiftcPath, swiftVersion, SWIFT_CAPABILITIES);
                },
                toStorageError,
              ),
            );
          },
        ),
      ),
    ),
  );
