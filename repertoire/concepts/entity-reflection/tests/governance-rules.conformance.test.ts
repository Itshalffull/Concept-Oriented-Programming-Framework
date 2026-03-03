// ============================================================
// Governance Rules Entity Conformance Tests
//
// Validates that governance rules concepts (Policy, Monitor,
// Sanction, Dispute, and 4 policy evaluators) are registered
// as config or content entities with proper Relations.
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

describe('Governance Rules Entity Syncs', () => {
  const rulesSyncs = [
    'policy-as-config-entity',
    'monitor-as-content-entity',
    'sanction-as-content-entity',
    'dispute-as-content-entity',
    'adico-evaluator-as-config-entity',
    'rego-evaluator-as-config-entity',
    'cedar-evaluator-as-config-entity',
    'custom-evaluator-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of rulesSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-rules', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance rules entity structure', () => {
    it('MonitorAsContentEntity creates enforces Relation', () => {
      const source = readSync('governance-rules', 'monitor-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('DisputeAsContentEntity creates disputes Relation', () => {
      const source = readSync('governance-rules', 'dispute-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('PolicyAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-rules', 'policy-as-config-entity');
      const result = parseSyncFile(source);
      const propertySync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
