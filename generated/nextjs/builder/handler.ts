import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { BuilderStorage, BuilderBuildInput, BuilderBuildOutput, BuilderBuildAllInput, BuilderBuildAllOutput, BuilderTestInput, BuilderTestOutput, BuilderStatusInput, BuilderStatusOutput, BuilderHistoryInput, BuilderHistoryOutput } from './types.js';
import { buildOk, buildToolchainError, buildAllOk, buildAllPartial, testOk, testNotBuilt, testRunnerNotFound, statusOk, historyOk } from './types.js';

export interface BuilderError { readonly code: string; readonly message: string; }
export interface BuilderHandler {
  readonly build: (input: BuilderBuildInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderBuildOutput>;
  readonly buildAll: (input: BuilderBuildAllInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderBuildAllOutput>;
  readonly test: (input: BuilderTestInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderTestOutput>;
  readonly status: (input: BuilderStatusInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderStatusOutput>;
  readonly history: (input: BuilderHistoryInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderHistoryOutput>;
}

let _buildCounter = 0;
const KNOWN_LANGUAGES = new Set(['typescript', 'swift', 'rust', 'go', 'java', 'python', 'kotlin', 'solidity', 'c', 'cpp', 'csharp', 'ruby', 'scala', 'zig', 'dart', 'elixir', 'haskell']);
const err = (error: unknown): BuilderError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const builderHandler: BuilderHandler = {
  build: (input, storage) => pipe(TE.tryCatch(async () => {
    let toolchain = await storage.get('toolchains', input.language);
    if (!toolchain) {
      if (!KNOWN_LANGUAGES.has(input.language)) return buildToolchainError(input.concept, input.language, `Toolchain ${input.language} not found`);
      toolchain = { language: input.language };
      await storage.put('toolchains', input.language, toolchain);
    }
    _buildCounter++;
    const build = `build-${_buildCounter}`;
    const artifactHash = `sha256:abc`;
    const artifactLocation = `.clef-artifacts/${input.language}/${input.concept}`;
    const duration = 3200;
    await storage.put('builds', build, {
      build, concept: input.concept, language: input.language,
      platform: input.platform, artifactHash, artifactLocation,
      duration, status: 'done', completedAt: new Date().toISOString(),
      testsPassed: 0,
    });
    return buildOk(build, artifactHash, artifactLocation, duration);
  }, err)),
  buildAll: (input, storage) => pipe(TE.tryCatch(async () => {
    const completed: { concept: string; language: string; artifactHash: string }[] = [];
    const failed: { concept: string; language: string; error: string }[] = [];
    const results: { concept: string; language: string; artifactHash: string; duration: number }[] = [];
    for (const concept of input.concepts) {
      for (const target of input.targets) {
        const toolchain = await storage.get('toolchains', target.language);
        if (!toolchain) {
          failed.push({ concept, language: target.language, error: `Toolchain ${target.language} not found` });
        } else {
          _buildCounter++;
          const artifactHash = `sha256:${_buildCounter}`;
          completed.push({ concept, language: target.language, artifactHash });
          results.push({ concept, language: target.language, artifactHash, duration: 1000 });
        }
      }
    }
    if (failed.length > 0) return buildAllPartial(completed, failed);
    return buildAllOk(results);
  }, err)),
  test: (input, storage) => pipe(TE.tryCatch(async () => {
    const allBuilds = await storage.find('builds');
    const buildExists = allBuilds.some(b => b.concept === input.concept && b.language === input.language);
    if (!buildExists) return testNotBuilt(input.concept, input.language);
    const testType = O.isSome(input.testType) ? input.testType.value : 'unit';
    const runnerKey = `${input.language}:${testType}`;
    const runner = await storage.get('test-runners', runnerKey);
    if (!runner) return testRunnerNotFound(input.language, testType, `Install a test runner for ${input.language}`);
    return testOk(1, 0, 0, 500, testType);
  }, err)),
  status: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('builds', input.build);
    if (!record) return { variant: 'ok' as const, build: input.build, status: 'not_found', duration: undefined } as any;
    return { variant: 'ok' as const, build: input.build, status: String(record.status ?? 'done'), duration: Number(record.duration ?? 0) } as any;
  }, err)),
  history: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('builds');
    const isOption = (v: unknown): v is O.Option<string> => v != null && typeof v === 'object' && '_tag' in (v as any);
    const lang = isOption(input.language) ? (O.isSome(input.language) ? input.language.value : undefined) : (input.language as unknown as string | undefined);
    const matching = all.filter(r => {
      if (r.concept !== input.concept) return false;
      if (lang && r.language !== lang) return false;
      return true;
    });
    const builds = matching.map(r => ({
      language: String(r.language),
      platform: String(r.platform ?? ''),
      artifactHash: String(r.artifactHash ?? ''),
      duration: Number(r.duration ?? 0),
      completedAt: new Date(String(r.completedAt ?? '')),
      testsPassed: Number(r.testsPassed ?? 0),
    }));
    return historyOk(builds);
  }, err)),
};
