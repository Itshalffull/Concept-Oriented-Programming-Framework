// Toolchain Concept Implementation
// Coordination concept for tool resolution. Manages discovering, validating,
// and querying toolchain capabilities across languages and platforms.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'toolchain';

export const toolchainHandler: ConceptHandler = {
  async resolve(input, storage) {
    const language = input.language as string;
    const platform = input.platform as string;
    const versionConstraint = input.versionConstraint as string | undefined;
    const category = (input.category as string) || 'compiler';

    // Check if a matching toolchain is already registered
    const query: Record<string, unknown> = { language, platform };
    if (category !== 'compiler') {
      query.category = category;
    }
    const existing = await storage.find(RELATION, query);

    if (existing.length > 0) {
      const rec = existing[0];
      const installedVersion = rec.version as string;

      // If a version constraint is provided, check compatibility
      if (versionConstraint && installedVersion !== versionConstraint) {
        return {
          variant: 'versionMismatch',
          language,
          installed: installedVersion,
          required: versionConstraint,
        };
      }

      return {
        variant: 'ok',
        tool: rec.tool as string,
        version: installedVersion,
        path: rec.path as string,
        capabilities: JSON.parse(rec.capabilities as string || '[]'),
      };
    }

    // Determine default toolchain info based on language and category
    const toolchainDefaults: Record<string, Record<string, { path: string; version: string; capabilities: string[] }>> = {
      swift: {
        compiler: { path: '/usr/bin/swiftc', version: '5.10.1', capabilities: ['compile', 'test', 'cross-compile', 'macros', 'swift-testing'] },
        'unit-runner': { path: '/usr/bin/xctest', version: '5.10.1', capabilities: ['xctest', 'swift-testing', 'parallel', 'filter'] },
        'ui-runner': { path: '/usr/bin/xcuitest', version: '5.10.1', capabilities: ['xcuitest', 'accessibility', 'screenshots'] },
        'e2e-runner': { path: '/usr/bin/xctest', version: '5.10.1', capabilities: ['xctest', 'host-app', 'network'] },
      },
      typescript: {
        compiler: { path: '/usr/local/bin/tsc', version: '5.4.0', capabilities: ['compile', 'typecheck', 'bundle', 'sourcemap'] },
        'unit-runner': { path: '/usr/local/bin/vitest', version: '1.6.0', capabilities: ['vitest', 'jest-compat', 'parallel', 'coverage', 'filter'] },
        'e2e-runner': { path: '/usr/local/bin/playwright', version: '1.44.0', capabilities: ['playwright', 'chromium', 'firefox', 'webkit', 'parallel'] },
        'ui-runner': { path: '/usr/local/bin/cypress', version: '13.8.0', capabilities: ['cypress', 'component', 'e2e', 'screenshots', 'video'] },
        'visual-runner': { path: '/usr/local/bin/storybook', version: '8.1.0', capabilities: ['storybook', 'chromatic', 'visual-diff'] },
        'integration-runner': { path: '/usr/local/bin/vitest', version: '1.6.0', capabilities: ['vitest', 'integration', 'database', 'api'] },
      },
      rust: {
        compiler: { path: '/usr/local/bin/rustc', version: '1.77.0', capabilities: ['compile', 'link', 'test', 'bench', 'clippy'] },
        'unit-runner': { path: '/usr/local/bin/cargo', version: '1.77.0', capabilities: ['cargo-test', 'parallel', 'filter', 'coverage'] },
        'e2e-runner': { path: '/usr/local/bin/cargo-nextest', version: '0.9.72', capabilities: ['nextest', 'parallel', 'retry', 'partition'] },
        'benchmark-runner': { path: '/usr/local/bin/cargo', version: '1.77.0', capabilities: ['cargo-bench', 'criterion'] },
      },
      solidity: {
        compiler: { path: '/usr/local/bin/solc', version: '0.8.25', capabilities: ['compile', 'optimizer', 'via-ir', 'foundry-tests'] },
        'unit-runner': { path: '/usr/local/bin/forge', version: '0.2.0', capabilities: ['forge-test', 'fuzz', 'invariant', 'gas-report'] },
        'e2e-runner': { path: '/usr/local/bin/forge', version: '0.2.0', capabilities: ['forge-test', 'fork', 'mainnet', 'anvil'] },
      },
    };

    const langDefaults = toolchainDefaults[language];
    if (!langDefaults) {
      return {
        variant: 'platformUnsupported',
        language,
        platform,
      };
    }

    const defaults = langDefaults[category];
    if (!defaults) {
      return {
        variant: 'notInstalled',
        language,
        platform,
        installHint: `No ${category} runner available for ${language}. Install a compatible test runner.`,
      };
    }

    // Check version constraint against default
    if (versionConstraint && defaults.version !== versionConstraint) {
      return {
        variant: 'notInstalled',
        language,
        platform,
        installHint: `Install ${language} ${category} ${versionConstraint} for ${platform}`,
      };
    }

    const toolId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await storage.put(RELATION, toolId, {
      tool: toolId,
      language,
      platform,
      category,
      version: defaults.version,
      path: defaults.path,
      capabilities: JSON.stringify(defaults.capabilities),
      status: 'active',
      resolvedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      tool: toolId,
      version: defaults.version,
      path: defaults.path,
      capabilities: defaults.capabilities,
    };
  },

  async validate(input, storage) {
    const tool = input.tool as string;

    const record = await storage.get(RELATION, tool);
    if (!record) {
      return {
        variant: 'invalid',
        tool,
        reason: 'Toolchain not found',
      };
    }

    // Mark as validated
    await storage.put(RELATION, tool, {
      ...record,
      status: 'validated',
      validatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      tool,
      version: record.version as string,
    };
  },

  async list(input, storage) {
    const language = input.language as string | undefined;

    const query: Record<string, unknown> = {};
    if (language) {
      query.language = language;
    }

    const records = await storage.find(RELATION, query);

    const tools = records.map((rec) => ({
      language: rec.language as string,
      platform: rec.platform as string,
      version: rec.version as string,
      path: rec.path as string,
      status: rec.status as string,
    }));

    return { variant: 'ok', tools };
  },

  async capabilities(input, storage) {
    const tool = input.tool as string;

    const record = await storage.get(RELATION, tool);
    if (!record) {
      return {
        variant: 'invalid',
        tool,
        reason: 'Toolchain not found',
      };
    }

    const capabilities: string[] = JSON.parse(record.capabilities as string || '[]');
    return { variant: 'ok', capabilities };
  },
};
