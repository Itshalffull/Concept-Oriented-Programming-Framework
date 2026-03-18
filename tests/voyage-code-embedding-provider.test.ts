// ============================================================
// VoyageCodeEmbeddingProvider Handler Tests — Functional Style
//
// Embedding model provider using Voyage AI's voyage-code-3 model.
// Handler now returns StoragePrograms (functional style).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  voyageCodeEmbeddingProviderHandler,
  resetVoyageCodeEmbeddingProviderCounter,
} from '../handlers/ts/voyage-code-embedding-provider.handler.js';

describe('VoyageCodeEmbeddingProvider', () => {
  beforeEach(() => {
    resetVoyageCodeEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', () => {
      const program = voyageCodeEmbeddingProviderHandler.initialize!({});
      expect(program).toBeDefined();
      expect(program.instructions).toBeDefined();
      expect(Array.isArray(program.instructions)).toBe(true);
    });

    it('stores provider with correct model name and ref via put instruction', () => {
      const program = voyageCodeEmbeddingProviderHandler.initialize!({});
      const putInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'put',
      );
      expect(putInstr).toBeDefined();
      expect(putInstr!.relation).toBe('voyage-code-embedding-provider');
      expect((putInstr!.value as Record<string, unknown>).modelName).toBe('voyage-code');
      expect((putInstr!.value as Record<string, unknown>).providerRef).toBe('embedding:voyage-code');
    });

    it('returns a program with ok variant in pure instruction', () => {
      const program = voyageCodeEmbeddingProviderHandler.initialize!({});
      const pureInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'pure',
      );
      expect(pureInstr).toBeDefined();
      expect((pureInstr!.value as Record<string, unknown>).variant).toBe('ok');
    });

    it('generates unique instance IDs across calls', () => {
      const program1 = voyageCodeEmbeddingProviderHandler.initialize!({});
      const program2 = voyageCodeEmbeddingProviderHandler.initialize!({});
      const put1 = program1.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'put',
      );
      const put2 = program2.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'put',
      );
      expect(put1!.key).not.toBe(put2!.key);
    });
  });

  describe('embed', () => {
    it('declares an HTTP transport effect via perform', () => {
      const program = voyageCodeEmbeddingProviderHandler.embed!({
        text: 'function hello() {}',
        model: 'voyage-code-3',
        inputType: 'document',
      });
      expect(program.effects.performs.has('http:POST')).toBe(true);
    });

    it('includes perform instruction targeting voyage endpoint', () => {
      const program = voyageCodeEmbeddingProviderHandler.embed!({
        text: 'const x = 1;',
      });
      const performInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'perform',
      );
      expect(performInstr).toBeDefined();
      expect(performInstr!.protocol).toBe('http');
      expect(performInstr!.operation).toBe('POST');
    });
  });
});
