// ============================================================
// Score & Framework Extended Entity Conformance Tests
//
// Validates that extended Score concepts (AnatomyPartEntity,
// WidgetPropEntity, ErrorCorrelation, FileArtifact, etc.) and
// extended Framework concepts (KindSystem, Resource, FlakyTest)
// are registered as config or content entities with proper Tags.
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

describe('Score Extended Entity Syncs', () => {
  const scoreExtendedSyncs = [
    'anatomy-part-entity-to-config',
    'widget-prop-entity-to-config',
    'widget-state-entity-to-config',
    'error-correlation-as-content-entity',
    'file-artifact-to-config',
    'language-grammar-to-config',
    'structural-pattern-to-config',
    'analysis-rule-to-config',
    'score-index-to-config',
  ];

  describe('sync file parsing', () => {
    for (const name of scoreExtendedSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('score-extended', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('score extended entity structure', () => {
    it('ErrorCorrelationAsContentEntity uses Tag.addTag("system:error")', () => {
      const source = readSync('score-extended', 'error-correlation-as-content-entity');
      const syncs = parseSyncFile(source);
      const tagSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Tag' && a.action === 'addTag',
      ));
      expect(tagSync).toBeDefined();
    });
  });
});

describe('Framework Extended Entity Syncs', () => {
  const frameworkExtendedSyncs = [
    'kind-system-as-config-entity',
    'resource-as-config-entity',
    'flaky-test-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of frameworkExtendedSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('framework-extended', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });
});
