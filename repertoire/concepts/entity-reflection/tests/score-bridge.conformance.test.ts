// ============================================================
// Score Bridge Conformance Tests — Wave 1
//
// Validates that Score semantic entity registrations are properly
// bridged to ContentStorage as config entities, and that suite
// membership Relations are created.
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

describe('Wave 1: Score → ContentStorage Bridge', () => {
  const bridgeSyncs = [
    'concept-entity-to-config',
    'action-entity-to-config',
    'sync-entity-to-config',
    'state-field-to-config',
    'variant-entity-to-config',
    'widget-entity-to-config',
    'theme-entity-to-config',
  ];

  describe('sync file parsing', () => {
    for (const name of bridgeSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('score-bridge', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('bridge sync structure', () => {
    it('ConceptEntityToConfigEntity triggers on ConceptEntity/register', () => {
      const source = readSync('score-bridge', 'concept-entity-to-config');
      const syncs = parseSyncFile(source);
      const mainSync = syncs.find(s => s.name === 'ConceptEntityToConfigEntity');
      expect(mainSync).toBeDefined();
      expect(mainSync!.when[0].concept).toBe('urn:clef/ConceptEntity');
      expect(mainSync!.when[0].action).toBe('register');
    });

    it('all bridge syncs invoke ContentStorage/save', () => {
      for (const name of bridgeSyncs) {
        const source = readSync('score-bridge', name);
        const syncs = parseSyncFile(source);
        const mainSync = syncs[0];
        const invokesStorage = mainSync.then.some(
          a => a.concept === 'urn:clef/ContentStorage' && a.action === 'save',
        );
        expect(invokesStorage, `${name} should invoke ContentStorage/save`).toBe(true);
      }
    });

    it('all bridge syncs tag with config_bundle via Property/set', () => {
      for (const name of bridgeSyncs) {
        const source = readSync('score-bridge', name);
        const syncs = parseSyncFile(source);
        const tagSync = syncs.find(s => s.then.some(
          a => a.concept === 'urn:clef/Property' && a.action === 'set',
        ));
        expect(tagSync, `${name} should have a Property/set sync for config_bundle`).toBeDefined();
      }
    });
  });
});

describe('Wave 1: Relation Bridge', () => {
  describe('sync file parsing', () => {
    it('parses symbol-relationship-to-relation.sync', () => {
      const source = readSync('relation-bridge', 'symbol-relationship-to-relation');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThanOrEqual(1);
    });

    it('parses concept-belongs-to-suite.sync', () => {
      const source = readSync('relation-bridge', 'concept-belongs-to-suite');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('relation bridge structure', () => {
    it('SymbolRelationshipToRelation triggers on SymbolRelationship/add', () => {
      const source = readSync('relation-bridge', 'symbol-relationship-to-relation');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      expect(mainSync.when[0].concept).toBe('urn:clef/SymbolRelationship');
      expect(mainSync.when[0].action).toBe('add');
    });

    it('ConceptBelongsToSuite triggers on ConceptEntity/register and creates Relation', () => {
      const source = readSync('relation-bridge', 'concept-belongs-to-suite');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      expect(mainSync.when[0].concept).toBe('urn:clef/ConceptEntity');
      const invokesRelation = mainSync.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      );
      expect(invokesRelation).toBe(true);
    });
  });
});
