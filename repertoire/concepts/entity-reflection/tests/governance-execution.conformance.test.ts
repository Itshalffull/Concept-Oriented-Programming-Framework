// ============================================================
// Governance Execution Entity Conformance Tests
//
// Validates that governance execution concepts (Execution,
// Timelock, Guard, FinalityGate, RageQuit, and 4 finality
// providers) are registered as config or content entities.
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

describe('Governance Execution Entity Syncs', () => {
  const executionSyncs = [
    'execution-as-content-entity',
    'timelock-as-content-entity',
    'guard-as-config-entity',
    'finality-gate-as-content-entity',
    'rage-quit-as-content-entity',
    'immediate-finality-as-config-entity',
    'chain-finality-as-config-entity',
    'bft-finality-as-config-entity',
    'optimistic-oracle-finality-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of executionSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-execution', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance execution entity structure', () => {
    it('ExecutionAsContentEntity creates executes Relation', () => {
      const source = readSync('governance-execution', 'execution-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('FinalityGateAsContentEntity creates finalizes Relation', () => {
      const source = readSync('governance-execution', 'finality-gate-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('GuardAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-execution', 'guard-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
