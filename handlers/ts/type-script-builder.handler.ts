// @migrated dsl-constructs 2026-03-18
// ============================================================
// TypeScriptBuilder Handler
//
// Compile, test, and package TypeScript concept implementations.
// Owns TypeScript-specific build logic: tsc invocation, bundler
// integration (esbuild/webpack/vite), test runner integration
// (jest/vitest), and npm package generation.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  build(input: Record<string, unknown>) {
    const source = input.source as string;
    const toolchainPath = input.toolchainPath as string;
    const platform = input.platform as string;
    const config = input.config as Record<string, unknown>;

    const mode = (config?.mode as string) || 'debug';
    const features = (config?.features as string[]) || [];

    let moduleFormat: string;
    let tsconfigTarget: string;
    if (platform === 'node-20') { moduleFormat = 'esm'; tsconfigTarget = 'ES2022'; }
    else if (platform === 'browser') { moduleFormat = 'esm'; tsconfigTarget = 'ES2020'; }
    else if (platform === 'cjs') { moduleFormat = 'commonjs'; tsconfigTarget = 'ES2020'; }
    else { moduleFormat = 'esm'; tsconfigTarget = 'ES2022'; }

    const sourceName = source.replace(/^\.\//, '').replace(/\//g, '-');
    const artifactPath = `.clef-artifacts/typescript/${sourceName}`;
    const artifactHash = generateHash();

    let bundler: string | null = null;
    if (platform === 'browser') bundler = 'esbuild';

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'type-script-builder', id, {
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

    return complete(p, 'ok', {
      build: id,
      artifactPath,
      artifactHash,
    }) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    const build = input.build as string;
    const toolchainPath = input.toolchainPath as string;
    const invocation = input.invocation as Record<string, unknown> | undefined;
    const testType = (input.testType as string) || 'unit';

    let p = createProgram();
    p = get(p, 'type-script-builder', build, 'record');

    return branch(p,
      (b) => !b.record,
      (() => {
        const t = createProgram();
        return complete(t, 'testFailure', {
          passed: 0,
          failed: 1,
          failures: [{ test: 'build-lookup', message: `Build '${build}' not found` }],
          testType,
        }) as StorageProgram<Result>;
      })(),
      (() => {
        let command: string;
        let outputFormat: string;
        if (invocation) {
          command = invocation.command as string;
          outputFormat = (invocation.outputFormat as string) || 'vitest-json';
        } else {
          command = 'npx vitest run';
          outputFormat = 'vitest-json';
        }

        const now = new Date().toISOString();
        let e = createProgram();
        e = mapBindings(e, (b) => {
          const record = b.record as Record<string, unknown>;
          return {
            ...record,
            lastTestAt: now,
            lastTestCommand: command,
            lastTestOutputFormat: outputFormat,
            lastTestType: testType,
          };
        }, 'updatedRecord');

        return complete(e, 'ok', {
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          testType,
        }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  package(input: Record<string, unknown>) {
    const build = input.build as string;
    const format = input.format as string;

    if (!SUPPORTED_PACKAGE_FORMATS.includes(format)) {
      const p = createProgram();
      return complete(p, 'formatUnsupported', { format }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'type-script-builder', build, 'record');

    return branch(p,
      (b) => !b.record,
      (() => {
        const t = createProgram();
        return complete(t, 'formatUnsupported', { format: `Build '${build}' not found` }) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return completeFrom(e, 'ok', (b) => {
          const record = b.record as Record<string, unknown>;
          const basePath = record.artifactPath as string;
          let artifactPath: string;
          if (format === 'npm') artifactPath = `${basePath}/package.tgz`;
          else if (format === 'bundle') artifactPath = `${basePath}/bundle.js`;
          else artifactPath = `${basePath}/Dockerfile`;
          const artifactHash = generateHash();
          return { artifactPath, artifactHash };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'TypeScriptBuilder',
      language: 'typescript',
      capabilities: ['npm', 'bundle', 'docker'],
    }) as StorageProgram<Result>;
  },
};

export const typeScriptBuilderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptBuilderCounter(): void {
  idCounter = 0;
}
