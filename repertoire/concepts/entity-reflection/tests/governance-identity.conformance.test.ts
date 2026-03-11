// ============================================================
// Governance Identity Entity Conformance Tests
//
// Validates that governance identity concepts (Membership, Role,
// Permission, SybilResistance, Attestation, AgenticDelegate,
// and 4 sybil resistance methods) are registered as config or
// content entities.
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

describe('Governance Identity Entity Syncs', () => {
  const identitySyncs = [
    'membership-as-content-entity',
    'role-as-config-entity',
    'permission-as-config-entity',
    'sybil-resistance-as-content-entity',
    'attestation-as-content-entity',
    'agentic-delegate-as-config-entity',
    'proof-of-personhood-as-config-entity',
    'stake-threshold-as-config-entity',
    'social-graph-verification-as-config-entity',
    'attestation-sybil-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of identitySyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-identity', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance identity entity structure', () => {
    it('AttestationAsContentEntity creates attests_about Relation', () => {
      const source = readSync('governance-identity', 'attestation-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('RoleAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-identity', 'role-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
