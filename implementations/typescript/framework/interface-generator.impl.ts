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

// --- Internal Types ---

/** Parsed contents of an interface manifest JSON document. */
export interface InterfaceManifest {
  kit: string;
  targets: string[];
  sdkLanguages: string[];
  specFormats: string[];
  concepts: string[];
  outputDir: string;
  formatting: string;
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

// --- Manifest Parsing ---

/**
 * Parse an interface manifest JSON string into a typed structure.
 * Validates required fields and provides defaults.
 */
export function parseInterfaceManifest(raw: string): InterfaceManifest {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const kit = parsed.kit as string;
  if (!kit || typeof kit !== 'string') {
    throw new Error('interfaceManifest must contain a "kit" field');
  }

  const targets = toStringArray(parsed.targets);
  const sdkLanguages = toStringArray(parsed.sdkLanguages);
  const specFormats = toStringArray(parsed.specFormats);
  const concepts = toStringArray(parsed.concepts);
  const outputDir = (parsed.outputDir as string) || './generated';
  const formatting = (parsed.formatting as string) || 'prettier';

  return { kit, targets, sdkLanguages, specFormats, concepts, outputDir, formatting };
}

/** Coerce a value to a string array, returning empty array for absent values. */
function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

// --- File Estimation ---

/**
 * Estimate the number of files that will be generated for a plan.
 *
 * Heuristic: each concept produces one file per target, plus one file
 * per SDK language, plus one file per spec format.
 */
export function estimateFileCount(manifest: InterfaceManifest): number {
  const conceptCount = Math.max(manifest.concepts.length, 1);
  const targetFiles = manifest.targets.length * conceptCount;
  const sdkFiles = manifest.sdkLanguages.length * conceptCount;
  const specFiles = manifest.specFormats.length;
  return targetFiles + sdkFiles + specFiles;
}

// --- Known Targets and Provider Map ---

/**
 * Maps generation target names to the provider concept required
 * to service them. A target whose provider is absent cannot be
 * generated.
 */
const TARGET_PROVIDERS: Record<string, string> = {
  rest: 'RestTarget',
  graphql: 'GraphqlTarget',
  grpc: 'GrpcTarget',
  openapi: 'OpenapiTarget',
  asyncapi: 'AsyncapiTarget',
  cli: 'CliTarget',
  mcp: 'McpTarget',
};

// --- Concept Handler ---

export const interfaceGeneratorHandler: ConceptHandler = {

  /**
   * Plan a generation run by parsing the interface manifest, validating
   * targets, and estimating output. Stores the plan for subsequent
   * generate/status/regenerate actions.
   */
  async plan(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const kit = input.kit as string;
    const interfaceManifestRaw = input.interfaceManifest as string;

    if (!kit || typeof kit !== 'string') {
      return { variant: 'projectionFailed', concept: '', reason: 'kit is required and must be a string' };
    }
    if (!interfaceManifestRaw || typeof interfaceManifestRaw !== 'string') {
      return { variant: 'projectionFailed', concept: '', reason: 'interfaceManifest is required and must be a JSON string' };
    }

    // Parse the manifest
    let manifest: InterfaceManifest;
    try {
      manifest = parseInterfaceManifest(interfaceManifestRaw);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return { variant: 'projectionFailed', concept: kit, reason };
    }

    // Validate at least one target is configured
    if (manifest.targets.length === 0) {
      return { variant: 'noTargetsConfigured', kit };
    }

    // Check that each target has a known provider
    for (const target of manifest.targets) {
      const provider = TARGET_PROVIDERS[target];
      if (provider === undefined) {
        // Unknown target names are allowed but warn-worthy; however
        // the concept spec treats them as missing providers.
        return { variant: 'missingProvider', target };
      }
    }

    // Estimate file count
    const estimatedFiles = estimateFileCount(manifest);

    // Build and persist the plan
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
   * Iterates through targets, tracks timing, and records output
   * file counts.
   */
  async generate(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const planId = input.plan as string;
    if (!planId || typeof planId !== 'string') {
      return { variant: 'blocked', plan: '', breakingChanges: ['plan reference is required'] };
    }

    const stored = await storage.get('plans', planId);
    if (!stored) {
      return { variant: 'blocked', plan: planId, breakingChanges: ['plan not found in storage'] };
    }

    const plan = stored as unknown as GenerationPlan;
    const startTime = Date.now();

    // Mark plan as in-progress
    plan.status = 'generating';
    plan.startedAt = timestamp();
    plan.activeTargets = [...plan.targets];
    plan.progress = 0;
    await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

    // Simulate target-by-target generation
    const generated: string[] = [];
    const failed: string[] = [];
    let totalFilesGenerated = 0;
    let totalFilesUnchanged = 0;

    for (let i = 0; i < plan.targets.length; i++) {
      const target = plan.targets[i];
      plan.activeTargets = [target];
      plan.progress = (i + 1) / plan.targets.length;
      await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

      // Each target generates files proportional to concept count
      const conceptCount = Math.max(plan.concepts.length, 1);
      totalFilesGenerated += conceptCount;
      generated.push(target);
    }

    // Account for SDK and spec files
    totalFilesGenerated += plan.sdkLanguages.length * Math.max(plan.concepts.length, 1);
    totalFilesGenerated += plan.specFormats.length;

    // Check for unchanged files via content addressing
    // In a real implementation this would compare hashes; here we
    // record zero unchanged on a fresh generation.
    totalFilesUnchanged = 0;

    const duration = Date.now() - startTime;

    // Finalize plan
    plan.status = 'complete';
    plan.progress = 1;
    plan.activeTargets = [];
    plan.completedAt = timestamp();
    plan.filesGenerated = totalFilesGenerated;
    plan.filesUnchanged = totalFilesUnchanged;

    // Record history entry
    plan.history.push({
      generatedAt: plan.completedAt,
      kitVersion: plan.kit,
      targets: generated,
      filesGenerated: totalFilesGenerated,
      breaking: false,
    });

    await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

    // Return partial if any targets failed
    if (failed.length > 0) {
      return { variant: 'partial', plan: planId, generated, failed };
    }

    return {
      variant: 'ok',
      plan: planId,
      filesGenerated: totalFilesGenerated,
      filesUnchanged: totalFilesUnchanged,
      duration,
    };
  },

  /**
   * Return the current execution status of a generation plan.
   */
  async status(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const planId = input.plan as string;
    if (!planId || typeof planId !== 'string') {
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

  /**
   * Regenerate only the specified targets within an existing plan.
   * Re-uses cached projections when concept specs have not changed.
   */
  async regenerate(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const planId = input.plan as string;
    const targets = input.targets as string[];

    if (!planId || typeof planId !== 'string') {
      return { variant: 'ok', plan: '', filesRegenerated: 0 };
    }

    const stored = await storage.get('plans', planId);
    if (!stored) {
      return { variant: 'ok', plan: planId, filesRegenerated: 0 };
    }

    const plan = stored as unknown as GenerationPlan;

    // Filter requested targets to only those in the original plan
    const validTargets = (targets || []).filter(t => plan.targets.includes(t));

    if (validTargets.length === 0) {
      return { variant: 'ok', plan: planId, filesRegenerated: 0 };
    }

    // Mark plan as regenerating
    plan.status = 'regenerating';
    plan.activeTargets = validTargets;
    plan.progress = 0;
    await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

    // Regenerate each requested target
    let filesRegenerated = 0;
    const conceptCount = Math.max(plan.concepts.length, 1);

    for (let i = 0; i < validTargets.length; i++) {
      filesRegenerated += conceptCount;
      plan.progress = (i + 1) / validTargets.length;
      plan.activeTargets = [validTargets[i]];
      await storage.put('plans', planId, plan as unknown as Record<string, unknown>);
    }

    // Finalize
    plan.status = 'complete';
    plan.progress = 1;
    plan.activeTargets = [];
    plan.filesGenerated = plan.filesGenerated + filesRegenerated;
    plan.completedAt = timestamp();

    // Record history entry for the regeneration
    plan.history.push({
      generatedAt: plan.completedAt,
      kitVersion: plan.kit,
      targets: validTargets,
      filesGenerated: filesRegenerated,
      breaking: false,
    });

    await storage.put('plans', planId, plan as unknown as Record<string, unknown>);

    return { variant: 'ok', plan: planId, filesRegenerated };
  },
};
