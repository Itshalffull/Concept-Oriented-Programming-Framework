// ============================================================
// Process Entity Conformance Tests
//
// Validates that process-oriented concepts (ProcessSpec,
// ProcessRun, StepRun, ConnectorCall, WorkItem, etc.) are
// registered as config or content entities with proper Relations.
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

describe('Process Entity Syncs', () => {
  const processSyncs = [
    'process-spec-as-config-entity',
    'process-run-as-content-entity',
    'step-run-as-content-entity',
    'connector-call-as-content-entity',
    'webhook-inbox-as-config-entity',
    'work-item-as-content-entity',
    'approval-as-content-entity',
    'escalation-as-content-entity',
    'llm-call-as-content-entity',
    'process-evaluation-run-as-content-entity',
    'tool-registry-as-config-entity',
    'checkpoint-as-content-entity',
    'milestone-as-config-entity',
    'compensation-plan-as-config-entity',
    'retry-policy-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of processSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('process', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('process entity structure', () => {
    it('ProcessRunAsContentEntity creates instance_of Relation', () => {
      const source = readSync('process', 'process-run-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('StepRunAsContentEntity creates part_of Relation', () => {
      const source = readSync('process', 'step-run-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
