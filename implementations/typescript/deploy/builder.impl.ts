// Builder Concept Implementation
// Coordination concept for build lifecycle. Manages building, testing,
// and tracking build history across languages and platforms.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'build';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

export const builderHandler: ConceptHandler = {
  async build(input, storage) {
    const concept = input.concept as string;
    const source = input.source as string;
    const language = input.language as string;
    const platform = input.platform as string;
    const config = input.config as { mode: string; features?: string[] } | undefined;

    const startTime = Date.now();

    if (!concept || !source || !language || !platform) {
      return {
        variant: 'toolchainError',
        concept,
        language,
        reason: 'concept, source, language, and platform are required',
      };
    }

    const buildId = `bld-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const contentKey = `${concept}:${source}:${language}:${platform}:${config?.mode || 'default'}`;
    const artifactHash = simpleHash(contentKey);
    const artifactLocation = `builds/${language}/${platform}/${artifactHash}`;
    const duration = Date.now() - startTime;

    await storage.put(RELATION, buildId, {
      build: buildId,
      concept,
      source,
      language,
      platform,
      mode: config?.mode || 'default',
      features: JSON.stringify(config?.features || []),
      artifactHash,
      artifactLocation,
      duration,
      status: 'completed',
      testsPassed: true,
      completedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      build: buildId,
      artifactHash,
      artifactLocation,
      duration,
    };
  },

  async buildAll(input, storage) {
    const concepts = input.concepts as string[];
    const source = input.source as string;
    const targets = input.targets as Array<{ language: string; platform: string }>;
    const config = input.config as { mode: string; features?: string[] } | undefined;

    const completed: Array<{ concept: string; language: string; artifactHash: string; duration: number }> = [];
    const failed: Array<{ concept: string; language: string; reason: string }> = [];

    for (const concept of concepts) {
      for (const target of targets) {
        const startTime = Date.now();
        const buildId = `bld-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contentKey = `${concept}:${source}:${target.language}:${target.platform}:${config?.mode || 'default'}`;
        const artifactHash = simpleHash(contentKey);
        const artifactLocation = `builds/${target.language}/${target.platform}/${artifactHash}`;
        const duration = Date.now() - startTime;

        try {
          await storage.put(RELATION, buildId, {
            build: buildId,
            concept,
            source,
            language: target.language,
            platform: target.platform,
            mode: config?.mode || 'default',
            features: JSON.stringify(config?.features || []),
            artifactHash,
            artifactLocation,
            duration,
            status: 'completed',
            testsPassed: true,
            completedAt: new Date().toISOString(),
          });

          completed.push({
            concept,
            language: target.language,
            artifactHash,
            duration,
          });
        } catch {
          failed.push({
            concept,
            language: target.language,
            reason: 'Build failed unexpectedly',
          });
        }
      }
    }

    if (failed.length > 0) {
      return { variant: 'partial', completed, failed };
    }

    return { variant: 'ok', results: completed };
  },

  async test(input, storage) {
    const concept = input.concept as string;
    const language = input.language as string;
    const platform = input.platform as string;

    // Check that a build exists for this concept and language
    const existing = await storage.find(RELATION, { concept, language, platform });
    if (existing.length === 0) {
      return { variant: 'notBuilt', concept, language };
    }

    const startTime = Date.now();

    // Simulate test execution
    const passed = Math.floor(Math.random() * 50) + 10;
    const skipped = Math.floor(Math.random() * 5);
    const failed = 0;
    const duration = Date.now() - startTime;

    // Update the most recent build record with test results
    const latest = existing[existing.length - 1];
    await storage.put(RELATION, latest.build as string, {
      ...latest,
      testsPassed: failed === 0,
      testsRun: true,
      testPassed: passed,
      testFailed: failed,
      testSkipped: skipped,
      testDuration: duration,
    });

    return { variant: 'ok', passed, failed, skipped, duration };
  },

  async status(input, storage) {
    const build = input.build as string;

    const record = await storage.get(RELATION, build);
    if (!record) {
      return { variant: 'ok', build, status: 'notFound', duration: 0 };
    }

    return {
      variant: 'ok',
      build,
      status: record.status as string,
      duration: record.duration as number,
    };
  },

  async history(input, storage) {
    const concept = input.concept as string;
    const language = input.language as string | undefined;

    const query: Record<string, unknown> = { concept };
    if (language) {
      query.language = language;
    }

    const records = await storage.find(RELATION, query);

    const builds = records.map((rec) => ({
      language: rec.language as string,
      platform: rec.platform as string,
      artifactHash: rec.artifactHash as string,
      duration: rec.duration as number,
      completedAt: rec.completedAt as string,
      testsPassed: rec.testsPassed as boolean,
    }));

    return { variant: 'ok', builds };
  },
};
