// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Generator Concept Implementation
//
// Orchestrates multi-target interface generation from concept
// projections. Plans targets, coordinates pipeline, tracks
// output files and generation history.
// Architecture doc: Clef Bind, Section 1.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, perform, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptHandler } from '../../../runtime/types.js';
import { generateId, timestamp } from '../../../runtime/types.js';

// --- Internal Types ---

/** Parsed contents of an interface manifest. */
export interface InterfaceManifest {
  suite: string;
  version: string;
  targets: string[];
  sdkLanguages: string[];
  specFormats: string[];
  concepts: string[];
  outputDir: string;
  formatting: string;
  manifestYaml: Record<string, unknown>;
  /** Per-target output directory overrides (target name -> relative path). */
  targetOutputDirs: Record<string, string>;
  /** Per-SDK-language output directory overrides (language -> relative path). */
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
  suite: string;
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
  suiteVersion: string;
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
 * Note: This uses synchronous register() calls since providers return
 * simple metadata without storage operations.
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
      // register() may return a Promise (autoInterpret-wrapped) or sync result
      const meta = handler.register({}, null as never);
      const resolved = (meta && typeof (meta as { then?: unknown }).then === 'function')
        ? await (meta as Promise<Record<string, unknown>>)
        : meta as Record<string, unknown>;
      if (!resolved || resolved.variant !== 'ok' || !resolved.targetKey) continue;
      const key = resolved.targetKey as string;
      const type = resolved.providerType as string;
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

/** Synchronous variant for stub providers that return sync register() results. */
function discoverProviderMappingsSync(
  providers: Record<string, ConceptHandler>,
): ProviderMapping {
  const targetProviders: Record<string, string> = {};
  const sdkProviders: Record<string, string> = {};
  const specProviders: Record<string, string> = {};

  for (const [name, handler] of Object.entries(providers)) {
    if (!handler.register) continue;
    try {
      const meta = handler.register({}, null as never) as Record<string, unknown>;
      if (!meta || typeof (meta as { then?: unknown }).then === 'function') continue;
      if (meta.variant !== 'ok' || !meta.targetKey) continue;
      const key = meta.targetKey as string;
      const type = meta.providerType as string;
      switch (type) {
        case 'target': targetProviders[key] = name; break;
        case 'sdk':    sdkProviders[key] = name; break;
        case 'spec':   specProviders[key] = name; break;
      }
    } catch { /* skip */ }
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
/**
 * Create an interface generator handler (async). Use when providers are
 * autoInterpret-wrapped (register() returns Promises).
 */
export async function createInterfaceGeneratorHandler(
  providers: ProviderRegistry,
): Promise<ReturnType<typeof autoInterpret>> {
  const mappingsCache = await discoverProviderMappings(providers);
  return _buildHandler(mappingsCache, providers);
}

/**
 * Create an interface generator handler (sync). Use when providers have
 * synchronous register() (e.g., stub providers for static exports/tests).
 */
export function createInterfaceGeneratorHandlerSync(
  providers: ProviderRegistry,
): ReturnType<typeof autoInterpret> {
  const mappingsCache = discoverProviderMappingsSync(providers);
  return _buildHandler(mappingsCache, providers);
}

function _buildHandler(
  mappingsCache: ProviderMapping,
  providers: ProviderRegistry,
): ReturnType<typeof autoInterpret> {
  function getMappings(): ProviderMapping {
    return mappingsCache;
  }

  const handler: FunctionalConceptHandler = {
    plan(
      input: Record<string, unknown>,
    ) {
      const suite = input.suite as string;
      const interfaceManifestRaw = input.interfaceManifest as string;

      if (!suite || typeof suite !== 'string') {
        let p = createProgram();
        return complete(p, 'projectionFailed', { concept: '', reason: 'suite is required' });
      }
      if (!interfaceManifestRaw) {
        let p = createProgram();
        return complete(p, 'projectionFailed', { concept: '', reason: 'interfaceManifest is required' });
      }

      let manifest: InterfaceManifest;
      try {
        manifest = JSON.parse(interfaceManifestRaw) as InterfaceManifest;
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        let p = createProgram();
        return complete(p, 'projectionFailed', { concept: suite, reason });
      }

      if (manifest.targets.length === 0) {
        let p = createProgram();
        return complete(p, 'noTargetsConfigured', { suite });
      }

      const mappings = getMappings();
      for (const target of manifest.targets) {
        if (!mappings.targetProviders[target] && !mappings.specProviders[target] && !mappings.sdkProviders[target]) {
          let p = createProgram();
          return complete(p, 'missingProvider', { target });
        }
      }

      const estimatedFiles = estimateFileCount(manifest);
      const planId = generateId();
      const plan: GenerationPlan = {
        planId,
        suite: manifest.suite,
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

      let p = createProgram();
      p = put(p, 'plans', planId, plan as unknown as Record<string, unknown>);

      return complete(p, 'ok', {
        plan: planId,
        targets: manifest.targets,
        concepts: manifest.concepts,
        estimatedFiles,
      });
    },

    /**
     * Execute generation for a previously planned run.
     * Fans out to all registered provider handlers via perform() transport effects.
     */
    generate(
      input: Record<string, unknown>,
    ) {
      const planId = input.plan as string;
      const projections = (input.projections as Array<{
        conceptName: string;
        conceptManifest: string;
      }>) || [];
      const manifestYaml = (input.manifestYaml as Record<string, unknown>) || {};

      if (!planId) {
        let p = createProgram();
        return complete(p, 'blocked', { plan: '', breakingChanges: ['plan reference is required'] });
      }

      let p = createProgram();
      p = get(p, 'plans', planId, 'storedPlan');

      p = branch(p, 'storedPlan',
        (b) => {
          // Plan found — perform generation via transport effect
          // The interpreter handles the async provider dispatch
          let b2 = perform(b, 'interface-gen', 'generateAll', {
            planId,
            projections: JSON.stringify(projections),
            manifestYaml: JSON.stringify(manifestYaml),
          }, 'genResult');

          return completeFrom(b2, 'ok', (bindings) => {
            const genResult = bindings.genResult as Record<string, unknown> | null;
            return {
              plan: planId,
              files: genResult?.files || [],
              filesGenerated: genResult?.filesGenerated || 0,
              filesUnchanged: genResult?.filesUnchanged || 0,
              duration: genResult?.duration || 0,
              errors: genResult?.errors || [],
            };
          });
        },
        (b) => complete(b, 'blocked', { plan: planId, breakingChanges: ['plan not found'] }),
      );

      return p;
    },

    status(
      input: Record<string, unknown>,
    ) {
      const planId = input.plan as string;
      if (!planId) {
        let p = createProgram();
        return complete(p, 'ok', { plan: '', phase: 'unknown', progress: 0, activeTargets: [] });
      }
      let p = createProgram();
      p = get(p, 'plans', planId, 'storedPlan');

      p = branch(p, 'storedPlan',
        (b) => completeFrom(b, 'ok', (bindings) => {
          const plan = bindings.storedPlan as Record<string, unknown>;
          return {
            plan: planId,
            phase: plan.status as string,
            progress: plan.progress as number,
            activeTargets: plan.activeTargets as string[],
          };
        }),
        (b) => complete(b, 'ok', { plan: planId, phase: 'not-found', progress: 0, activeTargets: [] }),
      );

      return p;
    },

    regenerate(
      input: Record<string, unknown>,
    ) {
      const planId = input.plan as string;
      const targets = input.targets as string[];
      if (!planId) {
        let p = createProgram();
        return complete(p, 'ok', { plan: '', filesRegenerated: 0 });
      }

      let p = createProgram();
      p = get(p, 'plans', planId, 'storedPlan');

      p = branch(p, 'storedPlan',
        (b) => completeFrom(b, 'ok', (bindings) => {
          const plan = bindings.storedPlan as Record<string, unknown>;
          const planTargets = (plan.targets as string[]) || [];
          const validTargets = (targets || []).filter(t => planTargets.includes(t));
          return { plan: planId, filesRegenerated: validTargets.length };
        }),
        (b) => complete(b, 'ok', { plan: planId, filesRegenerated: 0 }),
      );

      return p;
    },
  };

  return autoInterpret(handler);
}

// --- Backward-compatible static export (for existing tests) ---
// Includes stub providers with register() metadata so that plan()
// can validate target names via discoverProviderMappings().

function stubProvider(meta: Record<string, unknown>): ConceptHandler {
  return {
    register(_input: Record<string, unknown>) { return { variant: 'ok', ...meta }; },
    generate() { return { variant: 'ok', files: [], filesGenerated: 0 }; },
  };
}

export const interfaceGeneratorHandler = createInterfaceGeneratorHandlerSync({
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
