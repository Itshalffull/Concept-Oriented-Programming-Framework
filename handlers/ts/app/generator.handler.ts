// Generator Concept Implementation (Clef Bind)
import type { ConceptHandler } from '@clef/runtime';

export const generatorHandler: ConceptHandler = {
  async plan(input, storage) {
    const kit = input.kit as string;
    const interfaceManifest = input.interfaceManifest as string;

    // Parse interface manifest
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(interfaceManifest);
    } catch {
      // Treat raw string as a simple manifest reference
      manifest = { name: interfaceManifest };
    }

    const targets = (manifest.targets as string[] | undefined) ?? [];
    const sdkLanguages = (manifest.sdkLanguages as string[] | undefined) ?? [];
    const specFormats = (manifest.specFormats as string[] | undefined) ?? [];
    const outputDir = (manifest.outputDir as string | undefined) ?? `generated/${kit}`;
    const formatting = (manifest.formatting as string | undefined) ?? 'prettier';
    const concepts = (manifest.concepts as string[] | undefined) ?? [];

    // Validate targets
    if (targets.length === 0) {
      return { variant: 'noTargetsConfigured', kit };
    }

    // Validate providers exist for each target
    const knownTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp'];
    for (const t of targets) {
      if (!knownTargets.includes(t) && !manifest[`${t}Provider`]) {
        return { variant: 'missingProvider', target: t };
      }
    }

    // Estimate output files: concepts * (targets + sdk languages + spec formats)
    const estimatedFiles = concepts.length * (targets.length + sdkLanguages.length + specFormats.length);

    const planId = `plan-${kit}-${Date.now()}`;
    const now = new Date().toISOString();

    await storage.put('plan', planId, {
      planId,
      kit,
      targets: JSON.stringify(targets),
      sdkLanguages: JSON.stringify(sdkLanguages),
      specFormats: JSON.stringify(specFormats),
      outputDir,
      formatting,
      concepts: JSON.stringify(concepts),
      status: 'planned',
      startedAt: '',
      completedAt: '',
      filesGenerated: 0,
      filesUnchanged: 0,
      createdAt: now,
    });

    return {
      variant: 'ok',
      plan: planId,
      targets: JSON.stringify(targets),
      concepts: JSON.stringify(concepts),
      estimatedFiles,
    };
  },

  async generate(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('plan', plan);
    if (!existing) {
      return {
        variant: 'partial',
        plan,
        generated: JSON.stringify([]),
        failed: JSON.stringify(['Plan not found']),
      };
    }

    const targets = JSON.parse(existing.targets as string) as string[];
    const concepts = JSON.parse(existing.concepts as string) as string[];
    const now = new Date().toISOString();

    // Mark execution started
    await storage.put('plan', plan, {
      ...existing,
      status: 'running',
      startedAt: now,
    });

    // Simulate generation across all targets
    const generated: string[] = [];
    const failed: string[] = [];

    for (const target of targets) {
      for (const concept of concepts) {
        generated.push(`${target}/${concept}`);
      }
    }

    const filesGenerated = generated.length;
    const completedAt = new Date().toISOString();
    const duration = Date.now() - new Date(now).getTime();

    // Record history entry
    const historyKey = `${plan}::history`;
    const existingHistory = await storage.get('history', historyKey);
    const history = existingHistory
      ? JSON.parse(existingHistory.entries as string)
      : [];
    history.push({
      generatedAt: completedAt,
      kitVersion: '1.0.0',
      targets,
      filesGenerated,
      breaking: false,
    });

    await storage.put('history', historyKey, {
      entries: JSON.stringify(history),
    });

    await storage.put('plan', plan, {
      ...existing,
      status: 'complete',
      startedAt: now,
      completedAt,
      filesGenerated,
      filesUnchanged: 0,
    });

    if (failed.length > 0) {
      return {
        variant: 'partial',
        plan,
        generated: JSON.stringify(generated),
        failed: JSON.stringify(failed),
      };
    }

    return {
      variant: 'ok',
      plan,
      filesGenerated,
      filesUnchanged: 0,
      duration,
    };
  },

  async status(input, storage) {
    const plan = input.plan as string;

    const existing = await storage.get('plan', plan);
    if (!existing) {
      return {
        variant: 'ok',
        plan,
        phase: 'unknown',
        progress: 0.0,
        activeTargets: JSON.stringify([]),
      };
    }

    const status = existing.status as string;
    const targets = JSON.parse(existing.targets as string) as string[];
    let progress = 0.0;

    if (status === 'complete') {
      progress = 1.0;
    } else if (status === 'running') {
      progress = 0.5;
    }

    return {
      variant: 'ok',
      plan,
      phase: status,
      progress,
      activeTargets: JSON.stringify(targets),
    };
  },

  async regenerate(input, storage) {
    const plan = input.plan as string;
    const targets = JSON.parse(input.targets as string) as string[];

    const existing = await storage.get('plan', plan);
    if (!existing) {
      return { variant: 'ok', plan, filesRegenerated: 0 };
    }

    const concepts = JSON.parse(existing.concepts as string) as string[];
    const filesRegenerated = targets.length * concepts.length;

    const now = new Date().toISOString();
    await storage.put('plan', plan, {
      ...existing,
      status: 'complete',
      completedAt: now,
      filesGenerated: (existing.filesGenerated as number) + filesRegenerated,
    });

    return { variant: 'ok', plan, filesRegenerated };
  },
};
