// ============================================================
// Governance Resources Entity Conformance Tests
//
// Validates that governance resource concepts (Treasury,
// Reputation, Metric, Objective, BondingCurve, and 5 reputation
// algorithms) are registered as config or content entities.
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

describe('Governance Resources Entity Syncs', () => {
  const resourcesSyncs = [
    'treasury-as-content-entity',
    'reputation-as-content-entity',
    'metric-as-config-entity',
    'objective-as-content-entity',
    'bonding-curve-as-config-entity',
    'simple-accumulator-as-config-entity',
    'pagerank-reputation-as-config-entity',
    'elo-rating-as-config-entity',
    'glicko-rating-as-config-entity',
    'peer-allocation-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of resourcesSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-resources', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance resources entity structure', () => {
    it('MetricAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-resources', 'metric-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('BondingCurveAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-resources', 'bonding-curve-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
