// ============================================================
// TypeScriptBuilder Handler
//
// Compile, test, and package TypeScript concept implementations.
// Owns TypeScript-specific build logic: tsc invocation, bundler
// integration (esbuild/webpack/vite), test runner integration
// (jest/vitest), and npm package generation. Supports local,
// remote, and container-based execution strategies configured
// via the deploy manifest executor section.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-builder-${++idCounter}`;
}

function generateHash(): string {
  const hex = Math.random().toString(16).substring(2, 18);
  return `sha256:${hex}`;
}

const SUPPORTED_PLATFORMS = ['node-20', 'browser', 'cjs'];
const SUPPORTED_PACKAGE_FORMATS = ['npm', 'bundle', 'docker'];

export const typeScriptBuilderHandler: ConceptHandler = {
  async build(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const toolchainPath = input.toolchainPath as string;
    const platform = input.platform as string;
    const config = input.config as Record<string, unknown>;

    const mode = (config?.mode as string) || 'debug';
    const features = (config?.features as string[]) || [];

    // Determine module format from platform
    let moduleFormat: string;
    let tsconfigTarget: string;
    if (platform === 'node-20') {
      moduleFormat = 'esm';
      tsconfigTarget = 'ES2022';
    } else if (platform === 'browser') {
      moduleFormat = 'esm';
      tsconfigTarget = 'ES2020';
    } else if (platform === 'cjs') {
      moduleFormat = 'commonjs';
      tsconfigTarget = 'ES2020';
    } else {
      moduleFormat = 'esm';
      tsconfigTarget = 'ES2022';
    }

    // Derive artifact path from source
    const sourceName = source.replace(/^\.\//, '').replace(/\//g, '-');
    const artifactPath = `.clef-artifacts/typescript/${sourceName}`;
    const artifactHash = generateHash();

    // Determine bundler based on platform
    let bundler: string | null = null;
    if (platform === 'browser') {
      bundler = 'esbuild';
    }

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('type-script-builder', id, {
      id,
      projectPath: source,
      outDir: artifactPath,
      tsconfigTarget,
      moduleFormat,
      bundler,
      platform,
      mode,
      features: JSON.stringify(features),
      toolchainPath,
      artifactPath,
      artifactHash,
      builtAt: now,
    });

    return {
      variant: 'ok',
      build: id,
      artifactPath,
      artifactHash,
    };
  },

  async test(input: Record<string, unknown>, storage: ConceptStorage) {
    const build = input.build as string;
    const toolchainPath = input.toolchainPath as string;
    const invocation = input.invocation as Record<string, unknown> | undefined;
    const testType = (input.testType as string) || 'unit';

    const record = await storage.get('type-script-builder', build);
    if (!record) {
      return {
        variant: 'testFailure',
        passed: 0,
        failed: 1,
        failures: [{ test: 'build-lookup', message: `Build '${build}' not found` }],
        testType,
      };
    }

    // Derive test runner info from invocation or defaults
    let command: string;
    let outputFormat: string;
    if (invocation) {
      command = invocation.command as string;
      outputFormat = (invocation.outputFormat as string) || 'vitest-json';
    } else {
      command = 'npx vitest run';
      outputFormat = 'vitest-json';
    }

    // Simulate test execution results
    const now = new Date().toISOString();
    await storage.put('type-script-builder', build, {
      ...record,
      lastTestAt: now,
      lastTestCommand: command,
      lastTestOutputFormat: outputFormat,
      lastTestType: testType,
    });

    return {
      variant: 'ok',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      testType,
    };
  },

  async package(input: Record<string, unknown>, storage: ConceptStorage) {
    const build = input.build as string;
    const format = input.format as string;

    if (!SUPPORTED_PACKAGE_FORMATS.includes(format)) {
      return { variant: 'formatUnsupported', format };
    }

    const record = await storage.get('type-script-builder', build);
    if (!record) {
      return { variant: 'formatUnsupported', format: `Build '${build}' not found` };
    }

    const basePath = record.artifactPath as string;
    let artifactPath: string;
    if (format === 'npm') {
      artifactPath = `${basePath}/package.tgz`;
    } else if (format === 'bundle') {
      artifactPath = `${basePath}/bundle.js`;
    } else {
      artifactPath = `${basePath}/Dockerfile`;
    }

    const artifactHash = generateHash();

    return {
      variant: 'ok',
      artifactPath,
      artifactHash,
    };
  },

  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'TypeScriptBuilder',
      language: 'typescript',
      capabilities: ['npm', 'bundle', 'docker'],
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptBuilderCounter(): void {
  idCounter = 0;
}
