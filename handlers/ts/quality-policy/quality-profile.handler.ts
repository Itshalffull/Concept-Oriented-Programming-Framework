// @clef-handler style=functional
// ============================================================
// QualityProfile Handler
//
// Compose quality rules into named, inheritable profiles that
// define which rules are active and with what severity and
// parameters. Support progressive quality adoption through
// profile inheritance.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, mergeFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Functional handler (pure StorageProgram construction)
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {

  // ---- register -----------------------------------------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'QualityProfile' });
  },

  // ---- create -------------------------------------------------------------
  create(input: Record<string, unknown>): StorageProgram<Result> {
    const name = input.name as string;
    const description = (input.description as string | undefined) ?? null;
    const parentName = (input.parent as string | undefined) ?? null;
    const language = (input.language as string | undefined) ?? null;

    let p = createProgram();
    p = find(p, 'profile', { name }, '_existing');

    return branch(p,
      (bindings) => {
        const existing = (bindings._existing || []) as unknown[];
        return existing.length > 0;
      },
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        if (parentName) {
          let b2 = find(b, 'profile', { name: parentName }, '_parentResults');
          return branch(b2,
            (bindings) => {
              const parents = (bindings._parentResults || []) as unknown[];
              return parents.length === 0;
            },
            (b3) => complete(b3, 'parentNotFound', { parent: parentName }),
            (b3) => {
              const profileId = `profile-${name}-${Date.now()}`;
              let b4 = put(b3, 'profile', profileId, {
                name, description, parent: parentName, language,
                isDefault: false, assignments: [],
              });
              return complete(b4, 'ok', { profile: profileId });
            },
          );
        }
        const profileId = `profile-${name}-${Date.now()}`;
        let b2 = put(b, 'profile', profileId, {
          name, description, parent: null, language,
          isDefault: false, assignments: [],
        });
        return complete(b2, 'ok', { profile: profileId });
      },
    );
  },

  // ---- addRule -------------------------------------------------------------
  addRule(input: Record<string, unknown>): StorageProgram<Result> {
    const profileId = input.profile as string;
    const ruleId = input.ruleId as string;
    const severityOverride = (input.severityOverride as string | undefined) ?? null;
    const parameters = (input.parameters as Array<{ key: string; value: string }> | undefined) ?? [];

    let p = createProgram();
    p = get(p, 'profile', profileId, '_profile');

    return branch(p,
      (bindings) => bindings._profile == null,
      (b) => complete(b, 'profileNotFound', { profile: profileId }),
      (b) => {
        return branch(b,
          (bindings) => {
            const profile = bindings._profile as Record<string, unknown>;
            const assignments = (profile.assignments || []) as Array<{ ruleId: string }>;
            return assignments.some(a => a.ruleId === ruleId);
          },
          (b2) => complete(b2, 'alreadyAssigned', { profile: profileId, ruleId }),
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const profile = bindings._profile as Record<string, unknown>;
              const assignments = [...((profile.assignments || []) as unknown[])];
              assignments.push({ ruleId, enabled: true, severityOverride, parameters });
              return { ...profile, assignments };
            }, '_updated');
            b3 = mergeFrom(b3, 'profile', profileId, (bindings) => bindings._updated as Record<string, unknown>);
            return complete(b3, 'ok', { profile: profileId });
          },
        );
      },
    );
  },

  // ---- removeRule ----------------------------------------------------------
  removeRule(input: Record<string, unknown>): StorageProgram<Result> {
    const profileId = input.profile as string;
    const ruleId = input.ruleId as string;

    let p = createProgram();
    p = get(p, 'profile', profileId, '_profile');

    return branch(p,
      (bindings) => bindings._profile == null,
      (b) => complete(b, 'profileNotFound', { profile: profileId }),
      (b) => {
        return branch(b,
          (bindings) => {
            const profile = bindings._profile as Record<string, unknown>;
            const assignments = (profile.assignments || []) as Array<{ ruleId: string }>;
            return !assignments.some(a => a.ruleId === ruleId);
          },
          (b2) => complete(b2, 'notAssigned', { ruleId }),
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const profile = bindings._profile as Record<string, unknown>;
              const assignments = ((profile.assignments || []) as Array<{ ruleId: string }>)
                .filter(a => a.ruleId !== ruleId);
              return { ...profile, assignments };
            }, '_updated');
            b3 = mergeFrom(b3, 'profile', profileId, (bindings) => bindings._updated as Record<string, unknown>);
            return complete(b3, 'ok', { profile: profileId });
          },
        );
      },
    );
  },

  // ---- configure -----------------------------------------------------------
  configure(input: Record<string, unknown>): StorageProgram<Result> {
    const profileId = input.profile as string;
    const ruleId = input.ruleId as string;
    const severityOverride = (input.severityOverride as string | undefined) ?? null;
    const parameters = (input.parameters as Array<{ key: string; value: string }> | undefined) ?? [];

    let p = createProgram();
    p = get(p, 'profile', profileId, '_profile');

    return branch(p,
      (bindings) => bindings._profile == null,
      (b) => complete(b, 'profileNotFound', { profile: profileId }),
      (b) => {
        return branch(b,
          (bindings) => {
            const profile = bindings._profile as Record<string, unknown>;
            const assignments = (profile.assignments || []) as Array<{ ruleId: string }>;
            return !assignments.some(a => a.ruleId === ruleId);
          },
          (b2) => complete(b2, 'notAssigned', { ruleId }),
          (b2) => {
            let b3 = mapBindings(b2, (bindings) => {
              const profile = bindings._profile as Record<string, unknown>;
              const assignments = ((profile.assignments || []) as Array<Record<string, unknown>>)
                .map(a => {
                  if ((a.ruleId as string) === ruleId) {
                    return { ...a, severityOverride, parameters };
                  }
                  return a;
                });
              return { ...profile, assignments };
            }, '_updated');
            b3 = mergeFrom(b3, 'profile', profileId, (bindings) => bindings._updated as Record<string, unknown>);
            return complete(b3, 'ok', { profile: profileId });
          },
        );
      },
    );
  },

  // ---- resolve -------------------------------------------------------------
  resolve(input: Record<string, unknown>): StorageProgram<Result> {
    const profileId = input.profile as string;

    let p = createProgram();
    p = get(p, 'profile', profileId, '_profile');

    return branch(p,
      (bindings) => bindings._profile == null,
      (b) => complete(b, 'profileNotFound', { profile: profileId }),
      (b) => {
        return completeFrom(
          find(b, 'profile', {}, '_allProfiles'),
          'ok',
          (bindings) => {
            const profile = bindings._profile as Record<string, unknown>;
            const allProfiles = (bindings._allProfiles || []) as Array<Record<string, unknown>>;

            const effectiveRules: Array<{
              ruleId: string; severity: string; source: string;
              parameters: Array<{ key: string; value: string }>;
            }> = [];

            const ownAssignments = (profile.assignments || []) as Array<Record<string, unknown>>;
            const ownRuleIds = new Set(ownAssignments.map(a => a.ruleId as string));

            // Walk parent chain to collect inherited rules
            let currentParentName = profile.parent as string | null;
            const visited = new Set<string>();
            while (currentParentName && !visited.has(currentParentName)) {
              visited.add(currentParentName);
              const parentProfile = allProfiles.find(p => (p.name as string) === currentParentName);
              if (!parentProfile) break;
              const parentAssignments = (parentProfile.assignments || []) as Array<Record<string, unknown>>;
              for (const pa of parentAssignments) {
                const rid = pa.ruleId as string;
                if (!ownRuleIds.has(rid)) {
                  effectiveRules.push({
                    ruleId: rid,
                    severity: (pa.severityOverride as string) || 'major',
                    source: 'inherited',
                    parameters: (pa.parameters || []) as Array<{ key: string; value: string }>,
                  });
                  ownRuleIds.add(rid);
                }
              }
              currentParentName = parentProfile.parent as string | null;
            }

            // Add own rules (may override inherited)
            for (const a of ownAssignments) {
              if ((a.enabled as boolean) !== false) {
                const idx = effectiveRules.findIndex(r => r.ruleId === (a.ruleId as string));
                if (idx >= 0) {
                  effectiveRules[idx] = {
                    ruleId: a.ruleId as string,
                    severity: (a.severityOverride as string) || 'major',
                    source: 'overridden',
                    parameters: (a.parameters || []) as Array<{ key: string; value: string }>,
                  };
                } else {
                  effectiveRules.push({
                    ruleId: a.ruleId as string,
                    severity: (a.severityOverride as string) || 'major',
                    source: 'own',
                    parameters: (a.parameters || []) as Array<{ key: string; value: string }>,
                  });
                }
              }
            }

            return { effectiveRules };
          },
        );
      },
    );
  },

  // ---- setDefault ----------------------------------------------------------
  setDefault(input: Record<string, unknown>): StorageProgram<Result> {
    const profileId = input.profile as string;

    let p = createProgram();
    p = get(p, 'profile', profileId, '_profile');

    return branch(p,
      (bindings) => bindings._profile == null,
      (b) => complete(b, 'profileNotFound', { profile: profileId }),
      (b) => {
        let b2 = find(b, 'profile', { isDefault: true }, '_defaults');
        return completeFrom(
          merge(b2, 'profile', profileId, { isDefault: true }),
          'ok',
          (bindings) => {
            const defaults = (bindings._defaults || []) as Array<Record<string, unknown>>;
            const previous = defaults.length > 0
              ? (defaults[0] as Record<string, unknown>).name as string
              : null;
            return { profile: profileId, previous };
          },
        );
      },
    );
  },
};

// ---------------------------------------------------------------------------
// Export auto-interpreted handler
// ---------------------------------------------------------------------------

export const qualityProfileHandler = autoInterpret(_handler);
export default qualityProfileHandler;
