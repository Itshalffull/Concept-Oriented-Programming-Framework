/**
 * Version-space integration syncs verification tests.
 * Verifies all 5 integration syncs match the Clef Base spec §5.6, §5.9.
 * Tests sync file structure, trigger patterns, and effects.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

const SUITE_DIR = path.resolve('clef-base/suites/version-space-integration');
const SYNCS_DIR = path.join(SUITE_DIR, 'syncs');

function readSync(name: string): string {
  return fs.readFileSync(path.join(SYNCS_DIR, name), 'utf-8');
}

function readSuiteYaml(): any {
  return parseYaml(fs.readFileSync(path.join(SUITE_DIR, 'suite.yaml'), 'utf-8'));
}

describe('Version-space integration syncs suite (§5.6)', () => {

  describe('Suite manifest', () => {
    let suite: any;
    beforeAll(() => { suite = readSuiteYaml(); });

    it('has zero concepts (syncs-only suite)', () => {
      expect(suite.concepts).toEqual({});
    });

    it('declares name "version-space-integration"', () => {
      expect(suite.suite.name).toBe('version-space-integration');
    });

    it('has 2 required syncs and 3 recommended syncs', () => {
      expect(suite.syncs.required).toHaveLength(2);
      expect(suite.syncs.recommended).toHaveLength(3);
    });

    it('uses VersionSpace from multiverse suite', () => {
      const multiverseUse = suite.uses.find((u: any) => u.suite === 'multiverse');
      expect(multiverseUse).toBeDefined();
      expect(multiverseUse.concepts.some((c: any) => c.name === 'VersionSpace')).toBe(true);
    });

    it('uses VersionContext from multiverse suite', () => {
      const multiverseUse = suite.uses.find((u: any) => u.suite === 'multiverse');
      expect(multiverseUse.concepts.some((c: any) => c.name === 'VersionContext')).toBe(true);
    });

    it('uses SearchSpace from multiverse suite', () => {
      const multiverseUse = suite.uses.find((u: any) => u.suite === 'multiverse');
      expect(multiverseUse.concepts.some((c: any) => c.name === 'SearchSpace')).toBe(true);
    });

    it('uses ContentStorage from foundation suite', () => {
      const foundationUse = suite.uses.find((u: any) => u.suite === 'foundation');
      expect(foundationUse).toBeDefined();
      expect(foundationUse.concepts.some((c: any) => c.name === 'ContentStorage')).toBe(true);
    });
  });

  describe('VersionAwareLoad sync (required)', () => {
    let content: string;
    beforeAll(() => { content = readSync('version-aware-load.sync'); });

    it('is eager mode (must resolve before load returns)', () => {
      expect(content).toContain('VersionAwareLoad [eager]');
    });

    it('triggers on ContentStorage/load', () => {
      expect(content).toContain('ContentStorage/load');
    });

    it('delegates to VersionContext/resolve_for', () => {
      expect(content).toContain('VersionContext/resolve_for');
    });
  });

  describe('VersionAwareSave sync (required)', () => {
    let content: string;
    beforeAll(() => { content = readSync('version-aware-save.sync'); });

    it('is eager mode (must route before save completes)', () => {
      expect(content).toContain('VersionAwareSave [eager]');
    });

    it('triggers on ContentStorage/save', () => {
      expect(content).toContain('ContentStorage/save');
    });

    it('routes to VersionSpace/write', () => {
      expect(content).toContain('VersionSpace/write');
    });
  });

  describe('VersionSpaceWriteInvalidatesCache sync (recommended)', () => {
    let content: string;
    beforeAll(() => { content = readSync('version-space-write-invalidates-cache.sync'); });

    it('is eventual mode', () => {
      expect(content).toContain('[eventual]');
    });

    it('triggers on VersionSpace/write', () => {
      expect(content).toContain('VersionSpace/write');
    });

    it('invalidates cache with space-scoped tags', () => {
      expect(content).toContain('Cache/invalidateByTags');
    });
  });

  describe('VersionSpaceWriteIndexes sync (recommended)', () => {
    let content: string;
    beforeAll(() => { content = readSync('version-space-write-indexes.sync'); });

    it('is eventual mode', () => {
      expect(content).toContain('[eventual]');
    });

    it('triggers on VersionSpace/write', () => {
      expect(content).toContain('VersionSpace/write');
    });

    it('indexes in SearchSpace overlay', () => {
      expect(content).toContain('SearchSpace/index');
    });
  });

  describe('AutomationVersionDispatch sync (recommended, §5.9)', () => {
    let content: string;
    beforeAll(() => { content = readSync('automation-version-dispatch.sync'); });

    it('is eventual mode', () => {
      expect(content).toContain('[eventual]');
    });

    it('triggers on AutomationDispatch/dispatch', () => {
      expect(content).toContain('AutomationDispatch/dispatch');
    });

    it('routes to VersionSpace/execute_in_space', () => {
      expect(content).toContain('VersionSpace/execute_in_space');
    });
  });

  describe('Sync count verification', () => {
    it('has exactly 11 sync files', () => {
      const files = fs.readdirSync(SYNCS_DIR).filter(f => f.endsWith('.sync'));
      expect(files).toHaveLength(11);
    });
  });
});
