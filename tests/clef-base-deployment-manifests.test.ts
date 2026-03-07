/**
 * Clef Base deployment manifest verification tests.
 * Verifies deployment manifests match spec §7, §11, §13.
 * Tests web, mobile, and desktop deployment targets.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

const DEPLOYMENTS_DIR = path.resolve('clef-base/deployments');

function readDeployManifest(name: string): any {
  return parseYaml(fs.readFileSync(path.join(DEPLOYMENTS_DIR, name), 'utf-8'));
}

describe('Clef Base deployment manifests (§7, §11, §13)', () => {

  describe('Web deployment (web.deploy.yaml)', () => {
    let deploy: any;
    beforeAll(() => { deploy = readDeployManifest('web.deploy.yaml'); });

    it('declares app name as clef-base', () => {
      expect(deploy.app.name).toBe('clef-base');
    });

    it('uses PostgreSQL for shared ContentNode pool per §13.2', () => {
      expect(deploy.infrastructure.storage.postgresql).toBeDefined();
      expect(deploy.infrastructure.storage.postgresql.type).toBe('postgresql');
      expect(deploy.infrastructure.storage.postgresql.config.shared_pool).toBe(true);
    });

    it('uses S3 for file data per §13.2', () => {
      expect(deploy.infrastructure.storage.s3).toBeDefined();
      expect(deploy.infrastructure.storage.s3.type).toBe('s3');
    });

    it('uses HTTP transport', () => {
      expect(deploy.infrastructure.transports.http).toBeDefined();
      expect(deploy.infrastructure.transports.http.type).toBe('http');
    });

    it('includes all 3 Clef Base concepts', () => {
      expect(deploy.concepts.ConceptBrowser).toBeDefined();
      expect(deploy.concepts.ComponentMapping).toBeDefined();
      expect(deploy.concepts.SlotSource).toBeDefined();
    });

    it('includes all 3 multiverse suite concepts', () => {
      expect(deploy.concepts.VersionSpace).toBeDefined();
      expect(deploy.concepts.VersionContext).toBeDefined();
      expect(deploy.concepts.SearchSpace).toBeDefined();
    });

    it('includes all 7 entity-lifecycle syncs', () => {
      const lifecycleSyncs = deploy.syncs.filter((s: any) =>
        s.path.includes('entity-lifecycle'));
      expect(lifecycleSyncs).toHaveLength(7);
    });

    it('includes all 5 version-space integration syncs', () => {
      const integrationSyncs = deploy.syncs.filter((s: any) =>
        s.path.includes('version-space-integration'));
      expect(integrationSyncs).toHaveLength(5);
    });

    it('references all schema.yaml files', () => {
      expect(deploy.schemas.length).toBeGreaterThanOrEqual(9);
      const schemaPaths = deploy.schemas.map((s: any) => s.path);
      expect(schemaPaths).toContain('clef-base/schemas/content.schema.yaml');
      expect(schemaPaths).toContain('clef-base/schemas/media.schema.yaml');
      expect(schemaPaths).toContain('clef-base/schemas/taxonomy.schema.yaml');
    });

    it('references composition.yaml files', () => {
      expect(deploy.compositions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Mobile deployment (mobile.deploy.yaml)', () => {
    let deploy: any;
    beforeAll(() => { deploy = readDeployManifest('mobile.deploy.yaml'); });

    it('declares app name starting with clef-base', () => {
      expect(deploy.app.name).toContain('clef-base');
    });

    it('uses SQLite for local storage per §13.2', () => {
      const storageEntries = Object.values(deploy.infrastructure?.storage || {}) as any[];
      const hasSqlite = storageEntries.some((s: any) => s.type === 'sqlite');
      expect(hasSqlite).toBe(true);
    });
  });

  describe('Desktop deployment (desktop.deploy.yaml)', () => {
    let deploy: any;
    beforeAll(() => { deploy = readDeployManifest('desktop.deploy.yaml'); });

    it('declares app name starting with clef-base', () => {
      expect(deploy.app.name).toContain('clef-base');
    });

    it('uses SQLite for local-first storage per §13.2', () => {
      const storageEntries = Object.values(deploy.infrastructure?.storage || {}) as any[];
      const hasSqlite = storageEntries.some((s: any) => s.type === 'sqlite');
      expect(hasSqlite).toBe(true);
    });
  });

  describe('All 3 deployment targets exist per §7', () => {
    it('web deployment exists', () => {
      expect(fs.existsSync(path.join(DEPLOYMENTS_DIR, 'web.deploy.yaml'))).toBe(true);
    });

    it('mobile deployment exists', () => {
      expect(fs.existsSync(path.join(DEPLOYMENTS_DIR, 'mobile.deploy.yaml'))).toBe(true);
    });

    it('desktop deployment exists', () => {
      expect(fs.existsSync(path.join(DEPLOYMENTS_DIR, 'desktop.deploy.yaml'))).toBe(true);
    });
  });
});
