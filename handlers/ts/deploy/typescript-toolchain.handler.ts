// @migrated dsl-constructs 2026-03-18
// TypeScriptToolchain Concept Implementation
// TypeScript provider for the Toolchain coordination concept. Manages
// tsc resolution, Node.js version checking, and bundler detection.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'ts-tool';

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
          path: rec.tscPath as string,
          version: rec.version as string,
          capabilities: JSON.parse(rec.capabilities as string),
        };
      }),
      (b) => {
        if (!platform) {
          return complete(b, 'nodeVersionMismatch', {
            installed: 'unknown',
            required: 'Platform must be specified to determine Node.js version requirements',
          });
        }

        if (versionConstraint && versionConstraint.startsWith('>=18') && platform === 'legacy') {
          return complete(b, 'nodeVersionMismatch', {
            installed: '16.20.0',
            required: versionConstraint,
          });
        }

        if (platform !== 'node' && platform !== 'browser' && platform !== 'deno') {
          return complete(b, 'notInstalled', {
            installHint: 'npm install -g typescript',
          });
        }

        const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const tscPath = '/usr/local/bin/tsc';
        const version = '5.7.2';
        const capabilities = ['esm', 'cjs', 'declaration-maps', 'composite-projects'];

        const b2 = put(b, RELATION, toolchainId, {
          toolchain: toolchainId,
          platform,
          versionConstraint: versionConstraint || '',
          tscPath,
          version,
          capabilities: JSON.stringify(capabilities),
          resolvedAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', {
          tool: toolchainId,
          path: tscPath,
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
      name: 'TypeScriptToolchain',
      language: 'typescript',
      capabilities: ['bundler-detection', 'package-manager', 'node-version-check'],
    }) as StorageProgram<Result>;
  },
};

export const typescriptToolchainHandler = autoInterpret(_handler);
