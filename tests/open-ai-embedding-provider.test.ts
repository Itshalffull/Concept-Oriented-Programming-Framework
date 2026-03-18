// ============================================================
// OpenAIEmbeddingProvider Handler Tests — Functional Style
//
// Embedding model provider using OpenAI's text-embedding-3-large API.
// Handler now returns StoragePrograms (functional style).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  openAIEmbeddingProviderHandler,
  resetOpenAIEmbeddingProviderCounter,
} from '../handlers/ts/open-ai-embedding-provider.handler.js';

describe('OpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    resetOpenAIEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', () => {
      const program = openAIEmbeddingProviderHandler.initialize!({});
      expect(program).toBeDefined();
      expect(program.instructions).toBeDefined();
      expect(Array.isArray(program.instructions)).toBe(true);
    });

    it('stores provider with correct model name and ref via put instruction', () => {
      const program = openAIEmbeddingProviderHandler.initialize!({});
      const putInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'put',
      );
      expect(putInstr).toBeDefined();
      expect(putInstr!.relation).toBe('open-ai-embedding-provider');
      expect((putInstr!.value as Record<string, unknown>).modelName).toBe('openai-code');
      expect((putInstr!.value as Record<string, unknown>).providerRef).toBe('embedding:openai-code');
    });

    it('returns a program with ok variant in pure instruction', () => {
      const program = openAIEmbeddingProviderHandler.initialize!({});
      const pureInstr = program.instructions.find(
        (i: Record<string, unknown>) => i.tag === 'pure',
      );
      expect(pureInstr).toBeDefined();
      expect((pureInstr!.value as Record<string, unknown>).variant).toBe('ok');
    });

    it('generates unique instance IDs across calls', () => {
      const program1 = openAIEmbeddingProviderHandler.initialize!({});
      const program2 = openAIEmbeddingProviderHandler.initialize!({});
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
      const program = openAIEmbeddingProviderHandler.embed!({
        text: 'function hello() {}',
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });
      expect(program.effects.performs.has('http:POST')).toBe(true);
    });

    it('includes perform instruction targeting openai-embeddings endpoint', () => {
      const program = openAIEmbeddingProviderHandler.embed!({
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
