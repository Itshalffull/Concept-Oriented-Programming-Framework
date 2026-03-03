// ============================================================
// Governance Structure Entity Conformance Tests
//
// Validates that governance structure concepts (Polity, Circle,
// Delegation, Weight, and 6 weight sources) are registered as
// config or content entities with proper Relations.
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

describe('Governance Structure Entity Syncs', () => {
  const structureSyncs = [
    'polity-as-config-entity',
    'circle-as-config-entity',
    'delegation-as-content-entity',
    'weight-as-content-entity',
    'token-balance-as-config-entity',
    'reputation-weight-as-config-entity',
    'stake-weight-as-config-entity',
    'equal-weight-as-config-entity',
    'vote-escrow-as-config-entity',
    'quadratic-weight-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of structureSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-structure', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance structure entity structure', () => {
    it('DelegationAsContentEntity creates delegates_to Relation', () => {
      const source = readSync('governance-structure', 'delegation-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('PolityAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-structure', 'polity-as-config-entity');
      const result = parseSyncFile(source);
      const propertySync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
