// ============================================================
// Formal Verification Entity Conformance Tests
//
// Validates that formal verification concepts (FormalProperty,
// Contract, Evidence, SolverProvider, SpecificationSchema,
// VerificationRun) are registered as config or content entities
// with proper Relations and tagging.
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

describe('Formal Verification Entity Syncs', () => {
  const fvSyncs = [
    'formal-property-as-content-entity',
    'contract-as-config-entity',
    'evidence-as-content-entity',
    'solver-provider-as-config-entity',
    'specification-schema-as-config-entity',
    'verification-run-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of fvSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('formal-verification', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('formal verification entity structure', () => {
    it('FormalPropertyAsContentEntity creates targets Relation', () => {
      const source = readSync('formal-verification', 'formal-property-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('EvidenceAsContentEntity creates proves Relation', () => {
      const source = readSync('formal-verification', 'evidence-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('ContractAsConfigEntity tags with config_bundle', () => {
      const source = readSync('formal-verification', 'contract-as-config-entity');
      const syncs = parseSyncFile(source);
      const propertySync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('VerificationRunAsContentEntity creates verifies Relation', () => {
      const source = readSync('formal-verification', 'verification-run-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
