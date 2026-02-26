// ============================================================
// Generator Concept Implementation
//
// Orchestrates multi-target interface generation from concept
// projections. Plans targets, coordinates pipeline, tracks
// output files and generation history.
// Architecture doc: Clef Bind, Section 1.2
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import { generateId, timestamp } from '../../../runtime/types.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';

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
  /** Per-target output directory overrides (target name → relative path). */
  targetOutputDirs: Record<string, string>;
  /** Per-SDK-language output directory overrides (language → relative path). */
  sdkOutputDirs: Record<string, string>;
  /** Output directory override for spec documents (openapi/asyncapi). */
  specOutputDir: string | null;
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

// --- Provider Discovery via register() ---
//
// Provider mappings are built dynamically from each provider's register()
// action metadata rather than hardcoded. Each provider declares a targetKey
// and providerType ('target' | 'sdk' | 'spec') in its register() response,
// which is used to build the dispatch maps at factory initialization time.
// This follows the same self-describing pattern used by framework generators
// (SchemaGen, TypeScriptGen, etc.) and keeps concepts independent — the
// provider never imports or calls PluginRegistry directly.

/** Resolved provider mapping built from register() metadata. */
interface ProviderMapping {
  targetProviders: Record<string, string>;
  sdkProviders: Record<string, string>;
  specProviders: Record<string, string>;
}

/**
 * Build target/SDK/spec dispatch maps by calling register() on each provider.
 * Providers that lack register() are skipped (backward-compatible).
 */
async function discoverProviderMappings(
  providers: Record<string, ConceptHandler>,
): Promise<ProviderMapping> {
  const targetProviders: Record<string, string> = {};
  const sdkProviders: Record<string, string> = {};
  const specProviders: Record<string, string> = {};

  for (const [name, handler] of Object.entries(providers)) {
    if (!handler.register) continue;
    try {
      const meta = await handler.register({}, null as unknown as ConceptStorage);
      if (meta.variant !== 'ok' || !meta.targetKey) continue;
      const key = meta.targetKey as string;
      const type = meta.providerType as string;
      switch (type) {
        case 'target': targetProviders[key] = name; break;
        case 'sdk':    sdkProviders[key] = name;    break;
        case 'spec':   specProviders[key] = name;   break;
      }
    } catch {
      // Skip providers whose register() fails
    }
  }

  return { targetProviders, sdkProviders, specProviders };
}

// --- Provider Handler Registry ---

export type ProviderRegistry = Record<string, ConceptHandler>;

// --- Factory Function ---

/**
 * Create an interface generator handler with access to provider handlers.
 * The factory discovers provider mappings from register() metadata,
 * replacing hardcoded dispatch maps with dynamic discovery.
 */
export function createInterfaceGeneratorHandler(
  providers: ProviderRegistry,
): ConceptHandler {
  // Provider mappings are resolved lazily on first use and cached.
  let mappingsCache: ProviderMapping | null = null;
  async function getMappings(): Promise<ProviderMapping> {
    if (!mappingsCache) {
      mappingsCache = await discoverProviderMappings(providers);
    }
    return mappingsCache;
  }
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

      const mappings = await getMappings();
      for (const target of manifest.targets) {
        if (!mappings.targetProviders[target]) {
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
      const genMappings = await getMappings();
      for (const target of plan.targets) {
        const providerName = genMappings.targetProviders[target];
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
        const providerName = genMappings.sdkProviders[lang];
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
        const providerName = genMappings.specProviders[format];
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
// Includes stub providers with register() metadata so that plan()
// can validate target names via discoverProviderMappings().

function stubProvider(meta: Record<string, unknown>): ConceptHandler {
  return {
    async register() { return { variant: 'ok', ...meta }; },
    async generate() { return { variant: 'ok', files: [], filesGenerated: 0 }; },
  };
}

export const interfaceGeneratorHandler: ConceptHandler = createInterfaceGeneratorHandler({
  RestTarget: stubProvider({ name: 'RestTarget', inputKind: 'InterfaceProjection', outputKind: 'RestRoutes', capabilities: '[]', targetKey: 'rest', providerType: 'target' }),
  GraphqlTarget: stubProvider({ name: 'GraphqlTarget', inputKind: 'InterfaceProjection', outputKind: 'GraphQLSchema', capabilities: '[]', targetKey: 'graphql', providerType: 'target' }),
  GrpcTarget: stubProvider({ name: 'GrpcTarget', inputKind: 'InterfaceProjection', outputKind: 'GrpcProto', capabilities: '[]', targetKey: 'grpc', providerType: 'target' }),
  CliTarget: stubProvider({ name: 'CliTarget', inputKind: 'InterfaceProjection', outputKind: 'CliCommands', capabilities: '[]', targetKey: 'cli', providerType: 'target' }),
  McpTarget: stubProvider({ name: 'McpTarget', inputKind: 'InterfaceProjection', outputKind: 'McpTools', capabilities: '[]', targetKey: 'mcp', providerType: 'target' }),
  ClaudeSkillsTarget: stubProvider({ name: 'ClaudeSkillsTarget', inputKind: 'InterfaceProjection', outputKind: 'ClaudeSkills', capabilities: '[]', targetKey: 'claude-skills', providerType: 'target' }),
  TsSdkTarget: stubProvider({ name: 'TsSdkTarget', inputKind: 'InterfaceProjection', outputKind: 'TypeScriptSdk', capabilities: '[]', targetKey: 'typescript', providerType: 'sdk' }),
  PySdkTarget: stubProvider({ name: 'PySdkTarget', inputKind: 'InterfaceProjection', outputKind: 'PythonSdk', capabilities: '[]', targetKey: 'python', providerType: 'sdk' }),
  GoSdkTarget: stubProvider({ name: 'GoSdkTarget', inputKind: 'InterfaceProjection', outputKind: 'GoSdk', capabilities: '[]', targetKey: 'go', providerType: 'sdk' }),
  RustSdkTarget: stubProvider({ name: 'RustSdkTarget', inputKind: 'InterfaceProjection', outputKind: 'RustSdk', capabilities: '[]', targetKey: 'rust', providerType: 'sdk' }),
  JavaSdkTarget: stubProvider({ name: 'JavaSdkTarget', inputKind: 'InterfaceProjection', outputKind: 'JavaSdk', capabilities: '[]', targetKey: 'java', providerType: 'sdk' }),
  SwiftSdkTarget: stubProvider({ name: 'SwiftSdkTarget', inputKind: 'InterfaceProjection', outputKind: 'SwiftSdk', capabilities: '[]', targetKey: 'swift', providerType: 'sdk' }),
  OpenapiTarget: stubProvider({ name: 'OpenapiTarget', inputKind: 'InterfaceProjection', outputKind: 'OpenApiSpec', capabilities: '[]', targetKey: 'openapi', providerType: 'spec' }),
  AsyncapiTarget: stubProvider({ name: 'AsyncapiTarget', inputKind: 'InterfaceProjection', outputKind: 'AsyncApiSpec', capabilities: '[]', targetKey: 'asyncapi', providerType: 'spec' }),
});

// --- Manifest Helpers ---

function getConceptOverrides(
  manifestYaml: Record<string, unknown>,
  conceptName: string,
  target: string,
): Record<string, unknown> {
  // Check both 'concepts' (conduit-style: concepts as config objects)
  // and 'concept-overrides' (devtools-style: concepts as file paths
  // with overrides in a separate key).
  const concepts = manifestYaml?.concepts as Record<string, Record<string, unknown>> | undefined;
  const conceptOverrides = manifestYaml?.['concept-overrides'] as Record<string, Record<string, unknown>> | undefined;

  const conceptConfig = concepts?.[conceptName] || conceptOverrides?.[conceptName];
  if (!conceptConfig) return {};
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
