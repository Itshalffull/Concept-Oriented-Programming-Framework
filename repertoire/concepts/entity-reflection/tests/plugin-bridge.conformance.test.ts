// ============================================================
// Plugin Bridge Conformance Tests — Wave 2
//
// Validates that PluginRegistry registrations are bridged to
// Score (Symbol), ContentStorage (config entity), and Relations
// (provides_for, generates).
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

describe('Wave 2: Plugin Bridge', () => {
  const pluginSyncs = [
    'plugin-registration-to-score',
    'plugin-provides-for-concept',
    'plugin-tracks-artifact',
  ];

  describe('sync file parsing', () => {
    for (const name of pluginSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('plugin-bridge', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('plugin bridge structure', () => {
    it('PluginRegistrationToScore triggers on PluginRegistry/register', () => {
      const source = readSync('plugin-bridge', 'plugin-registration-to-score');
      const syncs = parseSyncFile(source);
      const symbolSync = syncs.find(s => s.name === 'PluginRegistrationToSymbol');
      expect(symbolSync).toBeDefined();
      expect(symbolSync!.when[0].concept).toBe('urn:clef/PluginRegistry');
      expect(symbolSync!.when[0].action).toBe('register');
    });

    it('PluginRegistrationToScore creates Symbol identity', () => {
      const source = readSync('plugin-bridge', 'plugin-registration-to-score');
      const syncs = parseSyncFile(source);
      const symbolSync = syncs.find(s => s.name === 'PluginRegistrationToSymbol');
      const invokesSymbol = symbolSync!.then.some(
        a => a.concept === 'urn:clef/Symbol' && a.action === 'register',
      );
      expect(invokesSymbol).toBe(true);
    });

    it('PluginProvidesForConcept creates provides_for Relation', () => {
      const source = readSync('plugin-bridge', 'plugin-provides-for-concept');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      const invokesRelation = mainSync.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      );
      expect(invokesRelation).toBe(true);
    });

    it('PluginTracksArtifact triggers on Emitter/write', () => {
      const source = readSync('plugin-bridge', 'plugin-tracks-artifact');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      expect(mainSync.when[0].concept).toBe('urn:clef/Emitter');
      expect(mainSync.when[0].action).toBe('write');
    });
  });
});

describe('Wave 2: Relation Bridge Additions', () => {
  describe('sync file parsing', () => {
    it('parses sync-concept-relations.sync', () => {
      const source = readSync('relation-bridge', 'sync-concept-relations');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThanOrEqual(2);
    });

    it('parses derived-concept-composes-source.sync', () => {
      const source = readSync('relation-bridge', 'derived-concept-composes-source');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
