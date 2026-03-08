// ============================================================
// Config Entity Conformance Tests — Wave 4
//
// Validates that structural/system configs (Schema, Connector,
// LLMProvider, etc.) are registered as config entities with
// proper Relations.
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

describe('Wave 4: Config Entity Syncs', () => {
  const configSyncs = [
    'schema-as-config-entity',
    'connector-as-score-entity',
    'field-mapping-as-score-relation',
    'llm-provider-as-config-entity',
    'tool-binding-as-config-entity',
    'guardrail-as-config-entity',
    'deploy-plan-as-config-entity',
    'runtime-as-config-entity',
    'extension-manifest-as-config-entity',
    'chain-monitor-as-config-entity',
    'widget-registration-as-config-entity',
    'theme-as-config-entity',
    'target-output-as-config-entity',
    'api-surface-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of configSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('config-entities', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('config entity structure', () => {
    it('ConnectorAsScoreEntity creates Symbol identity', () => {
      const source = readSync('config-entities', 'connector-as-score-entity');
      const syncs = parseSyncFile(source);
      const symbolSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Symbol' && a.action === 'register',
      ));
      expect(symbolSync).toBeDefined();
    });

    it('FieldMappingAsScoreRelation creates maps_to Relation', () => {
      const source = readSync('config-entities', 'field-mapping-as-score-relation');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      const invokesRelation = mainSync.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      );
      expect(invokesRelation).toBe(true);
    });

    it('WidgetRegistrationAsConfigEntity creates renders_for Relation', () => {
      const source = readSync('config-entities', 'widget-registration-as-config-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('TargetOutputAsConfigEntity creates interface_for Relation', () => {
      const source = readSync('config-entities', 'target-output-as-config-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });

  describe('config entity tagging', () => {
    const taggedSyncs = [
      'schema-as-config-entity',
      'llm-provider-as-config-entity',
      'guardrail-as-config-entity',
      'deploy-plan-as-config-entity',
      'runtime-as-config-entity',
      'extension-manifest-as-config-entity',
      'theme-as-config-entity',
      'api-surface-as-config-entity',
    ];

    for (const name of taggedSyncs) {
      it(`${name} sets config_bundle via Property/set`, () => {
        const source = readSync('config-entities', name);
        const syncs = parseSyncFile(source);
        const propertySync = syncs.find(s => s.then.some(
          a => a.concept === 'urn:clef/Property' && a.action === 'set',
        ));
        expect(propertySync, `${name} should set config_bundle`).toBeDefined();
      });
    }
  });
});
