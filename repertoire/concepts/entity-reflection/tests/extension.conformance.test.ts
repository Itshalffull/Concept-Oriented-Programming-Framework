// ============================================================
// Extension Entity Conformance Tests
//
// Validates that extension-system concepts (ContributionPoint,
// ExtensionConfig, ExtensionHost, ExtensionMessaging, etc.)
// are registered as config entities with proper Relations.
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

describe('Extension Entity Syncs', () => {
  const extensionSyncs = [
    'contribution-point-as-config-entity',
    'extension-config-as-config-entity',
    'extension-host-as-config-entity',
    'extension-messaging-as-config-entity',
    'extension-permission-as-config-entity',
    'extension-storage-as-config-entity',
    'background-worker-as-config-entity',
    'browser-action-as-config-entity',
    'content-script-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of extensionSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('extension', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('extension entity structure', () => {
    it('ExtensionConfigAsConfigEntity creates configures Relation', () => {
      const source = readSync('extension', 'extension-config-as-config-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
