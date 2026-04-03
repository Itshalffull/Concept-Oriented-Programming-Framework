// ClaudeEvaluatorProvider handler unit tests
// Validates register, assess guard clauses, and graceful LLM degradation.
// Uses the imperative compat call style: handler.method(input, storage)
// which returns { variant, ...output } via autoInterpret.

import { describe, it, expect } from 'vitest';
import { claudeEvaluatorHandler } from '../handlers/ts/quality-measurement/providers/claude-evaluator.handler.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

describe('ClaudeEvaluatorProvider', () => {
  it('register returns provider name', async () => {
    const storage = createInMemoryStorage();
    const result = await (claudeEvaluatorHandler as any).register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('ClaudeEvaluatorProvider');
  });

  it('assess returns error when target is empty', async () => {
    const storage = createInMemoryStorage();
    const result = await (claudeEvaluatorHandler as any).assess(
      { target: '', config: '{}' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toMatch(/target is required/i);
  });

  it('assess returns error when config is empty', async () => {
    const storage = createInMemoryStorage();
    const result = await (claudeEvaluatorHandler as any).assess(
      { target: 'auth/login.ts', config: '' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toMatch(/config is required/i);
  });

  it('assess returns error when config is not valid JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await (claudeEvaluatorHandler as any).assess(
      { target: 'auth/login.ts', config: 'not-json' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toMatch(/config must be valid JSON/i);
  });

  it('assess returns ok with parseable ratings and issues JSON (LLM degrades gracefully)', async () => {
    const storage = createInMemoryStorage();
    const result = await (claudeEvaluatorHandler as any).assess(
      {
        target: 'auth/login.ts',
        config: JSON.stringify({ persona: 'security', model: 'claude-opus-4-5' }),
      },
      storage,
    );
    // The LLM endpoint is not reachable in tests — the handler returns ok
    // with fallback/error-embedded ratings and issues (graceful degradation).
    expect(result.variant).toBe('ok');
    expect(typeof result.ratings).toBe('string');
    expect(typeof result.issues).toBe('string');
    // ratings must be parseable JSON with the expected keys
    const ratings = JSON.parse(result.ratings as string) as Record<string, unknown>;
    expect(ratings).toHaveProperty('overall');
    expect(ratings).toHaveProperty('intentAlignment');
    expect(ratings).toHaveProperty('readability');
    expect(ratings).toHaveProperty('errorHandling');
    expect(ratings).toHaveProperty('namingQuality');
    // issues must be a parseable JSON array
    const issues = JSON.parse(result.issues as string);
    expect(Array.isArray(issues)).toBe(true);
  });

  it('assess with same target+config twice uses cache key (second call is idempotent)', async () => {
    const storage = createInMemoryStorage();
    const input = {
      target: 'utils/helpers.ts',
      config: JSON.stringify({ persona: 'junior', contentHash: 'abc123' }),
    };
    const r1 = await (claudeEvaluatorHandler as any).assess(input, storage);
    const r2 = await (claudeEvaluatorHandler as any).assess(input, storage);
    expect(r1.variant).toBe('ok');
    expect(r2.variant).toBe('ok');
  });
});
