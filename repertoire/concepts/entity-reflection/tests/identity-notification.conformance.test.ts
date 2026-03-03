// ============================================================
// Identity & Notification Entity Conformance Tests
//
// Validates that identity concepts (Authentication, Authorization,
// Session) and notification concepts (NotificationChannel,
// Notification) are registered as entities with proper Relations.
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

describe('Identity & Notification Entity Syncs', () => {
  const identitySyncs = [
    { subdir: 'identity', name: 'authentication-as-config-entity' },
    { subdir: 'identity', name: 'authorization-as-config-entity' },
    { subdir: 'identity', name: 'session-as-content-entity' },
    { subdir: 'notification', name: 'notification-channel-as-config-entity' },
    { subdir: 'notification', name: 'notification-as-content-entity' },
  ];

  describe('sync file parsing', () => {
    for (const { subdir, name } of identitySyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync(subdir, name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('identity & notification entity structure', () => {
    it('SessionAsContentEntity creates session_for Relation', () => {
      const source = readSync('identity', 'session-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('NotificationAsContentEntity creates sent_via Relation', () => {
      const source = readSync('notification', 'notification-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
