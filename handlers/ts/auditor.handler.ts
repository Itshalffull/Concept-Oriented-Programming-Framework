// @migrated dsl-constructs 2026-03-18
// Auditor Concept Implementation (Package Distribution Suite)
// Vulnerability scanning and policy enforcement for package dependencies.
// Checks resolved lockfile entries against advisory databases and
// organizational policies for license compliance and namespace restrictions.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
export function resetAuditorIds() { nextId = 1; }

/** Severity ordering for sorting advisories (highest first). */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const _handler: FunctionalConceptHandler = {
  audit(input: Record<string, unknown>) {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string;
      version: string;
    }>;

    const id = `audit-${nextId++}`;
    const lockfileHash = createHash('sha256')
      .update(JSON.stringify(lockfileEntries))
      .digest('hex');

    // We need to find advisories for each entry. Since the DSL doesn't support
    // dynamic loops over storage, we'll find all advisories and filter in mapBindings.
    let p = createProgram();
    p = find(p, 'advisory', {}, 'allAdvisories');

    p = mapBindings(p, (bindings) => {
      const allAdvisories = bindings.allAdvisories as Record<string, unknown>[];
      const advisories: Array<{
        module_id: string;
        version: string;
        severity: string;
        cve: string | null;
        description: string;
        fix_version: string | null;
      }> = [];

      for (const entry of lockfileEntries) {
        const matching = allAdvisories.filter(a => a.module_id === entry.module_id);
        for (const advisory of matching) {
          const affectedVersions = advisory.affected_versions as string[] | undefined;
          if (affectedVersions && !affectedVersions.includes(entry.version)) {
            continue;
          }
          advisories.push({
            module_id: entry.module_id,
            version: entry.version,
            severity: advisory.severity as string,
            cve: (advisory.cve as string) || null,
            description: advisory.description as string,
            fix_version: (advisory.fix_version as string) || null,
          });
        }
      }

      advisories.sort((a, b) => {
        const aOrder = SEVERITY_ORDER[a.severity] ?? 99;
        const bOrder = SEVERITY_ORDER[b.severity] ?? 99;
        return aOrder - bOrder;
      });

      return advisories;
    }, 'advisories');

    const auditAt = new Date().toISOString();
    p = putFrom(p, 'audit', id, (bindings) => {
      return {
        id,
        lockfile_hash: lockfileHash,
        advisories: JSON.stringify(bindings.advisories),
        policy_violations: JSON.stringify([]),
        audit_at: auditAt,
      };
    });

    return complete(p, 'ok', { audit: id }) as StorageProgram<Result>;
  },

  checkPolicy(input: Record<string, unknown>) {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string;
      version: string;
    }>;
    const policy = input.policy as {
      allowed_licenses: string[];
      denied_namespaces: string[];
      max_severity: string;
    };

    const id = `audit-${nextId++}`;
    const lockfileHash = createHash('sha256')
      .update(JSON.stringify(lockfileEntries))
      .digest('hex');

    let p = createProgram();
    p = find(p, 'module_license', {}, 'allLicenses');
    p = find(p, 'advisory', {}, 'allAdvisories');

    p = mapBindings(p, (bindings) => {
      const allLicenses = bindings.allLicenses as Record<string, unknown>[];
      const allAdvisories = bindings.allAdvisories as Record<string, unknown>[];
      const maxSeverityOrder = SEVERITY_ORDER[policy.max_severity] ?? 99;

      const violations: Array<{
        module_id: string;
        rule: string;
        message: string;
      }> = [];

      for (const entry of lockfileEntries) {
        for (const ns of policy.denied_namespaces) {
          if (entry.module_id.startsWith(ns)) {
            violations.push({
              module_id: entry.module_id,
              rule: 'denied_namespace',
              message: `Module "${entry.module_id}" is in denied namespace "${ns}"`,
            });
          }
        }

        const moduleInfo = allLicenses.filter(m => m.module_id === entry.module_id);
        if (moduleInfo.length > 0) {
          const license = moduleInfo[0].license as string;
          if (!policy.allowed_licenses.includes(license)) {
            violations.push({
              module_id: entry.module_id,
              rule: 'license',
              message: `License "${license}" is not in allowed list: ${policy.allowed_licenses.join(', ')}`,
            });
          }
        }

        const knownAdvisories = allAdvisories.filter(a => a.module_id === entry.module_id);
        for (const advisory of knownAdvisories) {
          const severity = advisory.severity as string;
          const severityOrder = SEVERITY_ORDER[severity] ?? 99;
          if (severityOrder < maxSeverityOrder) {
            violations.push({
              module_id: entry.module_id,
              rule: 'max_severity',
              message: `Advisory with severity "${severity}" exceeds threshold "${policy.max_severity}"`,
            });
          }
        }
      }

      return violations;
    }, 'violations');

    const auditAt = new Date().toISOString();
    p = putFrom(p, 'audit', id, (bindings) => {
      return {
        id,
        lockfile_hash: lockfileHash,
        advisories: JSON.stringify([]),
        policy_violations: JSON.stringify(bindings.violations),
        audit_at: auditAt,
      };
    });

    return branch(p,
      (bindings) => (bindings.violations as unknown[]).length > 0,
      (thenP) => complete(thenP, 'violations', { audit: id }),
      (elseP) => complete(elseP, 'ok', { audit: id }),
    ) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    const oldAuditId = input.old_audit as string;
    const newAuditId = input.new_audit as string;

    let p = createProgram();
    p = get(p, 'audit', oldAuditId, 'oldAudit');
    p = get(p, 'audit', newAuditId, 'newAudit');

    return branch(p,
      (bindings) => !bindings.oldAudit || !bindings.newAudit,
      (thenP) => complete(thenP, 'ok', { new_advisories: '[]', resolved_advisories: '[]' }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const oldAudit = bindings.oldAudit as Record<string, unknown>;
          const newAudit = bindings.newAudit as Record<string, unknown>;

          const oldAdvisories: Array<{
            module_id: string;
            version: string;
            severity: string;
            cve: string | null;
            description: string;
          }> = JSON.parse(oldAudit.advisories as string);

          const newAdvisories: Array<{
            module_id: string;
            version: string;
            severity: string;
            cve: string | null;
            description: string;
          }> = JSON.parse(newAudit.advisories as string);

          const makeKey = (a: { module_id: string; version: string; cve: string | null }) =>
            `${a.module_id}@${a.version}:${a.cve || 'no-cve'}`;

          const oldKeys = new Set(oldAdvisories.map(makeKey));
          const newKeys = new Set(newAdvisories.map(makeKey));

          const addedAdvisories = newAdvisories
            .filter(a => !oldKeys.has(makeKey(a)))
            .map(a => ({
              module_id: a.module_id,
              version: a.version,
              severity: a.severity,
              cve: a.cve,
              description: a.description,
            }));

          const resolvedAdvisories = oldAdvisories
            .filter(a => !newKeys.has(makeKey(a)))
            .map(a => ({
              module_id: a.module_id,
              version: a.version,
              severity: a.severity,
              cve: a.cve,
              description: a.description,
            }));

          return {
            new_advisories: JSON.stringify(addedAdvisories),
            resolved_advisories: JSON.stringify(resolvedAdvisories),
          };
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const auditorHandler = autoInterpret(_handler);
