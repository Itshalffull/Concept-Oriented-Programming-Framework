// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Manifest Concept Implementation
// Declarative project configuration file describing identity, dependency
// requirements, version ranges, feature selections, registry sources,
// overrides, patches, and target platform constraints.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

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

/** Build a default empty project manifest. */
function defaultProject(projectId: string): Record<string, unknown> {
  return {
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

type Result = { variant: string; [key: string]: unknown };

const _manifestHandler: FunctionalConceptHandler = {
  add(input: Record<string, unknown>) {
    if (!input.module_id || (typeof input.module_id === 'string' && (input.module_id as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'module_id is required' }) as StorageProgram<Result>;
    }
    if (!input.features || (typeof input.features === 'string' && (input.features as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'features is required' }) as StorageProgram<Result>;
    }
    const projectId = input.project as string;
    const moduleId = input.module_id as string;
    const versionRange = input.version_range as string;
    const edgeType = input.edge_type as string;
    const environment = input.environment as string;
    const features = (input.features as string[]) || [];
    const optional = (input.optional as boolean) || false;

    // Validate module_id
    if (!isValidModuleId(moduleId)) {
      return complete(createProgram(), 'invalid', { message: 'module_id must be non-empty and contain no whitespace' }) as StorageProgram<Result>;
    }

    // Validate version_range
    if (!isValidVersionRange(versionRange)) {
      return complete(createProgram(), 'invalid', { message: `Invalid version range: "${versionRange}"` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    // Resolve to existing or default project
    p = mapBindings(p, (bindings) => {
      return (bindings.project as Record<string, unknown> | null) || defaultProject(projectId);
    }, 'resolvedProject');

    // Check for existing dependency
    p = mapBindings(p, (bindings) => {
      const proj = bindings.resolvedProject as Record<string, unknown>;
      const deps = (proj.dependencies || []) as Array<{ module_id: string }>;
      return deps.some((d) => d.module_id === moduleId);
    }, 'depExists');

    p = branch(p, 'depExists',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = putFrom(b, 'manifest', projectId, (bindings) => {
          const proj = bindings.resolvedProject as Record<string, unknown>;
          const deps = [...((proj.dependencies || []) as Array<Record<string, unknown>>)];
          deps.push({ module_id: moduleId, version_range: versionRange, edge_type: edgeType, environment, features, optional });
          return { ...proj, dependencies: deps };
        });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = branch(p, 'project',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const project = bindings.project as Record<string, unknown>;
          const deps = (project.dependencies || []) as Array<{ module_id: string }>;
          return deps.findIndex((d) => d.module_id === moduleId);
        }, 'idx');

        b2 = branch(b2,
          (bindings) => (bindings.idx as number) < 0,
          (b3) => complete(b3, 'notfound', {}),
          (b3) => {
            let b4 = putFrom(b3, 'manifest', projectId, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const deps = [...((project.dependencies || []) as Array<{ module_id: string }>)];
              deps.splice(bindings.idx as number, 1);
              return { ...project, dependencies: deps };
            });
            return complete(b4, 'ok', {});
          },
        );
        return b2 as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },

  override(input: Record<string, unknown>) {
    if (!input.replacement_id || (typeof input.replacement_id === 'string' && (input.replacement_id as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'replacement_id is required' }) as StorageProgram<Result>;
    }
    if (!input.replacement_source || (typeof input.replacement_source === 'string' && (input.replacement_source as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'replacement_source is required' }) as StorageProgram<Result>;
    }
    if (!input.version_pin || (typeof input.version_pin === 'string' && (input.version_pin as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'version_pin is required' }) as StorageProgram<Result>;
    }
    const projectId = input.project as string;
    const moduleId = input.module_id as string;
    const replacementId = input.replacement_id as string | undefined;
    const replacementSource = input.replacement_source as string | undefined;
    const versionPin = input.version_pin as string | undefined;

    // At least one override field must be provided
    if (!replacementId && !replacementSource && !versionPin) {
      return complete(createProgram(), 'invalid', {
        message: 'At least one of replacement_id, replacement_source, or version_pin must be provided',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = putFrom(p, 'manifest', projectId, (bindings) => {
      const project = (bindings.project as Record<string, unknown> | null) || {
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

      const overrides = [...((project.overrides || []) as Array<{
        module_id: string;
        replacement_id?: string;
        replacement_source?: string;
        version_pin?: string;
      }>)];

      const entry = {
        module_id: moduleId,
        replacement_id: replacementId || undefined,
        replacement_source: replacementSource || undefined,
        version_pin: versionPin || undefined,
      };

      const existingIdx = overrides.findIndex((o) => o.module_id === moduleId);
      if (existingIdx >= 0) {
        overrides[existingIdx] = entry;
      } else {
        overrides.push(entry);
      }

      return { ...project, overrides };
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = branch(p, 'project',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const project = bindings.project as Record<string, unknown>;
          const deps = (project.dependencies || []) as Array<{ module_id: string }>;
          return deps.some((d) => d.module_id === moduleId);
        }, 'found');

        b2 = branch(b2, 'found',
          (b3) => {
            let b4 = putFrom(b3, 'manifest', projectId, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const disabled = [...((project.disabled as string[]) || [])];
              if (!disabled.includes(moduleId)) {
                disabled.push(moduleId);
              }
              return { ...project, disabled };
            });
            return complete(b4, 'ok', {});
          },
          (b3) => complete(b3, 'notfound', {}),
        );
        return b2 as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },

  enable(input: Record<string, unknown>) {
    const projectId = input.project as string;
    const moduleId = input.module_id as string;

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = branch(p, 'project',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const project = bindings.project as Record<string, unknown>;
          const disabled = (project.disabled as string[]) || [];
          return disabled.indexOf(moduleId);
        }, 'idx');

        b2 = branch(b2,
          (bindings) => (bindings.idx as number) < 0,
          (b3) => complete(b3, 'notfound', {}),
          (b3) => {
            let b4 = putFrom(b3, 'manifest', projectId, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const disabled = [...((project.disabled as string[]) || [])];
              disabled.splice(bindings.idx as number, 1);
              return { ...project, disabled };
            });
            return complete(b4, 'ok', {});
          },
        );
        return b2 as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const baseId = input.base as string;
    const overlayId = input.overlay as string;

    let p = createProgram();
    p = get(p, 'manifest', baseId, 'base');
    p = get(p, 'manifest', overlayId, 'overlay');

    p = branch(p,
      (bindings) => !bindings.base || !bindings.overlay,
      (b) => complete(b, 'conflict', { message: 'One or both manifests not found' }),
      (b) => {
        // Compute the merged manifest, detecting conflicts
        let b2 = mapBindings(b, (bindings) => {
          const base = bindings.base as Record<string, unknown>;
          const overlay = bindings.overlay as Record<string, unknown>;

          const baseDeps = (base.dependencies || []) as Array<{
            module_id: string;
            version_range: string;
            edge_type: string;
            environment: string;
            features: string[];
            optional: boolean;
          }>;
          const overlayDeps = (overlay.dependencies || []) as typeof baseDeps;

          const mergedDeps = [...baseDeps];
          for (const dep of overlayDeps) {
            const idx = mergedDeps.findIndex((d) => d.module_id === dep.module_id);
            if (idx >= 0) {
              mergedDeps[idx] = dep;
            } else {
              mergedDeps.push(dep);
            }
          }

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
              const existing = mergedOverrides[idx];
              if (
                existing.replacement_id && override.replacement_id &&
                existing.replacement_id !== override.replacement_id
              ) {
                return {
                  _conflict: true,
                  message: `Contradictory overrides for "${override.module_id}": ` +
                    `"${existing.replacement_id}" vs "${override.replacement_id}"`,
                };
              }
              mergedOverrides[idx] = override;
            } else {
              mergedOverrides.push(override);
            }
          }

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

          const baseRegistries = (base.registries || []) as Array<{ name: string; url: string; scope?: string }>;
          const overlayRegistries = (overlay.registries || []) as typeof baseRegistries;
          const mergedRegistries = [...overlayRegistries];
          for (const reg of baseRegistries) {
            if (!mergedRegistries.some((r) => r.name === reg.name)) {
              mergedRegistries.push(reg);
            }
          }

          const baseDisabled = (base.disabled || []) as string[];
          const overlayDisabled = (overlay.disabled || []) as string[];
          const mergedDisabled = [...new Set([...baseDisabled, ...overlayDisabled])];

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

          return {
            _conflict: false,
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
        }, 'mergeResult');

        b2 = branch(b2,
          (bindings) => !!(bindings.mergeResult as Record<string, unknown>)._conflict,
          (b3) => completeFrom(b3, 'conflict', (bindings) => {
            const mr = bindings.mergeResult as Record<string, unknown>;
            return { message: mr.message as string };
          }),
          (b3) => {
            const mergedId = `merged-${nextId++}`;
            let b4 = putFrom(b3, 'manifest', mergedId, (bindings) => {
              const mr = bindings.mergeResult as Record<string, unknown>;
              return {
                projectId: mergedId,
                name: mr.name,
                version: mr.version,
                dependencies: mr.dependencies,
                overrides: mr.overrides,
                patches: mr.patches,
                disabled: mr.disabled,
                resolutionPolicy: mr.resolutionPolicy,
                registries: mr.registries,
                targetLanguages: mr.targetLanguages,
                targetPlatforms: mr.targetPlatforms,
              };
            });
            return complete(b4, 'ok', { merged: mergedId });
          },
        );
        return b2 as StorageProgram<Result>;
      },
    );

    return p as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    if (!input.project || (typeof input.project === 'string' && (input.project as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'project is required' }) as StorageProgram<Result>;
    }
    const projectId = input.project as string;

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = branch(p, 'project',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const project = bindings.project as Record<string, unknown>;
          const errors: string[] = [];

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

          const registries = (project.registries || []) as Array<{ name: string; url: string }>;
          for (const reg of registries) {
            if (!reg.url || reg.url.length === 0) {
              errors.push(`Registry "${reg.name}" has no URL`);
            }
          }

          return errors;
        }, 'errors');

        b2 = branch(b2,
          (bindings) => ((bindings.errors as string[]).length > 0),
          (b3) => completeFrom(b3, 'invalid', (bindings) => ({ errors: bindings.errors })),
          (b3) => complete(b3, 'ok', {}),
        );
        return b2 as StorageProgram<Result>;
      },
      (b) => complete(b, 'invalid', { errors: ['Project manifest not found'] }),
    );

    return p as StorageProgram<Result>;
  },
};

export const manifestHandler = autoInterpret(_manifestHandler);
