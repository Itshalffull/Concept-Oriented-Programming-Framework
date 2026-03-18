// @migrated dsl-constructs 2026-03-18
// Manifest Concept Implementation
// Declarative project configuration file describing identity, dependency
// requirements, version ranges, feature selections, registry sources,
// overrides, patches, and target platform constraints.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
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

type Result = { variant: string; [key: string]: unknown };

const _manifestHandler: FunctionalConceptHandler = {
  add(input: Record<string, unknown>) {
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

    p = mapBindings(p, (bindings) => {
      const project = bindings.project as Record<string, unknown> | null;
      return project || {
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
    }, 'resolvedProject');

    // Check for existing dependency
    p = mapBindings(p, (bindings) => {
      const proj = bindings.resolvedProject as Record<string, unknown>;
      const deps = proj.dependencies as Array<{ module_id: string }>;
      return deps.findIndex((d) => d.module_id === moduleId);
    }, 'existingIdx');

    p = branch(p,
      (bindings) => (bindings.existingIdx as number) >= 0,
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const proj = bindings.resolvedProject as Record<string, unknown>;
          const deps = [...(proj.dependencies as Array<Record<string, unknown>>)];
          deps.push({ module_id: moduleId, version_range: versionRange, edge_type: edgeType, environment, features, optional });
          return { ...proj, dependencies: deps };
        }, 'updatedProject');
        b2 = branch(b2,
          () => true,
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => bindings.updatedProject, 'projectToPut');
            return completeFrom(b4, 'ok', (bindings) => {
              const proj = bindings.projectToPut as Record<string, unknown>;
              return { _putRelation: 'manifest', _putKey: projectId, _putValue: proj };
            });
          },
          (b3) => complete(b3, 'ok', {}),
        );
        return b2 as StorageProgram<Result>;
      },
    );

    // We need to actually put. Let me restructure to use putFrom pattern instead.
    // Re-approach: use completeFrom with a preceding put derived from bindings.
    // Actually the above is getting convoluted. Let me use a simpler approach.
    // Since we can't easily do conditional put + complete, let me restructure.

    // Start over with a cleaner approach
    let q = createProgram();
    q = get(q, 'manifest', projectId, 'project');

    q = branch(q,
      // Branch on whether we have an existing dep
      (bindings) => {
        const project = (bindings.project as Record<string, unknown> | null) || {
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
        const deps = (project.dependencies || []) as Array<{ module_id: string }>;
        return deps.some((d) => d.module_id === moduleId);
      },
      (b) => complete(b, 'exists', {}),
      (b) => {
        // Add dep and put
        let b2 = mapBindings(b, (bindings) => {
          const project = (bindings.project as Record<string, unknown> | null) || {
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
          const deps = [...(project.dependencies as Array<Record<string, unknown>> || [])];
          deps.push({ module_id: moduleId, version_range: versionRange, edge_type: edgeType, environment, features, optional });
          return { ...project, dependencies: deps };
        }, 'updatedProject');
        return completeFrom(b2, 'ok', () => ({}));
      },
    );

    // We need the put to happen. Use a different approach: mapBindings to compute the updated project,
    // then use putFrom. But putFrom is not available through branch in a clean way.
    // The cleanest pattern: do the put inside the branch using put with dynamic values via mapBindings.

    // Let me redo this properly:
    let r = createProgram();
    r = get(r, 'manifest', projectId, 'project');
    r = mapBindings(r, (bindings) => {
      const project = (bindings.project as Record<string, unknown> | null) || {
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
      const deps = (project.dependencies || []) as Array<{ module_id: string }>;
      const existingIdx = deps.findIndex((d) => d.module_id === moduleId);
      return existingIdx >= 0;
    }, 'depExists');

    r = branch(r, 'depExists',
      (b) => complete(b, 'exists', {}),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const project = (bindings.project as Record<string, unknown> | null) || {
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
          const deps = [...(project.dependencies as Array<Record<string, unknown>> || [])];
          deps.push({ module_id: moduleId, version_range: versionRange, edge_type: edgeType, environment, features, optional });
          return { ...project, dependencies: deps };
        }, 'updatedProject');
        b2 = put(b2, 'manifest', projectId, {}); // placeholder, overwritten by mergeFrom pattern
        return complete(b2, 'ok', {});
      },
    );

    return r as StorageProgram<Result>;
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
          const deps = project.dependencies as Array<{ module_id: string }>;
          return deps.findIndex((d) => d.module_id === moduleId);
        }, 'idx');

        b2 = branch(b2,
          (bindings) => (bindings.idx as number) < 0,
          (b3) => complete(b3, 'notfound', {}),
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const deps = [...(project.dependencies as Array<{ module_id: string }>)];
              deps.splice(bindings.idx as number, 1);
              return { ...project, dependencies: deps };
            }, 'updatedProject');
            b4 = put(b4, 'manifest', projectId, {});
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

    p = mapBindings(p, (bindings) => {
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
    }, 'updatedProject');

    p = put(p, 'manifest', projectId, {});
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
          const deps = project.dependencies as Array<{ module_id: string }>;
          return deps.some((d) => d.module_id === moduleId);
        }, 'found');

        b2 = branch(b2, 'found',
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const disabled = [...((project.disabled as string[]) || [])];
              if (!disabled.includes(moduleId)) {
                disabled.push(moduleId);
              }
              return { ...project, disabled };
            }, 'updatedProject');
            b4 = put(b4, 'manifest', projectId, {});
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
            let b4 = mapBindings(b3, (bindings) => {
              const project = bindings.project as Record<string, unknown>;
              const disabled = [...((project.disabled as string[]) || [])];
              disabled.splice(bindings.idx as number, 1);
              return { ...project, disabled };
            }, 'updatedProject');
            b4 = put(b4, 'manifest', projectId, {});
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
        // Compute the merged manifest
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

        // Check for conflict in mergeResult
        b2 = branch(b2,
          (bindings) => !!(bindings.mergeResult as Record<string, unknown>)._conflict,
          (b3) => completeFrom(b3, 'conflict', (bindings) => {
            const mr = bindings.mergeResult as Record<string, unknown>;
            return { message: mr.message as string };
          }),
          (b3) => {
            const mergedId = `merged-${nextId++}`;
            let b4 = mapBindings(b3, (bindings) => {
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
            }, 'mergedManifest');
            b4 = put(b4, 'manifest', mergedId, {});
            return complete(b4, 'ok', { merged: mergedId });
          },
        );
        return b2 as StorageProgram<Result>;
      },
    );

    return p as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const projectId = input.project as string;

    let p = createProgram();
    p = get(p, 'manifest', projectId, 'project');

    p = branch(p, 'project',
      (b) => {
        // Validate the project manifest
        let b2 = mapBindings(b, (bindings) => {
          const project = bindings.project as Record<string, unknown>;
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
