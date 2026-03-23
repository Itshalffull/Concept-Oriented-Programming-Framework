// @clef-handler style=functional concept=SolidityToolchain
// @migrated dsl-constructs 2026-03-18
// SolidityToolchain Concept Implementation
// Solidity provider for the Toolchain coordination concept. Manages
// solc version resolution, Foundry/Hardhat detection, and EVM version targeting.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'sol-tool';

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    if (!input.platform || (typeof input.platform === 'string' && (input.platform as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'platform is required' }) as StorageProgram<Result>;
    }
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
          path: rec.solcPath as string,
          version: rec.version as string,
          capabilities: JSON.parse(rec.capabilities as string),
        };
      }),
      (b) => {
        if (!platform) {
          return complete(b, 'evmVersionUnsupported', {
            requested: 'unknown',
            supported: ['shanghai', 'cancun', 'paris', 'london'],
          });
        }

        if (platform === 'prague' || platform === 'osaka') {
          return complete(b, 'evmVersionUnsupported', {
            requested: platform,
            supported: ['shanghai', 'cancun', 'paris', 'london'],
          });
        }

        if (platform !== 'shanghai' && platform !== 'cancun' && platform !== 'paris') {
          return complete(b, 'notInstalled', {
            installHint: 'pip install solc-select && solc-select install 0.8.25',
          });
        }

        const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const solcPath = '/usr/local/bin/solc';
        const version = '0.8.25';
        const capabilities = ['optimizer', 'via-ir', 'foundry-tests'];

        const b2 = put(b, RELATION, toolchainId, {
          toolchain: toolchainId,
          platform,
          versionConstraint: versionConstraint || '',
          solcPath,
          version,
          capabilities: JSON.stringify(capabilities),
          resolvedAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', {
          tool: toolchainId,
          path: solcPath,
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
      name: 'SolidityToolchain',
      language: 'solidity',
      capabilities: ['solc-select', 'foundry-detection', 'hardhat-detection'],
    }) as StorageProgram<Result>;
  },
};

export const solidityToolchainHandler = autoInterpret(_handler);
