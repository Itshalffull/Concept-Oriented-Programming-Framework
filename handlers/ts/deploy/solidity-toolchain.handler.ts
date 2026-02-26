// SolidityToolchain Concept Implementation
// Solidity provider for the Toolchain coordination concept. Manages
// solc version resolution, Foundry/Hardhat detection, and EVM version targeting.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'sol-tool';

export const solidityToolchainHandler: ConceptHandler = {
  async resolve(input, storage) {
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;

    // Check if a toolchain for this platform already exists in storage
    const existing = await storage.find(RELATION, { platform });
    if (existing.length > 0) {
      const rec = existing[0];
      return {
        variant: 'ok',
        toolchain: rec.toolchain as string,
        solcPath: rec.solcPath as string,
        version: rec.version as string,
        capabilities: JSON.parse(rec.capabilities as string),
      };
    }

    if (!platform) {
      return {
        variant: 'evmVersionUnsupported',
        requested: 'unknown',
        supported: ['shanghai', 'cancun', 'paris', 'london'],
      };
    }

    if (platform === 'prague' || platform === 'osaka') {
      return {
        variant: 'evmVersionUnsupported',
        requested: platform,
        supported: ['shanghai', 'cancun', 'paris', 'london'],
      };
    }

    // Simulate solc not installed for unknown platforms
    if (platform !== 'shanghai' && platform !== 'cancun' && platform !== 'paris') {
      return {
        variant: 'notInstalled',
        installHint: 'pip install solc-select && solc-select install 0.8.25',
      };
    }

    const toolchainId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const solcPath = '/usr/local/bin/solc';
    const version = '0.8.25';
    const capabilities = ['optimizer', 'via-ir', 'foundry-tests'];

    await storage.put(RELATION, toolchainId, {
      toolchain: toolchainId,
      platform,
      versionConstraint: versionConstraint || '',
      solcPath,
      version,
      capabilities: JSON.stringify(capabilities),
      resolvedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      toolchain: toolchainId,
      solcPath,
      version,
      capabilities,
    };
  },

  async register(_input, _storage) {
    return {
      variant: 'ok',
      name: 'SolidityToolchain',
      language: 'solidity',
      capabilities: ['solc-select', 'foundry-detection', 'hardhat-detection'],
    };
  },
};
