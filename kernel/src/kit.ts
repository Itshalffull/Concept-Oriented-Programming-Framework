// ============================================================
// Phase 5 — Concept Kits
//
// Kit manifest parser, loader, type alignment validation,
// sync tier enforcement, and override/disable resolution.
//
// A kit is a packaging convention: a directory with a kit.yaml
// manifest, concept specs, syncs, and implementations. The
// framework loads them like any other specs/syncs — the kit
// manifest is metadata for validation tooling and humans.
//
// From Section 9 of the architecture doc:
// "Kits are a packaging convention, not a language construct."
// ============================================================

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { parseSyncFile } from './sync-parser.js';
import type { CompiledSync } from './types.js';

// --- Kit Manifest Types ---

export interface KitManifest {
  kit: {
    name: string;
    version: string;
    description: string;
  };
  concepts: Record<string, KitConceptEntry>;
  syncs: {
    required: KitSyncEntry[];
    recommended: KitSyncEntry[];
  };
  integrations: KitIntegration[];
}

export interface KitConceptEntry {
  spec: string;
  params: Record<string, KitParamDecl>;
}

export interface KitParamDecl {
  as: string;
  description?: string;
}

export interface KitSyncEntry {
  path: string;
  name?: string;
  description: string;
}

export interface KitIntegration {
  kit: string;
  syncs: KitSyncEntry[];
}

// --- Kit Validation Result ---

export interface KitValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// --- Kit Resolved Syncs ---

export interface ResolvedKitSyncs {
  /** All syncs to load (after overrides/disables applied) */
  syncs: CompiledSync[];
  /** Syncs that were overridden by the app */
  overridden: string[];
  /** Syncs that were disabled by the app */
  disabled: string[];
  /** Required syncs that were kept */
  required: string[];
  /** Recommended syncs that were kept */
  recommended: string[];
}

// --- Parse Kit Manifest ---

/**
 * Parse a kit.yaml manifest from a plain object (e.g., parsed YAML/JSON).
 */
export function parseKitManifest(raw: Record<string, unknown>): KitManifest {
  const kit = raw.kit as Record<string, string> | undefined;
  if (!kit || !kit.name || !kit.version) {
    throw new Error('Kit manifest must have kit.name and kit.version');
  }

  const concepts: Record<string, KitConceptEntry> = {};
  const rawConcepts = (raw.concepts || {}) as Record<string, Record<string, unknown>>;
  for (const [name, entry] of Object.entries(rawConcepts)) {
    const rawParams = (entry.params || {}) as Record<string, Record<string, string>>;
    const params: Record<string, KitParamDecl> = {};
    for (const [paramName, paramDecl] of Object.entries(rawParams)) {
      params[paramName] = {
        as: paramDecl.as,
        description: paramDecl.description,
      };
    }
    concepts[name] = {
      spec: entry.spec as string,
      params,
    };
  }

  const syncs: KitManifest['syncs'] = { required: [], recommended: [] };
  const rawSyncs = (raw.syncs || {}) as Record<string, unknown>;

  const rawRequired = (rawSyncs.required || []) as Record<string, unknown>[];
  for (const entry of rawRequired) {
    syncs.required.push({
      path: entry.path as string,
      name: entry.name as string | undefined,
      description: entry.description as string || '',
    });
  }

  const rawRecommended = (rawSyncs.recommended || []) as Record<string, unknown>[];
  for (const entry of rawRecommended) {
    syncs.recommended.push({
      path: entry.path as string,
      name: entry.name as string | undefined,
      description: entry.description as string || '',
    });
  }

  const integrations: KitIntegration[] = [];
  const rawIntegrations = (raw.integrations || []) as Record<string, unknown>[];
  for (const entry of rawIntegrations) {
    const intSyncs: KitSyncEntry[] = [];
    const rawIntSyncs = (entry.syncs || []) as Record<string, unknown>[];
    for (const s of rawIntSyncs) {
      intSyncs.push({
        path: s.path as string,
        name: s.name as string | undefined,
        description: s.description as string || '',
      });
    }
    integrations.push({
      kit: entry.kit as string,
      syncs: intSyncs,
    });
  }

  return {
    kit: {
      name: kit.name,
      version: kit.version,
      description: kit.description || '',
    },
    concepts,
    syncs,
    integrations,
  };
}

// --- Load Kit from Directory ---

/**
 * Load a kit from its directory. Reads kit.yaml, resolves concept
 * spec paths, and parses all sync files.
 */
export function loadKit(kitPath: string): {
  manifest: KitManifest;
  conceptSpecs: Record<string, string>;
  requiredSyncs: { name: string; compiled: CompiledSync[] }[];
  recommendedSyncs: { name: string; compiled: CompiledSync[] }[];
} {
  const manifestPath = resolve(kitPath, 'kit.yaml');
  if (!existsSync(manifestPath)) {
    throw new Error(`Kit manifest not found: ${manifestPath}`);
  }

  // Parse kit.yaml as simple key-value (we accept JSON for testing)
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const manifest = parseKitManifest(raw);

  // Load concept specs
  const conceptSpecs: Record<string, string> = {};
  for (const [name, entry] of Object.entries(manifest.concepts)) {
    const specPath = resolve(kitPath, entry.spec);
    if (existsSync(specPath)) {
      conceptSpecs[name] = readFileSync(specPath, 'utf-8');
    }
  }

  // Load and parse required syncs
  const requiredSyncs: { name: string; compiled: CompiledSync[] }[] = [];
  for (const entry of manifest.syncs.required) {
    const syncPath = resolve(kitPath, entry.path);
    if (existsSync(syncPath)) {
      const source = readFileSync(syncPath, 'utf-8');
      const compiled = parseSyncFile(source);
      requiredSyncs.push({ name: entry.name || compiled[0]?.name || 'unknown', compiled });
    }
  }

  // Load and parse recommended syncs
  const recommendedSyncs: { name: string; compiled: CompiledSync[] }[] = [];
  for (const entry of manifest.syncs.recommended) {
    const syncPath = resolve(kitPath, entry.path);
    if (existsSync(syncPath)) {
      const source = readFileSync(syncPath, 'utf-8');
      const compiled = parseSyncFile(source);
      recommendedSyncs.push({ name: entry.name || compiled[0]?.name || 'unknown', compiled });
    }
  }

  return { manifest, conceptSpecs, requiredSyncs, recommendedSyncs };
}

// --- Type Parameter Alignment Validation ---

/**
 * Validate type parameter alignment within a kit's syncs.
 * Advisory warnings only — does not prevent compilation.
 *
 * Checks that sync variable bindings respect the `as` tag
 * declarations. If a variable flows from a concept param with
 * `as: entity-ref` to a param with `as: field-ref`, that's a warning.
 */
export function validateKitTypeAlignment(
  manifest: KitManifest,
  syncs: CompiledSync[],
): KitValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build a map: concept URI → param name → as tag
  const paramAlignments = new Map<string, Map<string, string>>();
  for (const [conceptName, entry] of Object.entries(manifest.concepts)) {
    const uri = `urn:copf/${conceptName}`;
    const paramMap = new Map<string, string>();
    for (const [paramName, decl] of Object.entries(entry.params)) {
      paramMap.set(paramName.toLowerCase(), decl.as);
    }
    paramAlignments.set(uri, paramMap);
  }

  // For each sync, trace variable flow through when/then clauses
  for (const sync of syncs) {
    // Track which `as` tag each variable is associated with
    const variableTags = new Map<string, { tag: string; source: string }>();

    // From when clause: match variables to concept params
    for (const pattern of sync.when) {
      const conceptParams = paramAlignments.get(pattern.concept);
      if (!conceptParams) continue;

      for (const field of [...pattern.inputFields, ...pattern.outputFields]) {
        if (field.match.type === 'variable') {
          const tag = conceptParams.get(field.name);
          if (tag) {
            const existing = variableTags.get(field.match.name);
            if (existing && existing.tag !== tag) {
              warnings.push(
                `Sync "${sync.name}": variable ?${field.match.name} has conflicting type alignment — ` +
                `"${existing.tag}" (from ${existing.source}) vs "${tag}" (from ${pattern.concept}/${field.name})`
              );
            } else {
              variableTags.set(field.match.name, {
                tag,
                source: `${pattern.concept}/${field.name}`,
              });
            }
          }
        }
      }
    }

    // From then clause: check that passed variables match expected tags
    for (const action of sync.then) {
      const conceptParams = paramAlignments.get(action.concept);
      if (!conceptParams) continue;

      for (const field of action.fields) {
        if (field.value.type === 'variable') {
          const expectedTag = conceptParams.get(field.name);
          const actualBinding = variableTags.get(field.value.name);
          if (expectedTag && actualBinding && actualBinding.tag !== expectedTag) {
            warnings.push(
              `Sync "${sync.name}": passing ?${field.value.name} (${actualBinding.tag}) to ` +
              `${action.concept}/${field.name} which expects ${expectedTag}`
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- Sync Tier Enforcement ---

/**
 * Validate sync tier rules:
 * - Required syncs cannot be disabled
 * - Required syncs must all be present in the final sync set
 * - Overrides must reference existing recommended sync names
 */
export function validateSyncTiers(
  manifest: KitManifest,
  overrides: Record<string, string>,
  disables: string[],
): KitValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect all required sync names
  const requiredNames = new Set<string>();
  for (const entry of manifest.syncs.required) {
    if (entry.name) requiredNames.add(entry.name);
  }

  // Collect all recommended sync names
  const recommendedNames = new Set<string>();
  for (const entry of manifest.syncs.recommended) {
    if (entry.name) recommendedNames.add(entry.name);
  }

  // Rule 1: Cannot disable required syncs
  for (const disabled of disables) {
    if (requiredNames.has(disabled)) {
      errors.push(
        `Cannot disable required sync "${disabled}" from kit "${manifest.kit.name}". ` +
        `Required syncs enforce structural invariants that prevent data corruption.`
      );
    }
  }

  // Rule 2: Overrides must reference existing recommended sync names
  for (const overrideName of Object.keys(overrides)) {
    if (!recommendedNames.has(overrideName)) {
      if (requiredNames.has(overrideName)) {
        errors.push(
          `Cannot override required sync "${overrideName}" from kit "${manifest.kit.name}".`
        );
      } else {
        warnings.push(
          `Override "${overrideName}" does not match any recommended sync in kit "${manifest.kit.name}".`
        );
      }
    }
  }

  // Rule 3: Disabled syncs must reference existing recommended sync names
  for (const disabled of disables) {
    if (!recommendedNames.has(disabled) && !requiredNames.has(disabled)) {
      warnings.push(
        `Disable target "${disabled}" does not match any sync in kit "${manifest.kit.name}".`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- Resolve Kit Syncs ---

/**
 * Compute the final set of syncs for a kit, applying overrides and disables.
 *
 * @param kitPath - Path to the kit directory
 * @param manifest - Parsed kit manifest
 * @param overrides - Map of sync name → override sync file path
 * @param disables - List of sync names to disable
 */
export function resolveKitSyncs(
  kitPath: string,
  manifest: KitManifest,
  overrides: Record<string, string>,
  disables: string[],
): ResolvedKitSyncs {
  const result: ResolvedKitSyncs = {
    syncs: [],
    overridden: [],
    disabled: [],
    required: [],
    recommended: [],
  };

  const disableSet = new Set(disables);

  // Load required syncs (always included, cannot be overridden or disabled)
  for (const entry of manifest.syncs.required) {
    const syncPath = resolve(kitPath, entry.path);
    if (existsSync(syncPath)) {
      const source = readFileSync(syncPath, 'utf-8');
      const compiled = parseSyncFile(source);
      result.syncs.push(...compiled);
      for (const s of compiled) {
        result.required.push(s.name);
      }
    }
  }

  // Load recommended syncs (subject to overrides and disables)
  for (const entry of manifest.syncs.recommended) {
    const syncName = entry.name || '';

    // Check if disabled
    if (disableSet.has(syncName)) {
      result.disabled.push(syncName);
      continue;
    }

    // Check if overridden
    if (syncName in overrides) {
      const overridePath = overrides[syncName];
      if (existsSync(overridePath)) {
        const source = readFileSync(overridePath, 'utf-8');
        const compiled = parseSyncFile(source);
        result.syncs.push(...compiled);
        result.overridden.push(syncName);
      }
      continue;
    }

    // Load the kit's default sync
    const syncPath = resolve(kitPath, entry.path);
    if (existsSync(syncPath)) {
      const source = readFileSync(syncPath, 'utf-8');
      const compiled = parseSyncFile(source);
      result.syncs.push(...compiled);
      for (const s of compiled) {
        result.recommended.push(s.name);
      }
    }
  }

  return result;
}

// --- Kit Scaffolding (copf kit init) ---

/**
 * Scaffold a new kit directory with a template kit.yaml and directory structure.
 */
export function scaffoldKit(kitPath: string, kitName: string): void {
  mkdirSync(kitPath, { recursive: true });
  mkdirSync(resolve(kitPath, 'syncs'), { recursive: true });
  mkdirSync(resolve(kitPath, 'implementations', 'typescript'), { recursive: true });
  mkdirSync(resolve(kitPath, 'tests', 'conformance'), { recursive: true });
  mkdirSync(resolve(kitPath, 'tests', 'integration'), { recursive: true });

  const manifest = {
    kit: {
      name: kitName,
      version: '0.1.0',
      description: `The ${kitName} concept kit.`,
    },
    concepts: {},
    syncs: {
      required: [],
      recommended: [],
    },
    integrations: [],
  };

  writeFileSync(
    resolve(kitPath, 'kit.yaml'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
}

// --- Kit Listing ---

/**
 * List kits referenced by a deployment manifest.
 */
export function listKitsFromDeployment(
  deploymentRaw: Record<string, unknown>,
): { name: string; path: string; overrides: Record<string, string>; disables: string[] }[] {
  const kits = (deploymentRaw.kits || []) as Record<string, unknown>[];
  return kits.map(k => ({
    name: k.name as string,
    path: k.path as string,
    overrides: (k.overrides || {}) as Record<string, string>,
    disables: (k.disable || []) as string[],
  }));
}

// --- Check Overrides ---

/**
 * Verify that all overrides in the deployment manifest reference
 * valid sync names from the kit's recommended syncs.
 */
export function checkOverrides(
  manifest: KitManifest,
  overrides: Record<string, string>,
): KitValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const recommendedNames = new Set(
    manifest.syncs.recommended.map(s => s.name).filter(Boolean) as string[],
  );

  for (const name of Object.keys(overrides)) {
    if (!recommendedNames.has(name)) {
      warnings.push(
        `Override "${name}" does not match any recommended sync in kit "${manifest.kit.name}".`
      );
    }
  }

  return { valid: true, errors, warnings };
}
