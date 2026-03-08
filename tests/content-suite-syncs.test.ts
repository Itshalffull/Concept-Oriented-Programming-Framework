// Content suite sync specification tests — verify sync files exist, have correct
// structure, and are referenced in the suite manifest. Tests cover the spatial
// decomposition syncs (canvas-connector-surface, connector-promote-creates-reference,
// frame-containment-check) and layout provider registration syncs.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

const CONTENT_SUITE_DIR = resolve(__dirname, '../repertoire/concepts/content');
const SYNCS_DIR = resolve(CONTENT_SUITE_DIR, 'syncs');

function readSync(name: string): string {
  const path = resolve(SYNCS_DIR, name);
  return readFileSync(path, 'utf-8');
}

function readSuiteYaml(): Record<string, unknown> {
  const path = resolve(CONTENT_SUITE_DIR, 'suite.yaml');
  return parseYaml(readFileSync(path, 'utf-8'));
}

describe('Content Suite Syncs', () => {
  describe('Suite manifest', () => {
    it('includes all spatial decomposition syncs', () => {
      const suite = readSuiteYaml();
      const syncs = suite.syncs as Array<{ name: string; file: string; tier: string }>;
      const syncNames = syncs.map(s => s.name);

      expect(syncNames).toContain('canvas-connector-surface');
      expect(syncNames).toContain('connector-promote-creates-reference');
      expect(syncNames).toContain('frame-containment-check');
      expect(syncNames).toContain('spatial-layout-dispatch');
    });

    it('includes all layout provider registration syncs', () => {
      const suite = readSuiteYaml();
      const syncs = suite.syncs as Array<{ name: string; file: string; tier: string }>;
      const syncNames = syncs.map(s => s.name);

      expect(syncNames).toContain('force-directed-layout-registration');
      expect(syncNames).toContain('hierarchical-layout-registration');
      expect(syncNames).toContain('grid-layout-registration');
      expect(syncNames).toContain('circular-layout-registration');
    });

    it('marks layout registration syncs as integration tier', () => {
      const suite = readSuiteYaml();
      const syncs = suite.syncs as Array<{ name: string; tier: string }>;
      const registrationSyncs = syncs.filter(s => s.name.endsWith('-registration'));
      for (const sync of registrationSyncs) {
        expect(sync.tier).toBe('integration');
      }
    });

    it('includes spatial concepts in concept list', () => {
      const suite = readSuiteYaml();
      const concepts = suite.concepts as Array<{ name: string }>;
      const conceptNames = concepts.map(c => c.name);

      expect(conceptNames).toContain('SpatialConnector');
      expect(conceptNames).toContain('Frame');
      expect(conceptNames).toContain('Shape');
      expect(conceptNames).toContain('SpatialLayout');
    });

    it('marks layout providers as optional', () => {
      const suite = readSuiteYaml();
      const concepts = suite.concepts as Array<{ name: string; optional?: boolean }>;
      const providers = concepts.filter(c =>
        ['ForceDirectedLayout', 'HierarchicalLayout', 'GridLayout', 'CircularLayout'].includes(c.name)
      );
      for (const provider of providers) {
        expect(provider.optional).toBe(true);
      }
    });

    it('declares linking and infrastructure dependencies', () => {
      const suite = readSuiteYaml();
      const deps = suite.dependencies as Array<{ name: string; concepts: string[] }>;
      const depNames = deps.map(d => d.name);
      expect(depNames).toContain('linking');
      expect(depNames).toContain('infrastructure');
    });
  });

  describe('canvas-connector-surface.sync', () => {
    it('exists', () => {
      expect(existsSync(resolve(SYNCS_DIR, 'canvas-connector-surface.sync'))).toBe(true);
    });

    it('triggers on Canvas/addNode', () => {
      const content = readSync('canvas-connector-surface.sync');
      expect(content).toContain('Canvas/addNode');
    });

    it('calls SpatialConnector/surface', () => {
      const content = readSync('canvas-connector-surface.sync');
      expect(content).toContain('SpatialConnector/surface');
    });

    it('is eventual delivery', () => {
      const content = readSync('canvas-connector-surface.sync');
      expect(content).toContain('[eventual]');
    });
  });

  describe('connector-promote-creates-reference.sync', () => {
    it('exists', () => {
      expect(existsSync(resolve(SYNCS_DIR, 'connector-promote-creates-reference.sync'))).toBe(true);
    });

    it('triggers on SpatialConnector/promote', () => {
      const content = readSync('connector-promote-creates-reference.sync');
      expect(content).toContain('SpatialConnector/promote');
    });

    it('calls Reference/addRef', () => {
      const content = readSync('connector-promote-creates-reference.sync');
      expect(content).toContain('Reference/addRef');
    });

    it('is eager delivery', () => {
      const content = readSync('connector-promote-creates-reference.sync');
      expect(content).toContain('[eager]');
    });

    it('queries connector source and target in where clause', () => {
      const content = readSync('connector-promote-creates-reference.sync');
      expect(content).toContain('connector_source');
      expect(content).toContain('connector_target');
    });
  });

  describe('frame-containment-check.sync', () => {
    it('exists', () => {
      expect(existsSync(resolve(SYNCS_DIR, 'frame-containment-check.sync'))).toBe(true);
    });

    it('triggers on Canvas/addNode', () => {
      const content = readSync('frame-containment-check.sync');
      expect(content).toContain('Canvas/addNode');
    });

    it('calls Frame/addItem', () => {
      const content = readSync('frame-containment-check.sync');
      expect(content).toContain('Frame/addItem');
    });

    it('queries frame canvas in where clause', () => {
      const content = readSync('frame-containment-check.sync');
      expect(content).toContain('frame_canvas');
    });
  });

  describe('layout provider registration syncs', () => {
    const providers = [
      { name: 'force-directed-layout-registration', concept: 'ForceDirectedLayout' },
      { name: 'hierarchical-layout-registration', concept: 'HierarchicalLayout' },
      { name: 'grid-layout-registration', concept: 'GridLayout' },
      { name: 'circular-layout-registration', concept: 'CircularLayout' },
    ];

    for (const { name, concept } of providers) {
      describe(`${name}.sync`, () => {
        it('exists', () => {
          expect(existsSync(resolve(SYNCS_DIR, `${name}.sync`))).toBe(true);
        });

        it(`triggers on ${concept}/register`, () => {
          const content = readSync(`${name}.sync`);
          expect(content).toContain(`${concept}/register`);
        });

        it('calls PluginRegistry/register', () => {
          const content = readSync(`${name}.sync`);
          expect(content).toContain('PluginRegistry/register');
        });

        it('registers as layout-provider type', () => {
          const content = readSync(`${name}.sync`);
          expect(content).toContain('layout-provider');
        });

        it('is eager delivery', () => {
          const content = readSync(`${name}.sync`);
          expect(content).toContain('[eager]');
        });
      });
    }
  });

  describe('spatial-layout-dispatch.sync', () => {
    it('exists', () => {
      expect(existsSync(resolve(SYNCS_DIR, 'spatial-layout-dispatch.sync'))).toBe(true);
    });

    it('triggers on SpatialLayout/apply', () => {
      const content = readSync('spatial-layout-dispatch.sync');
      expect(content).toContain('SpatialLayout/apply');
    });

    it('queries PluginRegistry for layout-provider', () => {
      const content = readSync('spatial-layout-dispatch.sync');
      expect(content).toContain('PluginRegistry');
      expect(content).toContain('layout-provider');
    });
  });
});
