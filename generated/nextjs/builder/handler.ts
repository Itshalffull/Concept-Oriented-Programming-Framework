import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type { BuilderStorage, BuilderBuildInput, BuilderBuildOutput, BuilderStatusOutput, BuilderHistoryOutput } from './types.js';
import { buildOk, statusOk, historyOk } from './types.js';

export interface BuilderError { readonly code: string; readonly message: string; }
export interface BuilderHandler {
  readonly build: (input: BuilderBuildInput, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderBuildOutput>;
  readonly status: (input: { build: string }, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderStatusOutput>;
  readonly history: (input: { concept: string; language: string }, storage: BuilderStorage) => TE.TaskEither<BuilderError, BuilderHistoryOutput>;
}

let _buildCounter = 0;
const err = (error: unknown): BuilderError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const builderHandler: BuilderHandler = {
  build: (input, storage) => pipe(TE.tryCatch(async () => {
    _buildCounter++;
    const build = `build-${_buildCounter}`;
    const artifactHash = 'sha256:abc';
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
  status: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('builds', input.build);
    if (!record) {
      return statusOk(input.build, 'unknown', 0 as any);
    }
    return statusOk(input.build, String(record.status ?? 'done'), Number(record.duration ?? 0) as any);
  }, err)),
  history: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('builds');
    const matching = all.filter(r => r.concept === input.concept && r.language === input.language);
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
