// ============================================================
// SymbolRelationship Handler Tests
//
// Tests for typed semantic relationships between Symbols:
// add, findFrom, findTo, transitiveClosure, and get.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  symbolRelationshipHandler,
  resetSymbolRelationshipCounter,
} from '../implementations/typescript/symbol-relationship.impl.js';

describe('SymbolRelationship', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSymbolRelationshipCounter();
  });

  // ── add ───────────────────────────────────────────────────

  describe('add', () => {
    it('creates a relationship and returns ok with an id', async () => {
      const result = await symbolRelationshipHandler.add({
        source: 'sym-A',
        target: 'sym-B',
        kind: 'implements',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.relationship).toBe('symbol-relationship-1');
    });

    it('rejects duplicate source+target+kind', async () => {
      await symbolRelationshipHandler.add({
        source: 'sym-A', target: 'sym-B', kind: 'implements',
      }, storage);

      const result = await symbolRelationshipHandler.add({
        source: 'sym-A', target: 'sym-B', kind: 'implements',
      }, storage);

      expect(result.variant).toBe('alreadyExists');
      expect(result.existing).toBe('symbol-relationship-1');
    });

    it('allows same source+target with different kind', async () => {
      const r1 = await symbolRelationshipHandler.add({
        source: 'sym-A', target: 'sym-B', kind: 'implements',
      }, storage);
      const r2 = await symbolRelationshipHandler.add({
        source: 'sym-A', target: 'sym-B', kind: 'extends',
      }, storage);

      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
      expect(r2.relationship).toBe('symbol-relationship-2');
    });
  });

  // ── findFrom ──────────────────────────────────────────────

  describe('findFrom', () => {
    beforeEach(async () => {
      await symbolRelationshipHandler.add({ source: 'A', target: 'B', kind: 'implements' }, storage);
      await symbolRelationshipHandler.add({ source: 'A', target: 'C', kind: 'extends' }, storage);
      await symbolRelationshipHandler.add({ source: 'B', target: 'D', kind: 'implements' }, storage);
    });

    it('finds all relationships from a source', async () => {
      const result = await symbolRelationshipHandler.findFrom({
        source: 'A', kind: '',
      }, storage);

      expect(result.variant).toBe('ok');
      const rels = JSON.parse(result.relationships as string);
      expect(rels).toHaveLength(2);
    });

    it('filters by kind', async () => {
      const result = await symbolRelationshipHandler.findFrom({
        source: 'A', kind: 'implements',
      }, storage);

      expect(result.variant).toBe('ok');
      const rels = JSON.parse(result.relationships as string);
      expect(rels).toHaveLength(1);
      expect(rels[0].target).toBe('B');
    });
  });

  // ── findTo ────────────────────────────────────────────────

  describe('findTo', () => {
    beforeEach(async () => {
      await symbolRelationshipHandler.add({ source: 'A', target: 'C', kind: 'extends' }, storage);
      await symbolRelationshipHandler.add({ source: 'B', target: 'C', kind: 'extends' }, storage);
      await symbolRelationshipHandler.add({ source: 'D', target: 'C', kind: 'implements' }, storage);
    });

    it('finds all relationships targeting a symbol', async () => {
      const result = await symbolRelationshipHandler.findTo({
        target: 'C', kind: '',
      }, storage);

      expect(result.variant).toBe('ok');
      const rels = JSON.parse(result.relationships as string);
      expect(rels).toHaveLength(3);
    });

    it('filters by kind', async () => {
      const result = await symbolRelationshipHandler.findTo({
        target: 'C', kind: 'extends',
      }, storage);

      expect(result.variant).toBe('ok');
      const rels = JSON.parse(result.relationships as string);
      expect(rels).toHaveLength(2);
    });
  });

  // ── transitiveClosure ─────────────────────────────────────

  describe('transitiveClosure', () => {
    beforeEach(async () => {
      // A -> B -> C -> D (chain via 'extends')
      await symbolRelationshipHandler.add({ source: 'A', target: 'B', kind: 'extends' }, storage);
      await symbolRelationshipHandler.add({ source: 'B', target: 'C', kind: 'extends' }, storage);
      await symbolRelationshipHandler.add({ source: 'C', target: 'D', kind: 'extends' }, storage);
      // A -> E via 'implements' (different kind)
      await symbolRelationshipHandler.add({ source: 'A', target: 'E', kind: 'implements' }, storage);
    });

    it('follows forward transitive closure for a kind', async () => {
      const result = await symbolRelationshipHandler.transitiveClosure({
        start: 'A', kind: 'extends', direction: 'forward',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toContain('B');
      expect(symbols).toContain('C');
      expect(symbols).toContain('D');
      expect(symbols).not.toContain('E');
      expect(symbols).not.toContain('A');
    });

    it('follows backward transitive closure', async () => {
      const result = await symbolRelationshipHandler.transitiveClosure({
        start: 'D', kind: 'extends', direction: 'backward',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toContain('C');
      expect(symbols).toContain('B');
      expect(symbols).toContain('A');
    });

    it('returns paths for transitive closure', async () => {
      const result = await symbolRelationshipHandler.transitiveClosure({
        start: 'A', kind: 'extends', direction: 'forward',
      }, storage);

      const paths = JSON.parse(result.paths as string);
      expect(paths.length).toBeGreaterThan(0);
      // The first path should start from A
      expect(paths[0][0]).toBe('A');
    });

    it('handles transitive closure with no edges', async () => {
      const result = await symbolRelationshipHandler.transitiveClosure({
        start: 'Z', kind: 'extends', direction: 'forward',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });

    it('follows all kinds when kind is empty', async () => {
      const result = await symbolRelationshipHandler.transitiveClosure({
        start: 'A', kind: '', direction: 'forward',
      }, storage);

      expect(result.variant).toBe('ok');
      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toContain('B');
      expect(symbols).toContain('E');
    });
  });

  // ── get ───────────────────────────────────────────────────

  describe('get', () => {
    it('retrieves full relationship details', async () => {
      await symbolRelationshipHandler.add({
        source: 'sym-A', target: 'sym-B', kind: 'tests',
      }, storage);

      const result = await symbolRelationshipHandler.get({
        relationship: 'symbol-relationship-1',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.source).toBe('sym-A');
      expect(result.target).toBe('sym-B');
      expect(result.kind).toBe('tests');
      expect(result.metadata).toBe('');
    });

    it('returns notfound for missing relationship', async () => {
      const result = await symbolRelationshipHandler.get({
        relationship: 'nonexistent',
      }, storage);

      expect(result.variant).toBe('notfound');
    });
  });
});
