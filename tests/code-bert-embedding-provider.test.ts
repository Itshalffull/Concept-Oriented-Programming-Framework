// ============================================================
// CodeBERTEmbeddingProvider Handler Tests — Functional Style
//
// Embedding model provider using CodeBERT for local code embeddings.
// Handler now returns StoragePrograms (functional style).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  codeBERTEmbeddingProviderHandler,
  resetCodeBERTEmbeddingProviderCounter,
} from '../handlers/ts/code-bert-embedding-provider.handler.js';

describe('CodeBERTEmbeddingProvider', () => {
  beforeEach(() => {
    resetCodeBERTEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', () => {
      const program = codeBERTEmbeddingProviderHandler.initialize!({});
      expect(program).toBeDefined();
      expect(program.instructions).toBeDefined();
      expect(Array.isArray(program.instructions)).toBe(true);
    });

    it('stores provider with correct model name and ref via put instruction', () => {
      const program = codeBERTEmbeddingProviderHandler.initialize!({});
      const putInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'put',
      );
      expect(putInstr).toBeDefined();
      expect(putInstr!.relation).toBe('code-bert-embedding-provider');
      expect((putInstr!.value as Record<string, unknown>).modelName).toBe('codeBERT');
      expect((putInstr!.value as Record<string, unknown>).providerRef).toBe('embedding:codeBERT');
    });

    it('returns a program with ok variant in pure instruction', () => {
      const program = codeBERTEmbeddingProviderHandler.initialize!({});
      const pureInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'pure',
      );
      expect(pureInstr).toBeDefined();
      expect((pureInstr!.value as Record<string, unknown>).variant).toBe('ok');
    });

    it('generates unique instance IDs across calls', () => {
      const program1 = codeBERTEmbeddingProviderHandler.initialize!({});
      const program2 = codeBERTEmbeddingProviderHandler.initialize!({});
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
    it('declares an ONNX transport effect via perform', () => {
      const program = codeBERTEmbeddingProviderHandler.embed!({
        text: 'function hello() {}',
      });
      expect(program.effects.performs.has('onnx:infer')).toBe(true);
    });

    it('includes perform instruction targeting codebert-base session', () => {
      const program = codeBERTEmbeddingProviderHandler.embed!({
        text: 'const x = 1;',
      });
      const performInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'perform',
      );
      expect(performInstr).toBeDefined();
      expect(performInstr!.protocol).toBe('onnx');
      expect(performInstr!.operation).toBe('infer');
    });
  });
});
