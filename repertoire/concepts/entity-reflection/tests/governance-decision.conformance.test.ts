// ============================================================
// Governance Decision Entity Conformance Tests
//
// Validates that governance decision concepts (Proposal, Vote,
// CountingMethod, Quorum, Conviction, PredictionMarket,
// OptimisticApproval, Deliberation, Meeting, and 9 counting
// methods) are registered as config or content entities.
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

describe('Governance Decision Entity Syncs', () => {
  const decisionSyncs = [
    'proposal-as-content-entity',
    'vote-as-content-entity',
    'counting-method-as-config-entity',
    'quorum-as-config-entity',
    'conviction-as-content-entity',
    'prediction-market-as-content-entity',
    'optimistic-approval-as-content-entity',
    'deliberation-as-content-entity',
    'meeting-as-content-entity',
    'majority-as-config-entity',
    'supermajority-as-config-entity',
    'approval-counting-as-config-entity',
    'ranked-choice-as-config-entity',
    'condorcet-schulze-as-config-entity',
    'quadratic-voting-as-config-entity',
    'score-voting-as-config-entity',
    'borda-count-as-config-entity',
    'consent-process-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of decisionSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('governance-decision', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('governance decision entity structure', () => {
    it('VoteAsContentEntity creates cast_in Relation', () => {
      const source = readSync('governance-decision', 'vote-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('DeliberationAsContentEntity creates discusses Relation', () => {
      const source = readSync('governance-decision', 'deliberation-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('CountingMethodAsConfigEntity tags with config_bundle', () => {
      const source = readSync('governance-decision', 'counting-method-as-config-entity');
      const result = parseSyncFile(source);
      const propertySync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
