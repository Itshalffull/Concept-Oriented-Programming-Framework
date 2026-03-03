// Manifest Concept Implementation
// Declarative project configuration file describing identity, dependency
// requirements, version ranges, feature selections, registry sources,
// overrides, patches, and target platform constraints.
import type { ConceptHandler } from '@clef/runtime';

let nextId = 1;

/** Reset the ID counter (for testing). */
export function resetManifestIds(): void {
  nextId = 1;
}

/**
 * Validates that a version range string is well-formed semver-like syntax.
 */
function isValidVersionRange(range: string): boolean {
  if (range === '*') return true;
  const stripped = range.replace(/[\^~>=]/g, '');
  const parts = stripped.split('.');
  if (parts.length < 1 || parts.length > 3) return false;
  return parts.every((p) => /^\d+$/.test(p));
}

/**
 * Validates that a module_id is well-formed (non-empty, no whitespace).
 */
function isValidModuleId(moduleId: string): boolean {
  return moduleId.length > 0 && !/\s/.test(moduleId);
}

export const manifestHandler: ConceptHandler = {
  async add(input, storage) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;
    const versionRange = input.version_range as string;
    const edgeType = input.edge_type as string;
    const environment = input.environment as string;
    const features = (input.features as string[]) || [];
    const optional = (input.optional as boolean) || false;

    // Validate module_id
    if (!isValidModuleId(moduleId)) {
      return { variant: 'invalid', message: 'module_id must be non-empty and contain no whitespace' };
    }

    // Validate version_range
    if (!isValidVersionRange(versionRange)) {
      return { variant: 'invalid', message: `Invalid version range: "${versionRange}"` };
    }

    // Ensure project exists
    let project = await storage.get('manifest', projectId);
    if (!project) {
      project = {
        projectId,
        name: projectId,
        version: '0.0.0',
        dependencies: [],
        overrides: [],
        patches: [],
        disabled: [],
        resolutionPolicy: {
          unification_strategy: 'highest',
          feature_unification: 'union',
          prefer_locked: true,
          allowed_updates: 'minor',
        },
        registries: [],
        targetLanguages: [],
        targetPlatforms: [],
      };
    }

    const deps = project.dependencies as Array<{
      module_id: string;
      version_range: string;
      edge_type: string;
      environment: string;
      features: string[];
      optional: boolean;
    }>;

    // Check for existing dependency
    const existingIdx = deps.findIndex((d) => d.module_id === moduleId);
    if (existingIdx >= 0) {
      return { variant: 'exists' };
    }

    deps.push({ module_id: moduleId, version_range: versionRange, edge_type: edgeType, environment, features, optional });
    await storage.put('manifest', projectId, { ...project, dependencies: deps });

    return { variant: 'ok' };
  },

  async remove(input, storage) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    const project = await storage.get('manifest', projectId);
    if (!project) {
      return { variant: 'notfound' };
    }

    const deps = project.dependencies as Array<{ module_id: string }>;
    const idx = deps.findIndex((d) => d.module_id === moduleId);
    if (idx < 0) {
      return { variant: 'notfound' };
    }

    deps.splice(idx, 1);
    await storage.put('manifest', projectId, { ...project, dependencies: deps });

    return { variant: 'ok' };
  },

  async override(input, storage) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;
    const replacementId = input.replacement_id as string | undefined;
    const replacementSource = input.replacement_source as string | undefined;
    const versionPin = input.version_pin as string | undefined;

    // At least one override field must be provided
    if (!replacementId && !replacementSource && !versionPin) {
      return {
        variant: 'invalid',
        message: 'At least one of replacement_id, replacement_source, or version_pin must be provided',
      };
    }

    let project = await storage.get('manifest', projectId);
    if (!project) {
      project = {
        projectId,
        name: projectId,
        version: '0.0.0',
        dependencies: [],
        overrides: [],
        patches: [],
        disabled: [],
        resolutionPolicy: {},
        registries: [],
        targetLanguages: [],
        targetPlatforms: [],
      };
    }

    const overrides = project.overrides as Array<{
      module_id: string;
      replacement_id?: string;
      replacement_source?: string;
      version_pin?: string;
    }>;

    // Update or add the override
    const existingIdx = overrides.findIndex((o) => o.module_id === moduleId);
    const entry = {
      module_id: moduleId,
      replacement_id: replacementId || undefined,
      replacement_source: replacementSource || undefined,
      version_pin: versionPin || undefined,
    };

    if (existingIdx >= 0) {
      overrides[existingIdx] = entry;
    } else {
      overrides.push(entry);
    }

    await storage.put('manifest', projectId, { ...project, overrides });

    return { variant: 'ok' };
  },

  async disable(input, storage) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    const project = await storage.get('manifest', projectId);
    if (!project) {
      return { variant: 'notfound' };
    }

    // Check the module appears somewhere in the dependency graph
    const deps = project.dependencies as Array<{ module_id: string }>;
    const found = deps.some((d) => d.module_id === moduleId);
    if (!found) {
      return { variant: 'notfound' };
    }

    const disabled = (project.disabled as string[]) || [];
    if (!disabled.includes(moduleId)) {
      disabled.push(moduleId);
    }

    await storage.put('manifest', projectId, { ...project, disabled });

    return { variant: 'ok' };
  },

  async enable(input, storage) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    const project = await storage.get('manifest', projectId);
    if (!project) {
      return { variant: 'notfound' };
    }

    const disabled = (project.disabled as string[]) || [];
    const idx = disabled.indexOf(moduleId);
    if (idx < 0) {
      return { variant: 'notfound' };
    }

    disabled.splice(idx, 1);
    await storage.put('manifest', projectId, { ...project, disabled });

    return { variant: 'ok' };
  },

  async merge(input, storage) {
    const baseId = input.base as string;
    const overlayId = input.overlay as string;

    const base = await storage.get('manifest', baseId);
    const overlay = await storage.get('manifest', overlayId);

    if (!base || !overlay) {
      return { variant: 'conflict', message: 'One or both manifests not found' };
    }

    const baseDeps = (base.dependencies || []) as Array<{
      module_id: string;
      version_range: string;
      edge_type: string;
      environment: string;
      features: string[];
      optional: boolean;
    }>;
    const overlayDeps = (overlay.dependencies || []) as typeof baseDeps;

    // Overlay dependencies take precedence
    const mergedDeps = [...baseDeps];
    for (const dep of overlayDeps) {
      const idx = mergedDeps.findIndex((d) => d.module_id === dep.module_id);
      if (idx >= 0) {
        mergedDeps[idx] = dep;
      } else {
        mergedDeps.push(dep);
      }
    }

    // Overrides: overlay takes precedence, check for contradictions
    const baseOverrides = (base.overrides || []) as Array<{
      module_id: string;
      replacement_id?: string;
      replacement_source?: string;
      version_pin?: string;
    }>;
    const overlayOverrides = (overlay.overrides || []) as typeof baseOverrides;

    const mergedOverrides = [...baseOverrides];
    for (const override of overlayOverrides) {
      const idx = mergedOverrides.findIndex((o) => o.module_id === override.module_id);
      if (idx >= 0) {
        // Check for irreconcilable conflict
        const existing = mergedOverrides[idx];
        if (
          existing.replacement_id && override.replacement_id &&
          existing.replacement_id !== override.replacement_id
        ) {
          return {
            variant: 'conflict',
            message: `Contradictory overrides for "${override.module_id}": ` +
              `"${existing.replacement_id}" vs "${override.replacement_id}"`,
          };
        }
        mergedOverrides[idx] = override;
      } else {
        mergedOverrides.push(override);
      }
    }

    // Patches: overlay takes precedence
    const basePatches = (base.patches || []) as Array<{ target_module: string; patch_path: string }>;
    const overlayPatches = (overlay.patches || []) as typeof basePatches;
    const mergedPatches = [...basePatches];
    for (const patch of overlayPatches) {
      const idx = mergedPatches.findIndex((p) => p.target_module === patch.target_module);
      if (idx >= 0) {
        mergedPatches[idx] = patch;
      } else {
        mergedPatches.push(patch);
      }
    }

    // Registries: union with overlay first
    const baseRegistries = (base.registries || []) as Array<{ name: string; url: string; scope?: string }>;
    const overlayRegistries = (overlay.registries || []) as typeof baseRegistries;
    const mergedRegistries = [...overlayRegistries];
    for (const reg of baseRegistries) {
      if (!mergedRegistries.some((r) => r.name === reg.name)) {
        mergedRegistries.push(reg);
      }
    }

    // Disabled: union
    const baseDisabled = (base.disabled || []) as string[];
    const overlayDisabled = (overlay.disabled || []) as string[];
    const mergedDisabled = [...new Set([...baseDisabled, ...overlayDisabled])];

    // Target languages/platforms: intersection
    const baseLangs = (base.targetLanguages || []) as string[];
    const overlayLangs = (overlay.targetLanguages || []) as string[];
    const mergedLangs = baseLangs.length > 0 && overlayLangs.length > 0
      ? baseLangs.filter((l) => overlayLangs.includes(l))
      : [...baseLangs, ...overlayLangs];

    const basePlatforms = (base.targetPlatforms || []) as string[];
    const overlayPlatforms = (overlay.targetPlatforms || []) as string[];
    const mergedPlatforms = basePlatforms.length > 0 && overlayPlatforms.length > 0
      ? basePlatforms.filter((p) => overlayPlatforms.includes(p))
      : [...basePlatforms, ...overlayPlatforms];

    const mergedId = `merged-${nextId++}`;
    const merged = {
      projectId: mergedId,
      name: (overlay.name || base.name) as string,
      version: (overlay.version || base.version) as string,
      dependencies: mergedDeps,
      overrides: mergedOverrides,
      patches: mergedPatches,
      disabled: mergedDisabled,
      resolutionPolicy: overlay.resolutionPolicy || base.resolutionPolicy,
      registries: mergedRegistries,
      targetLanguages: mergedLangs,
      targetPlatforms: mergedPlatforms,
    };

    await storage.put('manifest', mergedId, merged);

    return { variant: 'ok', merged: mergedId };
  },

  async validate(input, storage) {
    const projectId = input.project as string;

    const project = await storage.get('manifest', projectId);
    if (!project) {
      return { variant: 'invalid', errors: ['Project manifest not found'] };
    }

    const errors: string[] = [];

    // Validate dependencies
    const deps = (project.dependencies || []) as Array<{
      module_id: string;
      version_range: string;
      edge_type: string;
    }>;

    for (const dep of deps) {
      if (!isValidModuleId(dep.module_id)) {
        errors.push(`Invalid module_id: "${dep.module_id}"`);
      }
      if (!isValidVersionRange(dep.version_range)) {
        errors.push(`Invalid version range "${dep.version_range}" for module "${dep.module_id}"`);
      }
      if (!dep.edge_type) {
        errors.push(`Missing edge_type for module "${dep.module_id}"`);
      }
    }

    // Validate overrides reference known modules
    const overrides = (project.overrides || []) as Array<{
      module_id: string;
      replacement_id?: string;
      replacement_source?: string;
      version_pin?: string;
    }>;

    for (const override of overrides) {
      if (!override.replacement_id && !override.replacement_source && !override.version_pin) {
        errors.push(`Override for "${override.module_id}" has no replacement_id, replacement_source, or version_pin`);
      }
      if (override.version_pin && !isValidVersionRange(override.version_pin)) {
        errors.push(`Invalid version_pin "${override.version_pin}" in override for "${override.module_id}"`);
      }
    }

    // Validate registries have URLs
    const registries = (project.registries || []) as Array<{ name: string; url: string }>;
    for (const reg of registries) {
      if (!reg.url || reg.url.length === 0) {
        errors.push(`Registry "${reg.name}" has no URL`);
      }
    }

    if (errors.length > 0) {
      return { variant: 'invalid', errors };
    }

    return { variant: 'ok' };
  },
};
