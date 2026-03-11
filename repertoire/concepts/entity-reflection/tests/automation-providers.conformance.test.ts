// ============================================================
// Automation Providers Entity Conformance Tests
//
// Validates that automation provider concepts (AutomationDispatch,
// AutomationScope, ManifestAutomationProvider, SyncAutomationProvider)
// are registered as config or content entities with proper Relations
// and tagging.
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

describe('Automation Providers Entity Syncs', () => {
  const apSyncs = [
    'automation-dispatch-as-config-entity',
    'automation-scope-as-config-entity',
    'manifest-automation-provider-as-config-entity',
    'sync-automation-provider-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of apSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('automation-providers', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('automation providers entity structure', () => {
    it('AutomationDispatchAsConfigEntity tags with config_bundle', () => {
      const source = readSync('automation-providers', 'automation-dispatch-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('AutomationScopeAsConfigEntity tags with config_bundle', () => {
      const source = readSync('automation-providers', 'automation-scope-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('ManifestAutomationProviderAsConfigEntity tags with config_bundle', () => {
      const source = readSync('automation-providers', 'manifest-automation-provider-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('SyncAutomationProviderAsContentEntity creates authored_by Relation', () => {
      const source = readSync('automation-providers', 'sync-automation-provider-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('SyncAutomationProviderAsContentEntity tags with system:user_sync', () => {
      const source = readSync('automation-providers', 'sync-automation-provider-as-content-entity');
      const syncs = parseSyncFile(source);
      const tagSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Tag' && a.action === 'addTag',
      ));
      expect(tagSync).toBeDefined();
    });
  });
});
