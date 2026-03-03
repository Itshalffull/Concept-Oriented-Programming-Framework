// ============================================================
// Auditor Concept Conformance Tests
//
// Vulnerability scanning and policy enforcement for package
// dependencies. Validates audit, checkPolicy, and diff actions
// against the concept spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  auditorHandler,
  resetAuditorIds,
} from '../handlers/ts/auditor.handler.js';

describe('Auditor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const sampleEntries = [
    { module_id: 'auth', version: '1.0.0' },
    { module_id: 'logging', version: '2.0.0' },
  ];

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAuditorIds();
  });

  describe('audit', () => {
    it('returns ok with advisories when vulnerabilities are found', async () => {
      // Seed an advisory in storage
      await storage.put('advisory', 'adv-1', {
        module_id: 'auth',
        severity: 'high',
        cve: 'CVE-2026-0001',
        description: 'Authentication bypass vulnerability',
        fix_version: '1.1.0',
        affected_versions: ['1.0.0'],
      });

      const result = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.audit).toBe('audit-1');

      const audit = await storage.get('audit', result.audit as string);
      const advisories = JSON.parse(audit!.advisories as string);
      expect(advisories.length).toBe(1);
      expect(advisories[0].module_id).toBe('auth');
      expect(advisories[0].severity).toBe('high');
    });

    it('returns ok with empty advisories when no vulnerabilities exist', async () => {
      const result = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );
      expect(result.variant).toBe('ok');

      const audit = await storage.get('audit', result.audit as string);
      const advisories = JSON.parse(audit!.advisories as string);
      expect(advisories.length).toBe(0);
    });

    it('sorts advisories by severity (critical first)', async () => {
      await storage.put('advisory', 'adv-low', {
        module_id: 'logging',
        severity: 'low',
        cve: 'CVE-2026-0010',
        description: 'Minor info leak',
        affected_versions: ['2.0.0'],
      });
      await storage.put('advisory', 'adv-crit', {
        module_id: 'auth',
        severity: 'critical',
        cve: 'CVE-2026-0020',
        description: 'Critical RCE',
        affected_versions: ['1.0.0'],
      });

      const result = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      const audit = await storage.get('audit', result.audit as string);
      const advisories = JSON.parse(audit!.advisories as string) as Array<{ severity: string }>;
      expect(advisories[0].severity).toBe('critical');
      expect(advisories[1].severity).toBe('low');
    });
  });

  describe('checkPolicy', () => {
    it('returns ok when all entries comply with the policy', async () => {
      const result = await auditorHandler.checkPolicy!(
        {
          lockfile_entries: sampleEntries,
          policy: {
            allowed_licenses: ['MIT', 'Apache-2.0'],
            denied_namespaces: [],
            max_severity: 'critical',
          },
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns violations when a module is in a denied namespace', async () => {
      const result = await auditorHandler.checkPolicy!(
        {
          lockfile_entries: [
            { module_id: 'evil/malware', version: '1.0.0' },
          ],
          policy: {
            allowed_licenses: ['MIT'],
            denied_namespaces: ['evil/'],
            max_severity: 'critical',
          },
        },
        storage,
      );
      expect(result.variant).toBe('violations');

      const audit = await storage.get('audit', result.audit as string);
      const violations = JSON.parse(audit!.policy_violations as string);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('denied_namespace');
    });

    it('returns violations when advisory exceeds max_severity threshold', async () => {
      await storage.put('advisory', 'adv-crit', {
        module_id: 'auth',
        severity: 'critical',
        cve: 'CVE-2026-0001',
        description: 'Critical vulnerability',
        affected_versions: ['1.0.0'],
      });

      const result = await auditorHandler.checkPolicy!(
        {
          lockfile_entries: sampleEntries,
          policy: {
            allowed_licenses: ['MIT'],
            denied_namespaces: [],
            max_severity: 'low',
          },
        },
        storage,
      );
      expect(result.variant).toBe('violations');
    });
  });

  describe('diff', () => {
    it('returns ok with new and resolved advisories', async () => {
      // Seed advisories for first audit
      await storage.put('advisory', 'adv-1', {
        module_id: 'auth',
        severity: 'high',
        cve: 'CVE-2026-0001',
        description: 'Auth bypass',
        affected_versions: ['1.0.0'],
      });

      const firstAudit = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      // Remove the old advisory and add a new one
      await storage.del('advisory', 'adv-1');
      await storage.put('advisory', 'adv-2', {
        module_id: 'logging',
        severity: 'medium',
        cve: 'CVE-2026-0002',
        description: 'Log injection',
        affected_versions: ['2.0.0'],
      });

      const secondAudit = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      const result = await auditorHandler.diff!(
        { old_audit: firstAudit.audit, new_audit: secondAudit.audit },
        storage,
      );
      expect(result.variant).toBe('ok');

      const newAdvisories = JSON.parse(result.new_advisories as string);
      const resolvedAdvisories = JSON.parse(result.resolved_advisories as string);

      expect(newAdvisories.length).toBe(1);
      expect(newAdvisories[0].module_id).toBe('logging');

      expect(resolvedAdvisories.length).toBe(1);
      expect(resolvedAdvisories[0].module_id).toBe('auth');
    });

    it('returns empty diffs when comparing an audit to itself', async () => {
      const audit = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      const result = await auditorHandler.diff!(
        { old_audit: audit.audit, new_audit: audit.audit },
        storage,
      );
      expect(result.variant).toBe('ok');

      const newAdvisories = JSON.parse(result.new_advisories as string);
      const resolvedAdvisories = JSON.parse(result.resolved_advisories as string);
      expect(newAdvisories.length).toBe(0);
      expect(resolvedAdvisories.length).toBe(0);
    });
  });

  describe('multi-step sequences', () => {
    it('detects changes between two successive audits via diff', async () => {
      // First audit: clean
      const first = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      // Add an advisory
      await storage.put('advisory', 'adv-new', {
        module_id: 'auth',
        severity: 'high',
        cve: 'CVE-2026-0099',
        description: 'New vulnerability discovered',
        affected_versions: ['1.0.0'],
      });

      // Second audit: finds the new advisory
      const second = await auditorHandler.audit!(
        { lockfile_entries: sampleEntries },
        storage,
      );

      // Diff reveals the new advisory
      const diffResult = await auditorHandler.diff!(
        { old_audit: first.audit, new_audit: second.audit },
        storage,
      );
      expect(diffResult.variant).toBe('ok');

      const newAdvisories = JSON.parse(diffResult.new_advisories as string);
      expect(newAdvisories.length).toBe(1);
      expect(newAdvisories[0].cve).toBe('CVE-2026-0099');

      const resolvedAdvisories = JSON.parse(diffResult.resolved_advisories as string);
      expect(resolvedAdvisories.length).toBe(0);
    });
  });
});
