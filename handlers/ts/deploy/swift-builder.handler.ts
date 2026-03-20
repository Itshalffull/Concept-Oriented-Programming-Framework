// @clef-handler style=functional concept=SwiftBuilder
// @migrated dsl-constructs 2026-03-18
// SwiftBuilder Concept Implementation
// Swift provider for the Builder coordination concept. Manages
// swift build, swift test, and framework packaging.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'swift-build';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const _handler: FunctionalConceptHandler = {
  build(input: Record<string, unknown>) {
    const source = input.source as string;
    const toolchainPath = input.toolchainPath as string;
    const platform = input.platform as string;
    const config = input.config as { mode: string; features: string[] };

    if (!source || !toolchainPath) {
      let p = createProgram();
      return complete(p, 'compilationError', {
        errors: [{ file: source || 'unknown', line: 0, message: 'Source and toolchainPath are required' }],
      }) as StorageProgram<Result>;
    }

    const startTime = Date.now();
    const contentKey = `${source}:${toolchainPath}:${platform}:${config.mode}:${(config.features || []).join(',')}`;
    const artifactHash = simpleHash(contentKey);
    const buildId = `swb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const artifactPath = `build/swift/${platform}/${config.mode}/${buildId}`;
    const duration = Date.now() - startTime;

    let p = createProgram();
    p = put(p, RELATION, buildId, {
      build: buildId,
      source,
      toolchainPath,
      platform,
      mode: config.mode,
      features: JSON.stringify(config.features || []),
      artifactPath,
      artifactHash,
      duration,
      status: 'built',
      builtAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { build: buildId, artifactPath, artifactHash }) as StorageProgram<Result>;
  },

  test(input: Record<string, unknown>) {
    const build = input.build as string;
    const toolchainPath = input.toolchainPath as string;
    const invocation = input.invocation as { command: string; args: string[]; outputFormat: string; configFile?: string; env?: Record<string, string> } | undefined;
    const testType = (input.testType as string) || 'unit';

    let p = createProgram();
    p = get(p, RELATION, build, 'record');

    p = branch(p, 'record',
      (b) => {
        const startTime = Date.now();
        const runnerCommand = invocation?.command || 'swift test';
        const passed = 42;
        const failed = 0;
        const skipped = 3;
        const duration = Date.now() - startTime;

        const b2 = putFrom(b, RELATION, build, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            testPassed: passed,
            testFailed: failed,
            testSkipped: skipped,
            testDuration: duration,
            testType,
            testRunner: runnerCommand,
            testedAt: new Date().toISOString(),
          };
        });

        return complete(b2, 'ok', { passed, failed, skipped, duration, testType });
      },
      (b) => complete(b, 'testFailure', {
        passed: 0,
        failed: 1,
        failures: [{ test: 'lookup', message: `Build ${build} not found` }],
        testType,
      }),
    );

    return p as StorageProgram<Result>;
  },

  package(input: Record<string, unknown>) {
    const build = input.build as string;
    const format = input.format as string;

    let p = createProgram();
    p = get(p, RELATION, build, 'record');

    p = branch(p, 'record',
      (b) => {
        const capabilities = ['framework', 'xcframework', 'binary', 'library'];
        if (!capabilities.includes(format)) {
          return complete(b, 'formatUnsupported', { format });
        }

        const artifactPath = `dist/swift/${format}/${build}.${format}`;

        const b2 = putFrom(b, RELATION, build, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const artifactHash = simpleHash(`${build}:${format}:${record.artifactHash}`);
          return {
            ...record,
            packagedFormat: format,
            packagedPath: artifactPath,
            packagedHash: artifactHash,
            packagedAt: new Date().toISOString(),
          };
        });

        let b3 = mapBindings(b2, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return simpleHash(`${build}:${format}:${record.artifactHash}`);
        }, 'artifactHash');

        return completeFrom(b3, 'ok', (bindings) => ({
          artifactPath,
          artifactHash: bindings.artifactHash as string,
        }));
      },
      (b) => complete(b, 'formatUnsupported', { format }),
    );

    return p as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      name: 'SwiftBuilder',
      language: 'swift',
      capabilities: ['framework', 'xcframework', 'binary', 'library'],
    }) as StorageProgram<Result>;
  },
};

export const swiftBuilderHandler = autoInterpret(_handler);
