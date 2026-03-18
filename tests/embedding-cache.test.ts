// ============================================================
// EmbeddingCache Handler Tests — Functional Style
//
// Tests validate StorageProgram structure and transport effects
// rather than imperative execution results. The handler now uses
// perform("fs",...) for file I/O through the execution layer.
// ============================================================

import { describe, it, expect } from 'vitest';
import { embeddingCacheHandler } from '../handlers/ts/embedding-cache.handler.js';

function getPureValue(p: { instructions: Array<Record<string, unknown>> }) {
  const pure = p.instructions.find(i => i.tag === 'pure');
  return pure ? pure.value as Record<string, unknown> : {};
}

function getPutInstruction(p: { instructions: Array<Record<string, unknown>> }, relation: string) {
  return p.instructions.find(i => i.tag === 'put' && i.relation === relation);
}

function getPerformInstruction(p: { instructions: Array<Record<string, unknown>> }) {
  return p.instructions.find(i => i.tag === 'perform');
}

describe('EmbeddingCache', () => {
  describe('warm', () => {
    it('declares fs:read transport effect for manifest loading', () => {
      const p = embeddingCacheHandler.warm!({ path: '/cache/embeddings.json' });
      expect(p.effects.performs.has('fs:read')).toBe(true);
      const perf = getPerformInstruction(p);
      expect(perf).toBeDefined();
      expect((perf!.payload as Record<string, unknown>).path).toBe('/cache/embeddings.json');
    });
  });

  describe('lookup', () => {
    it('reads from storage by digest', () => {
      const p = embeddingCacheHandler.lookup!({ digest: 'abc123' });
      const getInstr = p.instructions.find(i => i.tag === 'get');
      expect(getInstr).toBeDefined();
      expect(getInstr!.key).toBe('abc123');
      expect(getInstr!.relation).toBe('embedding-cache');
    });
  });

  describe('put', () => {
    it('stores cache entry with all metadata', () => {
      const p = embeddingCacheHandler.put!({
        digest: 'abc123',
        vector: '[0.1,0.2,0.3]',
        model: 'openai-code',
        dimensions: 3,
        sourceKind: 'concept',
        sourceKey: 'User',
      });
      const putInstr = getPutInstruction(p, 'embedding-cache');
      expect(putInstr).toBeDefined();
      expect((putInstr!.value as Record<string, unknown>).model).toBe('openai-code');
      expect((putInstr!.value as Record<string, unknown>).dimensions).toBe(3);
      expect(getPureValue(p).variant).toBe('stored');
    });
  });

  describe('flush', () => {
    it('declares fs:write transport effect for manifest writing', () => {
      const p = embeddingCacheHandler.flush!({ path: '/cache/embeddings.json' });
      expect(p.effects.performs.has('fs:write')).toBe(true);
      const perf = getPerformInstruction(p);
      expect(perf).toBeDefined();
      expect((perf!.payload as Record<string, unknown>).path).toBe('/cache/embeddings.json');
    });
  });

  describe('evict', () => {
    it('deletes cache entry by digest', () => {
      const p = embeddingCacheHandler.evict!({ digest: 'abc123' });
      const delInstr = p.instructions.find(i => i.tag === 'del');
      expect(delInstr).toBeDefined();
      expect(delInstr!.key).toBe('abc123');
    });
  });

  describe('stats', () => {
    it('queries all entries', () => {
      const p = embeddingCacheHandler.stats!({});
      const findInstr = p.instructions.find(i => i.tag === 'find');
      expect(findInstr).toBeDefined();
      expect(findInstr!.relation).toBe('embedding-cache');
      expect(getPureValue(p).variant).toBe('ok');
    });
  });

  describe('lookupWithConfig', () => {
    it('uses composite key of digest+model+dimensions', () => {
      const p = embeddingCacheHandler.lookupWithConfig!({
        digest: 'abc123',
        model: 'openai-code',
        dimensions: 1536,
      });
      const getInstr = p.instructions.find(i => i.tag === 'get');
      expect(getInstr).toBeDefined();
      expect(getInstr!.key).toBe('abc123:openai-code:1536');
    });
  });

  describe('putWithConfig', () => {
    it('stores with composite key', () => {
      const p = embeddingCacheHandler.putWithConfig!({
        digest: 'abc123',
        model: 'codeBERT',
        dimensions: 768,
        vector: '[0.1,0.2]',
        sourceKind: 'concept',
        sourceKey: 'User',
      });
      const putInstr = getPutInstruction(p, 'embedding-cache');
      expect(putInstr).toBeDefined();
      expect(putInstr!.key).toBe('abc123:codeBERT:768');
      expect(getPureValue(p).variant).toBe('stored');
    });
  });
});
