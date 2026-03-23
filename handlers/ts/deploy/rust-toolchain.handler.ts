// @clef-handler style=functional concept=RustToolchain
// @migrated dsl-constructs 2026-03-18
// RustToolchain Concept Implementation
// Rust provider for the Toolchain coordination concept. Manages
// rustup channels, target triple installation, and wasm-pack detection.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'rust-tool';

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    let p = createProgram();
    p = find(p, RELATION, { platform }, 'existing');

    p = branch(p,
      (bindings) => (bindings.existing as Array<Record<string, unknown>>).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Array<Record<string, unknown>>;
        const rec = existing[0];
        return {
          tool: rec.toolchain as string,
          path: rec.rustcPath as string,
          version: rec.version as string,
          capabilities: JSON.parse(rec.capabilities as string),
        };
      }),
      (b) => {
        if (!platform) {
          return complete(b, 'targetMissing', {
            target: 'unknown',
            installHint: 'Platform must be specified to determine target triple',
          });
        }

        // Check if platform is in the supported set
        const SUPPORTED_PLATFORMS = ['x86_64-linux', 'linux-x86_64', 'aarch64-macos', 'aarch64-apple-darwin', 'wasm32', 'wasm32-unknown-unknown', 'x86_64-unknown-linux-gnu', 'aarch64-unknown-linux-gnu'];
        const isSupported = SUPPORTED_PLATFORMS.some(p => platform.startsWith(p) || p.startsWith(platform.split('-')[0]));
        if (!isSupported) {
          return complete(b, 'notInstalled', {
            installHint: `Platform '${platform}' is not supported. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`,
          });
        }

        const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const rustcPath = '/usr/local/bin/rustc';
        const version = '1.78.0';
        const capabilities = ['incremental', 'proc-macros', 'wasm-target'];

        const b2 = put(b, RELATION, toolchainId, {
          toolchain: toolchainId,
          platform,
          versionConstraint: versionConstraint || '',
          rustcPath,
          version,
          capabilities: JSON.stringify(capabilities),
          resolvedAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', {
          tool: toolchainId,
          path: rustcPath,
          version,
          capabilities,
        });
      },
    );

    return p as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'RustToolchain',
      language: 'rust',
      capabilities: ['rustup-channels', 'target-management', 'wasm-pack-detection'],
    }) as StorageProgram<Result>;
  },
};

export const rustToolchainHandler = autoInterpret(_handler);
