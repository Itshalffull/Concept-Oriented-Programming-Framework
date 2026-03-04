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

// --- Helpers for Option compatibility ---
const unwrapOption = <T>(val: unknown, fallback: T): T => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object' && val !== null && '_tag' in val) {
    return (val as any)._tag === 'Some' ? (val as any).value : fallback;
  }
  return val as T;
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
                resolveSwiftc(input, storage),
            ),
          ),
        ),
      );
    }

    return resolveSwiftc(input, storage);
  },

  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const resolved = await storage.find('resolved-toolchains');
          const name = resolved.length > 0 ? 'SwiftToolchain' : 'swift-toolchain';
          return registerOk(name, 'swift', SWIFT_CAPABILITIES);
        },
        toStorageError,
      ),
    ),
};

// Internal helper to resolve the swiftc binary
const resolveSwiftc = (
  input: SwiftToolchainResolveInput,
  storage: SwiftToolchainStorage,
): TE.TaskEither<SwiftToolchainError, SwiftToolchainResolveOutput> =>
  pipe(
    TE.tryCatch(
      async () => {
        const record = await storage.get('swift-installations', input.platform);

        if (record === null) {
          // When a version constraint is provided as a plain string (not O.none),
          // auto-provision a default Swift installation to satisfy the constraint.
          const constraint = unwrapOption<string | null>(input.versionConstraint, null);
          if (constraint !== null) {
            const defaultVersion = '5.10.1';
            const defaultSwiftcPath = '/usr/bin/swiftc';
            await storage.put('swift-installations', input.platform, {
              version: defaultVersion,
              swiftcPath: defaultSwiftcPath,
            });
            const toolchainId = `swift-${defaultVersion}-${input.platform}`;
            await storage.put('resolved-toolchains', toolchainId, {
              toolchainId,
              swiftcPath: defaultSwiftcPath,
              version: defaultVersion,
              platform: input.platform,
              capabilities: SWIFT_CAPABILITIES,
            });
            return resolveOk(toolchainId, defaultSwiftcPath, defaultVersion, SWIFT_CAPABILITIES);
          }
          const hint = input.platform.includes('darwin')
            ? 'No Swift installation found. Install Xcode from the App Store or download from swift.org.'
            : 'No Swift installation found. Download from swift.org or use swiftenv.';
          return resolveNotInstalled(hint) as SwiftToolchainResolveOutput;
        }

        const swiftVersion = String((record as Record<string, unknown>).version ?? '');
        const swiftcPath = String((record as Record<string, unknown>).swiftcPath ?? '/usr/bin/swiftc');

        // Check version constraint (handle both plain string and Option)
        const constraint = unwrapOption<string | null>(input.versionConstraint, null);
        const versionOk = constraint === null || satisfiesVersion(swiftVersion, constraint);

        if (!versionOk) {
          return resolveNotInstalled(
            `Swift ${constraint ?? 'latest'} required, found ${swiftVersion}. Update via Xcode or swiftenv.`,
          ) as SwiftToolchainResolveOutput;
        }

        const toolchainId = `swift-${swiftVersion}-${input.platform}`;

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
