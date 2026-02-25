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
        invocation: {
          command: (rec.command as string) || rec.path as string,
          args: JSON.parse((rec.args as string) || '[]'),
          outputFormat: (rec.outputFormat as string) || 'text',
          configFile: (rec.configFile as string) || null,
          env: rec.env ? JSON.parse(rec.env as string) : null,
        },
      };
    }

    // Determine default toolchain info based on language and category.
    // Each entry includes both location (path/version) and invocation
    // profile (command, args, outputFormat, configFile, env) so callers
    // know HOW to run the tool, not just WHERE it is.
    interface ToolProfile {
      path: string;
      version: string;
      capabilities: string[];
      invocation: {
        command: string;
        args: string[];
        outputFormat: string;
        configFile?: string;
        env?: Record<string, string>;
      };
    }

    const toolchainDefaults: Record<string, Record<string, ToolProfile>> = {
      swift: {
        compiler: {
          path: '/usr/bin/swiftc',
          version: '5.10.1',
          capabilities: ['compile', 'test', 'cross-compile', 'macros', 'swift-testing'],
          invocation: {
            command: 'swiftc',
            args: ['-O', '-whole-module-optimization'],
            outputFormat: 'swift-diag',
          },
        },
        'unit-runner': {
          path: '/usr/bin/swift',
          version: '5.10.1',
          capabilities: ['xctest', 'swift-testing', 'parallel', 'filter'],
          invocation: {
            command: 'swift test',
            args: ['--parallel', '--xunit-output', 'test-results.xml'],
            outputFormat: 'swift-test-json',
            configFile: 'Package.swift',
          },
        },
        'ui-runner': {
          path: '/usr/bin/xcodebuild',
          version: '15.4',
          capabilities: ['xcuitest', 'accessibility', 'screenshots'],
          invocation: {
            command: 'xcodebuild test',
            args: ['-scheme', '{scheme}', '-destination', 'platform=iOS Simulator,name=iPhone 15', '-resultBundlePath', 'test-results.xcresult'],
            outputFormat: 'xcresult',
            env: { SIMCTL_CHILD_DYLD_INSERT_LIBRARIES: '' },
          },
        },
        'e2e-runner': {
          path: '/usr/bin/swift',
          version: '5.10.1',
          capabilities: ['xctest', 'host-app', 'network'],
          invocation: {
            command: 'swift test',
            args: ['--filter', 'E2ETests'],
            outputFormat: 'swift-test-json',
            configFile: 'Package.swift',
          },
        },
      },
      typescript: {
        compiler: {
          path: '/usr/local/bin/tsc',
          version: '5.4.0',
          capabilities: ['compile', 'typecheck', 'bundle', 'sourcemap'],
          invocation: {
            command: 'npx tsc',
            args: ['--noEmit', '--pretty', '--diagnostics'],
            outputFormat: 'tsc-diag',
            configFile: 'tsconfig.json',
          },
        },
        'unit-runner': {
          path: '/usr/local/bin/vitest',
          version: '1.6.0',
          capabilities: ['vitest', 'jest-compat', 'parallel', 'coverage', 'filter'],
          invocation: {
            command: 'npx vitest run',
            args: ['--reporter=json', '--coverage'],
            outputFormat: 'vitest-json',
            configFile: 'vitest.config.ts',
            env: { NODE_ENV: 'test' },
          },
        },
        'e2e-runner': {
          path: '/usr/local/bin/playwright',
          version: '1.44.0',
          capabilities: ['playwright', 'chromium', 'firefox', 'webkit', 'parallel'],
          invocation: {
            command: 'npx playwright test',
            args: ['--reporter=json'],
            outputFormat: 'playwright-json',
            configFile: 'playwright.config.ts',
            env: { CI: 'true' },
          },
        },
        'ui-runner': {
          path: '/usr/local/bin/cypress',
          version: '13.8.0',
          capabilities: ['cypress', 'component', 'e2e', 'screenshots', 'video'],
          invocation: {
            command: 'npx cypress run',
            args: ['--reporter', 'json'],
            outputFormat: 'cypress-json',
            configFile: 'cypress.config.ts',
            env: { CYPRESS_RECORD_KEY: '' },
          },
        },
        'visual-runner': {
          path: '/usr/local/bin/storybook',
          version: '8.1.0',
          capabilities: ['storybook', 'chromatic', 'visual-diff'],
          invocation: {
            command: 'npx chromatic',
            args: ['--exit-zero-on-changes', '--auto-accept-changes'],
            outputFormat: 'chromatic-json',
            configFile: '.storybook/main.ts',
          },
        },
        'integration-runner': {
          path: '/usr/local/bin/vitest',
          version: '1.6.0',
          capabilities: ['vitest', 'integration', 'database', 'api'],
          invocation: {
            command: 'npx vitest run',
            args: ['--reporter=json', '--config', 'vitest.integration.config.ts'],
            outputFormat: 'vitest-json',
            configFile: 'vitest.integration.config.ts',
            env: { NODE_ENV: 'test', TEST_TYPE: 'integration' },
          },
        },
      },
      rust: {
        compiler: {
          path: '/usr/local/bin/rustc',
          version: '1.77.0',
          capabilities: ['compile', 'link', 'test', 'bench', 'clippy'],
          invocation: {
            command: 'cargo build',
            args: ['--message-format=json'],
            outputFormat: 'cargo-json',
            configFile: 'Cargo.toml',
          },
        },
        'unit-runner': {
          path: '/usr/local/bin/cargo',
          version: '1.77.0',
          capabilities: ['cargo-test', 'parallel', 'filter', 'coverage'],
          invocation: {
            command: 'cargo test',
            args: ['--', '--format=json', '-Z', 'unstable-options'],
            outputFormat: 'cargo-test-json',
            configFile: 'Cargo.toml',
            env: { RUST_BACKTRACE: '1' },
          },
        },
        'e2e-runner': {
          path: '/usr/local/bin/cargo-nextest',
          version: '0.9.72',
          capabilities: ['nextest', 'parallel', 'retry', 'partition'],
          invocation: {
            command: 'cargo nextest run',
            args: ['--message-format', 'libtest-json', '--retries', '2'],
            outputFormat: 'nextest-json',
            configFile: '.config/nextest.toml',
          },
        },
        'benchmark-runner': {
          path: '/usr/local/bin/cargo',
          version: '1.77.0',
          capabilities: ['cargo-bench', 'criterion'],
          invocation: {
            command: 'cargo bench',
            args: ['--', '--output-format', 'bencher'],
            outputFormat: 'criterion-json',
            configFile: 'Cargo.toml',
          },
        },
      },
      solidity: {
        compiler: {
          path: '/usr/local/bin/solc',
          version: '0.8.25',
          capabilities: ['compile', 'optimizer', 'via-ir', 'foundry-tests'],
          invocation: {
            command: 'forge build',
            args: ['--json'],
            outputFormat: 'forge-json',
            configFile: 'foundry.toml',
          },
        },
        'unit-runner': {
          path: '/usr/local/bin/forge',
          version: '0.2.0',
          capabilities: ['forge-test', 'fuzz', 'invariant', 'gas-report'],
          invocation: {
            command: 'forge test',
            args: ['--json', '--gas-report'],
            outputFormat: 'forge-test-json',
            configFile: 'foundry.toml',
          },
        },
        'e2e-runner': {
          path: '/usr/local/bin/forge',
          version: '0.2.0',
          capabilities: ['forge-test', 'fork', 'mainnet', 'anvil'],
          invocation: {
            command: 'forge test',
            args: ['--json', '--fork-url', '{rpcUrl}'],
            outputFormat: 'forge-test-json',
            configFile: 'foundry.toml',
            env: { FOUNDRY_ETH_RPC_URL: '' },
          },
        },
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

    const invocation = {
      command: defaults.invocation.command,
      args: defaults.invocation.args,
      outputFormat: defaults.invocation.outputFormat,
      configFile: defaults.invocation.configFile || null,
      env: defaults.invocation.env || null,
    };

    await storage.put(RELATION, toolId, {
      tool: toolId,
      language,
      platform,
      category,
      version: defaults.version,
      path: defaults.path,
      capabilities: JSON.stringify(defaults.capabilities),
      command: invocation.command,
      args: JSON.stringify(invocation.args),
      outputFormat: invocation.outputFormat,
      configFile: invocation.configFile,
      env: invocation.env ? JSON.stringify(invocation.env) : null,
      status: 'active',
      resolvedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      tool: toolId,
      version: defaults.version,
      path: defaults.path,
      capabilities: defaults.capabilities,
      invocation,
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
    const category = input.category as string | undefined;

    const query: Record<string, unknown> = {};
    if (language) {
      query.language = language;
    }
    if (category) {
      query.category = category;
    }

    const records = await storage.find(RELATION, query);

    const tools = records.map((rec) => ({
      language: rec.language as string,
      platform: rec.platform as string,
      category: (rec.category as string) || 'compiler',
      version: rec.version as string,
      path: rec.path as string,
      command: (rec.command as string) || rec.path as string,
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
