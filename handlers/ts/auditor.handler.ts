// Auditor Concept Implementation (Package Distribution Suite)
// Vulnerability scanning and policy enforcement for package dependencies.
// Checks resolved lockfile entries against advisory databases and
// organizational policies for license compliance and namespace restrictions.
import type { ConceptHandler } from '@clef/runtime';
import { createHash } from 'crypto';

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

export const auditorHandler: ConceptHandler = {
  async audit(input, storage) {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string;
      version: string;
    }>;

    const id = `audit-${nextId++}`;
    const lockfileHash = createHash('sha256')
      .update(JSON.stringify(lockfileEntries))
      .digest('hex');

    // Scan each entry against known advisories in storage
    const advisories: Array<{
      module_id: string;
      version: string;
      severity: string;
      cve: string | null;
      description: string;
      fix_version: string | null;
    }> = [];

    for (const entry of lockfileEntries) {
      // Look up advisories matching this module
      const knownAdvisories = await storage.find('advisory', {
        module_id: entry.module_id,
      });

      for (const advisory of knownAdvisories) {
        // Check if the entry's version is affected
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

    // Sort advisories by severity (critical first)
    advisories.sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.severity] ?? 99;
      const bOrder = SEVERITY_ORDER[b.severity] ?? 99;
      return aOrder - bOrder;
    });

    const auditAt = new Date().toISOString();

    await storage.put('audit', id, {
      id,
      lockfile_hash: lockfileHash,
      advisories: JSON.stringify(advisories),
      policy_violations: JSON.stringify([]),
      audit_at: auditAt,
    });

    return { variant: 'ok', audit: id };
  },

  async checkPolicy(input, storage) {
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

    const violations: Array<{
      module_id: string;
      rule: string;
      message: string;
    }> = [];

    const maxSeverityOrder = SEVERITY_ORDER[policy.max_severity] ?? 99;

    for (const entry of lockfileEntries) {
      // Check denied namespaces
      for (const ns of policy.denied_namespaces) {
        if (entry.module_id.startsWith(ns)) {
          violations.push({
            module_id: entry.module_id,
            rule: 'denied_namespace',
            message: `Module "${entry.module_id}" is in denied namespace "${ns}"`,
          });
        }
      }

      // Check license compliance
      const moduleInfo = await storage.find('module_license', {
        module_id: entry.module_id,
      });
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

      // Check severity threshold from advisories
      const knownAdvisories = await storage.find('advisory', {
        module_id: entry.module_id,
      });
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

    const auditAt = new Date().toISOString();

    await storage.put('audit', id, {
      id,
      lockfile_hash: lockfileHash,
      advisories: JSON.stringify([]),
      policy_violations: JSON.stringify(violations),
      audit_at: auditAt,
    });

    if (violations.length > 0) {
      return { variant: 'violations', audit: id };
    }

    return { variant: 'ok', audit: id };
  },

  async diff(input, storage) {
    const oldAuditId = input.old_audit as string;
    const newAuditId = input.new_audit as string;

    const oldAudit = await storage.get('audit', oldAuditId);
    const newAudit = await storage.get('audit', newAuditId);

    if (!oldAudit || !newAudit) {
      return { variant: 'ok', new_advisories: '[]', resolved_advisories: '[]' };
    }

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

    // Build key function for comparison
    const makeKey = (a: { module_id: string; version: string; cve: string | null }) =>
      `${a.module_id}@${a.version}:${a.cve || 'no-cve'}`;

    const oldKeys = new Set(oldAdvisories.map(makeKey));
    const newKeys = new Set(newAdvisories.map(makeKey));

    // New advisories: in new but not in old
    const addedAdvisories = newAdvisories
      .filter(a => !oldKeys.has(makeKey(a)))
      .map(a => ({
        module_id: a.module_id,
        version: a.version,
        severity: a.severity,
        cve: a.cve,
        description: a.description,
      }));

    // Resolved advisories: in old but not in new
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
      variant: 'ok',
      new_advisories: JSON.stringify(addedAdvisories),
      resolved_advisories: JSON.stringify(resolvedAdvisories),
    };
  },
};
