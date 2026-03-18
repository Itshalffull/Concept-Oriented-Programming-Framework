// @migrated dsl-constructs 2026-03-18
// Generator Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _generatorHandler: FunctionalConceptHandler = {
  plan(input: Record<string, unknown>) {
    const suite = input.suite as string;
    const interfaceManifest = input.interfaceManifest as string;

    // Parse interface manifest
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(interfaceManifest);
    } catch {
      manifest = { name: interfaceManifest };
    }

    const targets = (manifest.targets as string[] | undefined) ?? [];
    const sdkLanguages = (manifest.sdkLanguages as string[] | undefined) ?? [];
    const specFormats = (manifest.specFormats as string[] | undefined) ?? [];
    const outputDir = (manifest.outputDir as string | undefined) ?? `generated/${suite}`;
    const formatting = (manifest.formatting as string | undefined) ?? 'prettier';
    const concepts = (manifest.concepts as string[] | undefined) ?? [];

    if (targets.length === 0) {
      const p = createProgram();
      return complete(p, 'noTargetsConfigured', { suite }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const knownTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp'];
    for (const t of targets) {
      if (!knownTargets.includes(t) && !manifest[`${t}Provider`]) {
        const p = createProgram();
        return complete(p, 'missingProvider', { target: t }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }

    const estimatedFiles = concepts.length * (targets.length + sdkLanguages.length + specFormats.length);
    const planId = `plan-${suite}-${Date.now()}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'plan', planId, {
      planId,
      suite,
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

    return complete(p, 'ok', {
      plan: planId,
      targets: JSON.stringify(targets),
      concepts: JSON.stringify(concepts),
      estimatedFiles,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'plan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'plan', plan, {
          status: 'complete',
          startedAt: now,
          completedAt: now,
        });
        return complete(b2, 'ok', {
          plan,
          filesGenerated: 0,
          filesUnchanged: 0,
          duration: 0,
        });
      },
      (b) => complete(b, 'partial', {
        plan,
        generated: JSON.stringify([]),
        failed: JSON.stringify(['Plan not found']),
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  status(input: Record<string, unknown>) {
    const plan = input.plan as string;

    let p = createProgram();
    p = spGet(p, 'plan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', {
        plan,
        phase: 'complete',
        progress: 1.0,
        activeTargets: JSON.stringify([]),
      }),
      (b) => complete(b, 'ok', {
        plan,
        phase: 'unknown',
        progress: 0.0,
        activeTargets: JSON.stringify([]),
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  regenerate(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const targets = JSON.parse(input.targets as string) as string[];

    let p = createProgram();
    p = spGet(p, 'plan', plan, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'plan', plan, {
          status: 'complete',
          completedAt: now,
        });
        return complete(b2, 'ok', { plan, filesRegenerated: 0 });
      },
      (b) => complete(b, 'ok', { plan, filesRegenerated: 0 }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const generatorHandler = autoInterpret(_generatorHandler);

