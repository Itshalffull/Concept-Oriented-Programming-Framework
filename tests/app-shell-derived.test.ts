/**
 * AppShell derived concept verification tests.
 * Verifies AppShell matches spec §14.2 and the implementation plan §16.3.
 * Tests composition, syncs, surface actions, and operational principles.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const APP_SHELL_PATH = path.resolve('clef-base/derived/app-shell.derived');

describe('AppShell derived concept (§14.2)', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(APP_SHELL_PATH, 'utf-8');
  });

  it('file exists', () => {
    expect(fs.existsSync(APP_SHELL_PATH)).toBe(true);
  });

  it('declares as a derived concept named AppShell', () => {
    expect(content).toContain('derived AppShell');
  });

  describe('Composition', () => {
    it('composes ConceptBrowser', () => {
      expect(content).toContain('ConceptBrowser');
    });

    it('composes ComponentMapping', () => {
      expect(content).toContain('ComponentMapping');
    });

    it('composes SlotSource', () => {
      expect(content).toContain('SlotSource');
    });
  });

  describe('Syncs', () => {
    it('requires all 7 entity-lifecycle syncs', () => {
      expect(content).toContain('save-invalidates-cache');
      expect(content).toContain('save-indexes-search');
      expect(content).toContain('save-generates-alias');
      expect(content).toContain('save-tracks-provenance');
      expect(content).toContain('save-reindexes-backlinks');
      expect(content).toContain('delete-cascades');
      expect(content).toContain('date-fields-reference-daily-notes');
    });

    it('recommends version-space integration syncs', () => {
      expect(content).toContain('version-aware-load');
      expect(content).toContain('version-aware-save');
      expect(content).toContain('automation-version-dispatch');
    });
  });

  describe('Surface actions per §14.2', () => {
    it('has createContent surface action', () => {
      expect(content).toContain('action createContent');
    });

    it('has installPackage surface action', () => {
      expect(content).toContain('action installPackage');
    });

    it('has removePackage surface action', () => {
      expect(content).toContain('action removePackage');
    });

    it('has browsePackages surface action', () => {
      expect(content).toContain('action browsePackages');
    });

    it('has configureMapping surface action', () => {
      expect(content).toContain('action configureMapping');
    });

    it('has renderEntity surface action', () => {
      expect(content).toContain('action renderEntity');
    });
  });

  describe('Surface queries', () => {
    it('has lookupMapping query', () => {
      expect(content).toContain('query lookupMapping');
    });

    it('has searchPackages query', () => {
      expect(content).toContain('query searchPackages');
    });
  });

  describe('Operational principle', () => {
    it('has a principle block', () => {
      expect(content).toContain('principle {');
    });

    it('principle covers install then browse flow', () => {
      expect(content).toContain('installPackage');
      expect(content).toContain('browsePackages');
    });

    it('principle covers configure mapping flow', () => {
      expect(content).toContain('configureMapping');
      expect(content).toContain('lookupMapping');
    });
  });
});
