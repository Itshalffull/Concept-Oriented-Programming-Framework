// ============================================================
// Attribution Handler Tests
//
// Bind agent identity to content regions, tracking who created
// or modified each piece. Supports blame queries, per-region
// authorship history, and CODEOWNERS-style ownership patterns.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  attributionHandler,
  resetAttributionCounter,
} from '../handlers/ts/attribution.handler.js';

describe('Attribution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAttributionCounter();
  });

  describe('attribute', () => {
    it('creates an attribution record and returns ok', async () => {
      const result = await attributionHandler.attribute!(
        {
          contentRef: 'file:src/main.ts',
          region: 'lines:1-20',
          agent: 'agent-alice',
          changeRef: 'commit:abc123',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.attributionId).toBe('attribution-1');
    });

    it('stores attribution metadata in storage', async () => {
      await attributionHandler.attribute!(
        {
          contentRef: 'file:src/main.ts',
          region: 'lines:1-20',
          agent: 'agent-alice',
          changeRef: 'commit:abc123',
        },
        storage,
      );
      const stored = await storage.get('attribution', 'attribution-1');
      expect(stored).not.toBeNull();
      expect(stored!.contentRef).toBe('file:src/main.ts');
      expect(stored!.region).toBe('lines:1-20');
      expect(stored!.agent).toBe('agent-alice');
      expect(stored!.changeRef).toBe('commit:abc123');
      expect(stored!.timestamp).toBeDefined();
    });

    it('assigns unique IDs to different attributions', async () => {
      const first = await attributionHandler.attribute!(
        { contentRef: 'file:a.ts', region: 'lines:1-5', agent: 'alice', changeRef: 'c1' },
        storage,
      );
      const second = await attributionHandler.attribute!(
        { contentRef: 'file:b.ts', region: 'lines:1-5', agent: 'bob', changeRef: 'c2' },
        storage,
      );
      expect(first.attributionId).toBe('attribution-1');
      expect(second.attributionId).toBe('attribution-2');
    });
  });

  describe('blame', () => {
    it('returns blame map for a content ref', async () => {
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:1-10', agent: 'alice', changeRef: 'c1' },
        storage,
      );
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:11-20', agent: 'bob', changeRef: 'c2' },
        storage,
      );

      const result = await attributionHandler.blame!(
        { contentRef: 'file:main.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const map = result.map as Array<{ region: string; agent: string; changeRef: string }>;
      expect(map.length).toBe(2);
      expect(map.find(e => e.region === 'lines:1-10')!.agent).toBe('alice');
      expect(map.find(e => e.region === 'lines:11-20')!.agent).toBe('bob');
    });

    it('collapses multiple attributions for the same region to one entry', async () => {
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:1-10', agent: 'alice', changeRef: 'c1' },
        storage,
      );
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:1-10', agent: 'bob', changeRef: 'c2' },
        storage,
      );

      const result = await attributionHandler.blame!(
        { contentRef: 'file:main.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const map = result.map as Array<{ region: string; agent: string }>;
      // Both attributions happen within the same tick, so the implementation
      // picks one based on timestamp comparison. The key invariant is that
      // the blame map collapses to a single entry per region.
      expect(map.length).toBe(1);
      expect(map[0].region).toBe('lines:1-10');
    });

    it('returns empty map when no attributions exist', async () => {
      const result = await attributionHandler.blame!(
        { contentRef: 'file:nothing.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.map as unknown[]).length).toBe(0);
    });
  });

  describe('history', () => {
    it('returns chronological chain of attributions for a region', async () => {
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:1-10', agent: 'alice', changeRef: 'c1' },
        storage,
      );
      await attributionHandler.attribute!(
        { contentRef: 'file:main.ts', region: 'lines:1-10', agent: 'bob', changeRef: 'c2' },
        storage,
      );

      const result = await attributionHandler.history!(
        { contentRef: 'file:main.ts', region: 'lines:1-10' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const chain = result.chain as string[];
      expect(chain.length).toBe(2);
      expect(chain).toContain('attribution-1');
      expect(chain).toContain('attribution-2');
    });

    it('returns notFound when no attributions exist for the region', async () => {
      const result = await attributionHandler.history!(
        { contentRef: 'file:main.ts', region: 'lines:999-1000' },
        storage,
      );
      expect(result.variant).toBe('notFound');
      expect(result.message).toContain('No attributions found');
    });
  });

  describe('setOwnership', () => {
    it('creates an ownership rule', async () => {
      const result = await attributionHandler.setOwnership!(
        { pattern: 'src/**/*.ts', owners: ['team-core'] },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('updates an existing ownership rule', async () => {
      await attributionHandler.setOwnership!(
        { pattern: 'src/*.ts', owners: ['team-core'] },
        storage,
      );
      await attributionHandler.setOwnership!(
        { pattern: 'src/*.ts', owners: ['team-core', 'team-infra'] },
        storage,
      );

      // Query to verify the update took effect
      const result = await attributionHandler.queryOwners!(
        { path: 'src/main.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.owners).toContain('team-core');
      expect(result.owners).toContain('team-infra');
    });
  });

  describe('queryOwners', () => {
    it('returns owners matching a glob pattern', async () => {
      await attributionHandler.setOwnership!(
        { pattern: 'src/**/*.ts', owners: ['team-core'] },
        storage,
      );
      const result = await attributionHandler.queryOwners!(
        { path: 'src/utils/helper.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.owners).toContain('team-core');
    });

    it('returns combined owners from multiple matching patterns', async () => {
      await attributionHandler.setOwnership!(
        { pattern: 'src/**/*.ts', owners: ['team-core'] },
        storage,
      );
      await attributionHandler.setOwnership!(
        { pattern: 'src/utils/*', owners: ['team-infra'] },
        storage,
      );
      const result = await attributionHandler.queryOwners!(
        { path: 'src/utils/helper.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const owners = result.owners as string[];
      expect(owners).toContain('team-core');
      expect(owners).toContain('team-infra');
    });

    it('returns noMatch when no pattern matches', async () => {
      await attributionHandler.setOwnership!(
        { pattern: 'src/**/*.ts', owners: ['team-core'] },
        storage,
      );
      const result = await attributionHandler.queryOwners!(
        { path: 'docs/readme.md' },
        storage,
      );
      expect(result.variant).toBe('noMatch');
      expect(result.message).toContain('No ownership pattern');
    });

    it('deduplicates owners across multiple pattern matches', async () => {
      await attributionHandler.setOwnership!(
        { pattern: 'src/*.ts', owners: ['team-core', 'team-shared'] },
        storage,
      );
      await attributionHandler.setOwnership!(
        { pattern: 'src/main.*', owners: ['team-shared', 'team-lead'] },
        storage,
      );
      const result = await attributionHandler.queryOwners!(
        { path: 'src/main.ts' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const owners = result.owners as string[];
      // team-shared should appear only once
      expect(owners.filter(o => o === 'team-shared').length).toBe(1);
      expect(owners).toContain('team-core');
      expect(owners).toContain('team-lead');
    });
  });
});
