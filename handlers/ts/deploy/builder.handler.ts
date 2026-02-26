// Builder Concept Implementation
// Coordination concept for build lifecycle. Manages building, testing,
// and tracking build history across languages and platforms.
import type { ConceptHandler } from '../../../runtime/types.js';

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
    const testFilter = input.testFilter as string[] | undefined;
    const testType = (input.testType as string) || 'unit';
    const toolName = input.toolName as string | undefined;
    const invocation = input.invocation as { command: string; args: string[]; outputFormat: string; configFile?: string; env?: Record<string, string> } | undefined;

    // Check that a build exists for this concept and language
    const existing = await storage.find(RELATION, { concept, language, platform });
    if (existing.length === 0) {
      return { variant: 'notBuilt', concept, language };
    }

    // Map testType to toolchain category for resolution.
    // The resolved invocation profile (or one passed in directly)
    // tells the language-specific provider exactly how to run
    // the test tool and parse its output.
    const categoryMap: Record<string, string> = {
      unit: 'unit-runner',
      integration: 'integration-runner',
      e2e: 'e2e-runner',
      ui: 'ui-runner',
      visual: 'visual-runner',
      benchmark: 'benchmark-runner',
    };
    const _resolvedCategory = categoryMap[testType] || 'unit-runner';

    const startTime = Date.now();

    // Simulate test execution — count varies by filter and type
    const baseCount = testFilter ? testFilter.length : Math.floor(Math.random() * 50) + 10;
    const passed = baseCount;
    const skipped = testFilter ? 0 : Math.floor(Math.random() * 5);
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
      testType,
      testToolName: toolName || null,
      testRunner: invocation?.command || null,
    });

    return { variant: 'ok', passed, failed, skipped, duration, testType };
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
