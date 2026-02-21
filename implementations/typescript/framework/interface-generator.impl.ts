// ============================================================
// Generator Concept Implementation
//
// Orchestrates multi-target interface generation from concept
// projections. Plans targets, coordinates pipeline, tracks
// output files and generation history.
// Architecture doc: Interface Kit, Section 1.2
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';
import { generateId, timestamp } from '../../../kernel/src/types.js';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';

// --- Internal Types ---

/** Parsed contents of an interface manifest. */
export interface InterfaceManifest {
  kit: string;
  version: string;
  targets: string[];
  sdkLanguages: string[];
  specFormats: string[];
  concepts: string[];
  outputDir: string;
  formatting: string;
  manifestYaml: Record<string, unknown>;
}

/** A generated file from a provider. */
export interface GeneratedFile {
  path: string;
  content: string;
}

/** Stored generation plan with execution tracking. */
export interface GenerationPlan {
  planId: string;
  kit: string;
  targets: string[];
  sdkLanguages: string[];
  specFormats: string[];
  concepts: string[];
  outputDir: string;
  formatting: string;
  estimatedFiles: number;
  status: string;
  progress: number;
  activeTargets: string[];
  startedAt: string | null;
  completedAt: string | null;
  filesGenerated: number;
  filesUnchanged: number;
  history: GenerationHistoryEntry[];
}

/** A single entry in the generation history log. */
export interface GenerationHistoryEntry {
  generatedAt: string;
  kitVersion: string;
  targets: string[];
  filesGenerated: number;
  breaking: boolean;
}

// --- File Estimation ---

export function estimateFileCount(manifest: InterfaceManifest): number {
  const conceptCount = Math.max(manifest.concepts.length, 1);
  const targetFiles = manifest.targets.length * conceptCount;
  const sdkFiles = manifest.sdkLanguages.length * (conceptCount + 2);
  const specFiles = manifest.specFormats.length;
  const entrypointFiles = manifest.targets.length;
  return targetFiles + sdkFiles + specFiles + entrypointFiles;
}

// --- Known Targets and Provider Map ---

const TARGET_PROVIDERS: Record<string, string> = {
  rest: 'RestTarget',
  graphql: 'GraphqlTarget',
  grpc: 'GrpcTarget',
  cli: 'CliTarget',
  mcp: 'McpTarget',
  'claude-skills': 'ClaudeSkillsTarget',
};

const SDK_PROVIDERS: Record<string, string> = {
  typescript: 'TsSdkTarget',
  python: 'PySdkTarget',
  go: 'GoSdkTarget',
  rust: 'RustSdkTarget',
  java: 'JavaSdkTarget',
  swift: 'SwiftSdkTarget',
};

const SPEC_PROVIDERS: Record<string, string> = {
  openapi: 'OpenapiTarget',
  asyncapi: 'AsyncapiTarget',
};

// --- Provider Handler Registry ---

export type ProviderRegistry = Record<string, ConceptHandler>;

// --- Factory Function ---

/**
 * Create an interface generator handler with access to provider handlers.
 * The factory captures provider references in a closure so that
 * generate() can dispatch to target/SDK/spec providers directly.
 */
export function createInterfaceGeneratorHandler(
  providers: ProviderRegistry,
): ConceptHandler {
  return {
    async plan(
      input: Record<string, unknown>,
      storage: ConceptStorage,
    ): Promise<{ variant: string; [key: string]: unknown }> {
      const kit = input.kit as string;
      const interfaceManifestRaw = input.interfaceManifest as string;

      if (!kit || typeof kit !== 'string') {
        return { variant: 'projectionFailed', concept: '', reason: 'kit is required' };
      }
      if (!interfaceManifestRaw) {
        return { variant: 'projectionFailed', concept: '', reason: 'interfaceManifest is required' };
      }

      let manifest: InterfaceManifest;
      try {
        manifest = JSON.parse(interfaceManifestRaw) as InterfaceManifest;
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        return { variant: 'projectionFailed', concept: kit, reason };
      }

      if (manifest.targets.length === 0) {
        return { variant: 'noTargetsConfigured', kit };
      }

      for (const target of manifest.targets) {
        if (!TARGET_PROVIDERS[target]) {
          return { variant: 'missingProvider', target };
        }
      }

      const estimatedFiles = estimateFileCount(manifest);
      const planId = generateId();
      const plan: GenerationPlan = {
        planId,
        kit: manifest.kit,
        targets: manifest.targets,
        sdkLanguages: manifest.sdkLanguages,
        specFormats: manifest.specFormats,
        concepts: manifest.concepts,
        outputDir: manifest.outputDir,
        formatting: manifest.formatting,
        estimatedFiles,
        status: 'planned',
        progress: 0,
        activeTargets: [],
        startedAt: null,
        completedAt: null,
        filesGenerated: 0,
        filesUnchanged: 0,
        history: [],
      };

      await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

      return {
        variant: 'ok',
        plan: planId,
        targets: manifest.targets,
        concepts: manifest.concepts,
        estimatedFiles,
      };
    },

    /**
     * Execute generation for a previously planned run.
     * Fans out to all registered provider handlers.
     */
    async generate(
      input: Record<string, unknown>,
      storage: ConceptStorage,
    ): Promise<{ variant: string; [key: string]: unknown }> {
      const planId = input.plan as string;
      const projections = (input.projections as Array<{
        conceptName: string;
        conceptManifest: string;
      }>) || [];
      const manifestYaml = (input.manifestYaml as Record<string, unknown>) || {};

      if (!planId) {
        return { variant: 'blocked', plan: '', breakingChanges: ['plan reference is required'] };
      }

      const stored = await storage.get('plans', planId);
      if (!stored) {
        return { variant: 'blocked', plan: planId, breakingChanges: ['plan not found'] };
      }

      const plan = stored as unknown as GenerationPlan;
      const startTime = Date.now();

      plan.status = 'generating';
      plan.startedAt = timestamp();
      plan.progress = 0;
      await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

      const allFiles: GeneratedFile[] = [];
      const errors: string[] = [];
      let stepsDone = 0;
      const totalSteps = plan.targets.length * projections.length
        + plan.sdkLanguages.length * projections.length
        + plan.specFormats.length;

      // --- Generate per target x concept ---
      for (const target of plan.targets) {
        const providerName = TARGET_PROVIDERS[target];
        const handler = providerName ? providers[providerName] : undefined;

        if (!handler?.generate) {
          if (projections.length > 0) {
            errors.push(`No provider handler for target: ${target}`);
          }
          stepsDone += projections.length;
          continue;
        }

        for (const proj of projections) {
          const overrides = getConceptOverrides(manifestYaml, proj.conceptName, target);
          const targetConfig = getTargetConfig(manifestYaml, target);

          try {
            const providerStorage = createInMemoryStorage();
            const result = await handler.generate(
              {
                projection: JSON.stringify(proj),
                config: JSON.stringify(targetConfig),
                overrides: JSON.stringify(overrides),
                allProjections: JSON.stringify(projections),
                manifestYaml: JSON.stringify(manifestYaml),
              },
              providerStorage,
            );

            if (result.variant === 'ok' && Array.isArray(result.files)) {
              const files = result.files as GeneratedFile[];
              for (const f of files) {
                allFiles.push({
                  path: `${target}/${f.path}`,
                  content: f.content,
                });
              }
            } else if (result.variant !== 'ok') {
              errors.push(`${target}/${proj.conceptName}: ${result.variant}`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${target}/${proj.conceptName}: ${msg}`);
          }

          stepsDone++;
          plan.progress = stepsDone / totalSteps;
          await storage.put('plans', planId, plan as unknown as Record<string, unknown>);
        }
      }

      // --- Generate per SDK language x concept ---
      for (const lang of plan.sdkLanguages) {
        const providerName = SDK_PROVIDERS[lang];
        const handler = providerName ? providers[providerName] : undefined;

        if (!handler?.generate) {
          if (projections.length > 0) {
            errors.push(`No provider handler for SDK: ${lang}`);
          }
          stepsDone += projections.length;
          continue;
        }

        for (const proj of projections) {
          const sdkConfig = getSdkConfig(manifestYaml, lang);

          try {
            const providerStorage = createInMemoryStorage();
            const result = await handler.generate(
              {
                projection: JSON.stringify(proj),
                config: JSON.stringify(sdkConfig),
                allProjections: JSON.stringify(projections),
              },
              providerStorage,
            );

            if (result.variant === 'ok' && Array.isArray(result.files)) {
              const files = result.files as GeneratedFile[];
              for (const f of files) {
                allFiles.push({
                  path: `sdk/${lang}/${f.path}`,
                  content: f.content,
                });
              }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`sdk/${lang}/${proj.conceptName}: ${msg}`);
          }

          stepsDone++;
          plan.progress = stepsDone / totalSteps;
          await storage.put('plans', planId, plan as unknown as Record<string, unknown>);
        }
      }

      // --- Generate spec documents ---
      for (const format of plan.specFormats) {
        const providerName = SPEC_PROVIDERS[format];
        const handler = providerName ? providers[providerName] : undefined;

        if (!handler?.generate) {
          errors.push(`No provider handler for spec format: ${format}`);
          stepsDone++;
          continue;
        }

        try {
          const providerStorage = createInMemoryStorage();
          const result = await handler.generate(
            {
              allProjections: JSON.stringify(projections),
              config: JSON.stringify(getTargetConfig(manifestYaml, format)),
              manifestYaml: JSON.stringify(manifestYaml),
            },
            providerStorage,
          );

          if (result.variant === 'ok' && Array.isArray(result.files)) {
            const files = result.files as GeneratedFile[];
            for (const f of files) {
              allFiles.push({
                path: `specs/${f.path}`,
                content: f.content,
              });
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`specs/${format}: ${msg}`);
        }

        stepsDone++;
        plan.progress = stepsDone / totalSteps;
        await storage.put('plans', planId, plan as unknown as Record<string, unknown>);
      }

      const duration = Date.now() - startTime;

      plan.status = errors.length > 0 ? 'partial' : 'complete';
      plan.progress = 1;
      plan.activeTargets = [];
      plan.completedAt = timestamp();
      plan.filesGenerated = allFiles.length;
      plan.filesUnchanged = 0;

      plan.history.push({
        generatedAt: plan.completedAt,
        kitVersion: plan.kit,
        targets: plan.targets,
        filesGenerated: allFiles.length,
        breaking: false,
      });

      await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

      if (errors.length > 0) {
        return {
          variant: 'partial',
          plan: planId,
          files: allFiles,
          filesGenerated: allFiles.length,
          errors,
          duration,
        };
      }

      return {
        variant: 'ok',
        plan: planId,
        files: allFiles,
        filesGenerated: allFiles.length,
        filesUnchanged: 0,
        duration,
      };
    },

    async status(
      input: Record<string, unknown>,
      storage: ConceptStorage,
    ): Promise<{ variant: string; [key: string]: unknown }> {
      const planId = input.plan as string;
      if (!planId) {
        return { variant: 'ok', plan: '', phase: 'unknown', progress: 0, activeTargets: [] };
      }
      const stored = await storage.get('plans', planId);
      if (!stored) {
        return { variant: 'ok', plan: planId, phase: 'not-found', progress: 0, activeTargets: [] };
      }
      const plan = stored as unknown as GenerationPlan;
      return {
        variant: 'ok',
        plan: planId,
        phase: plan.status,
        progress: plan.progress,
        activeTargets: plan.activeTargets,
      };
    },

    async regenerate(
      input: Record<string, unknown>,
      storage: ConceptStorage,
    ): Promise<{ variant: string; [key: string]: unknown }> {
      const planId = input.plan as string;
      const targets = input.targets as string[];
      if (!planId) {
        return { variant: 'ok', plan: '', filesRegenerated: 0 };
      }
      const stored = await storage.get('plans', planId);
      if (!stored) {
        return { variant: 'ok', plan: planId, filesRegenerated: 0 };
      }
      const plan = stored as unknown as GenerationPlan;
      const validTargets = (targets || []).filter(t => plan.targets.includes(t));
      return { variant: 'ok', plan: planId, filesRegenerated: validTargets.length };
    },
  };
}

// --- Backward-compatible static export (for existing tests) ---

export const interfaceGeneratorHandler: ConceptHandler = createInterfaceGeneratorHandler({});

// --- Manifest Helpers ---

function getConceptOverrides(
  manifestYaml: Record<string, unknown>,
  conceptName: string,
  target: string,
): Record<string, unknown> {
  const concepts = manifestYaml?.concepts as Record<string, Record<string, unknown>> | undefined;
  if (!concepts?.[conceptName]) return {};
  const conceptConfig = concepts[conceptName];
  const targetConfig = conceptConfig[target] as Record<string, unknown> | undefined;
  return targetConfig?.actions as Record<string, unknown> || {};
}

function getTargetConfig(
  manifestYaml: Record<string, unknown>,
  target: string,
): Record<string, unknown> {
  const targets = manifestYaml?.targets as Record<string, Record<string, unknown>> | undefined;
  if (!targets?.[target]) return {};
  return targets[target];
}

function getSdkConfig(
  manifestYaml: Record<string, unknown>,
  lang: string,
): Record<string, unknown> {
  const sdk = manifestYaml?.sdk as Record<string, Record<string, unknown>> | undefined;
  if (!sdk?.[lang]) return {};
  return sdk[lang];
}
