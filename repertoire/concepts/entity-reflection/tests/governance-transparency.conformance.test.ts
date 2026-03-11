// ============================================================
// Governance Transparency Entity Conformance Tests
//
// Validates that governance transparency concepts (AuditTrail,
// DisclosurePolicy) are registered as config or content entities.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseSyncFile } from '../../../../handlers/ts/framework/sync-parser.handler.js';

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSync(subdir: string, name: string): string {
  const path = resolve(SYNCS_DIR, subdir, `${name}.sync`);
  expect(existsSync(path), `Sync file missing: ${path}`).toBe(true);
  return readFileSync(path, 'utf-8');
}

describe('Governance Transparency Entity Syncs', () => {
  const transparencySyncs = [
    'audit-trail-as-content-entity',
    'disclosure-policy-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of transparencySyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-transparency', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance transparency entity structure', () => {
    it('AuditTrailAsContentEntity tags with entity type', () => {
      const source = readSync('governance-transparency', 'audit-trail-as-content-entity');
      const syncs = parseSyncFile(source);
      const tagSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Tag' && a.action === 'addTag',
      ));
      expect(tagSync).toBeDefined();
    });

    it('DisclosurePolicyAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-transparency', 'disclosure-policy-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
