// LLMCall — business.test.ts
// Business logic tests for LLM invocation lifecycle with schema validation and repair loops.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { llmCallHandler } from './handler.js';
import type { LLMCallStorage } from './types.js';

const createTestStorage = (): LLMCallStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('LLMCall business logic', () => {
  it('full happy path: request -> recordResponse -> validate (valid) -> accepted', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-1',
      step_ref: 'extract-info',
      model: 'gpt-4',
      prompt: 'Extract the name and age from the text',
      output_schema: '{"name":"string","age":"number"}',
      max_attempts: 3,
    }, storage)();

    const rrResult = await llmCallHandler.recordResponse({
      call_id: 'call-1',
      raw_output: '{"name":"Alice","age":30}',
      prompt_tokens: 50,
      completion_tokens: 20,
    }, storage)();

    if (E.isRight(rrResult) && rrResult.right.variant === 'ok') {
      expect(rrResult.right.status).toBe('validating');
    }

    const valResult = await llmCallHandler.validate({ call_id: 'call-1' }, storage)();
    if (E.isRight(valResult)) {
      expect(valResult.right.variant).toBe('valid');
      if (valResult.right.variant === 'valid') {
        expect(valResult.right.parsed_output).toBe('{"name":"Alice","age":30}');
      }
    }
  });

  it('validation failure with missing keys triggers repairing state', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-2',
      step_ref: 'extract',
      model: 'gpt-4',
      prompt: 'Extract data',
      output_schema: '{"name":"string","email":"string","phone":"string"}',
      max_attempts: 3,
    }, storage)();

    await llmCallHandler.recordResponse({
      call_id: 'call-2',
      raw_output: '{"name":"Bob"}',
      prompt_tokens: 30,
      completion_tokens: 10,
    }, storage)();

    const valResult = await llmCallHandler.validate({ call_id: 'call-2' }, storage)();
    if (E.isRight(valResult)) {
      expect(valResult.right.variant).toBe('invalid');
      if (valResult.right.variant === 'invalid') {
        const errors = JSON.parse(valResult.right.errors);
        expect(errors).toContain('Missing required key: email');
        expect(errors).toContain('Missing required key: phone');
      }
    }
  });

  it('validation of non-JSON output triggers repair', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-3',
      step_ref: 'extract',
      model: 'gpt-4',
      prompt: 'Give JSON',
      output_schema: '{"result":"string"}',
      max_attempts: 3,
    }, storage)();

    await llmCallHandler.recordResponse({
      call_id: 'call-3',
      raw_output: 'This is not JSON at all',
      prompt_tokens: 20,
      completion_tokens: 15,
    }, storage)();

    const valResult = await llmCallHandler.validate({ call_id: 'call-3' }, storage)();
    if (E.isRight(valResult)) {
      expect(valResult.right.variant).toBe('invalid');
    }
  });

  it('repair increments attempt and transitions back to requesting', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-4',
      step_ref: 'extract',
      model: 'gpt-4',
      prompt: 'Extract data',
      output_schema: '{"x":"number"}',
      max_attempts: 3,
    }, storage)();

    await llmCallHandler.recordResponse({
      call_id: 'call-4',
      raw_output: 'not json',
      prompt_tokens: 10,
      completion_tokens: 5,
    }, storage)();

    await llmCallHandler.validate({ call_id: 'call-4' }, storage)();

    const repairResult = await llmCallHandler.repair({
      call_id: 'call-4',
      feedback: 'Please return valid JSON',
    }, storage)();

    if (E.isRight(repairResult) && repairResult.right.variant === 'ok') {
      expect(repairResult.right.attempt_count).toBe(2);
    }
  });

  it('repair exhausts max_attempts and transitions to rejected', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-5',
      step_ref: 'extract',
      model: 'gpt-4',
      prompt: 'Extract data',
      output_schema: '{"result":"string"}',
      max_attempts: 1,
    }, storage)();

    await llmCallHandler.recordResponse({
      call_id: 'call-5',
      raw_output: 'not json',
      prompt_tokens: 10,
      completion_tokens: 5,
    }, storage)();

    await llmCallHandler.validate({ call_id: 'call-5' }, storage)();

    const repairResult = await llmCallHandler.repair({
      call_id: 'call-5',
      feedback: 'Try again',
    }, storage)();

    if (E.isRight(repairResult)) {
      expect(repairResult.right.variant).toBe('max_attempts_reached');
    }
  });

  it('accept from requesting state (no schema) works', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-6',
      step_ref: 'free-form',
      model: 'gpt-4',
      prompt: 'Write a poem',
      max_attempts: 1,
    }, storage)();

    await llmCallHandler.recordResponse({
      call_id: 'call-6',
      raw_output: 'Roses are red, violets are blue',
      prompt_tokens: 10,
      completion_tokens: 8,
    }, storage)();

    const acceptResult = await llmCallHandler.accept({ call_id: 'call-6' }, storage)();
    if (E.isRight(acceptResult)) {
      expect(acceptResult.right.variant).toBe('ok');
    }
  });

  it('reject from requesting state works', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-7',
      step_ref: 'bad-call',
      model: 'gpt-4',
      prompt: 'Generate content',
      max_attempts: 1,
    }, storage)();

    const rejectResult = await llmCallHandler.reject({ call_id: 'call-7' }, storage)();
    if (E.isRight(rejectResult)) {
      expect(rejectResult.right.variant).toBe('ok');
    }
  });

  it('cannot accept already-accepted call', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-8',
      step_ref: 'step',
      model: 'gpt-4',
      prompt: 'prompt',
      max_attempts: 1,
    }, storage)();

    await llmCallHandler.accept({ call_id: 'call-8' }, storage)();

    const result = await llmCallHandler.accept({ call_id: 'call-8' }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('cannot reject already-rejected call', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-9',
      step_ref: 'step',
      model: 'gpt-4',
      prompt: 'prompt',
      max_attempts: 1,
    }, storage)();

    await llmCallHandler.reject({ call_id: 'call-9' }, storage)();

    const result = await llmCallHandler.reject({ call_id: 'call-9' }, storage)();
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_status');
    }
  });

  it('not_found for all operations on non-existent call', async () => {
    const storage = createTestStorage();

    const rr = await llmCallHandler.recordResponse({
      call_id: 'ghost', raw_output: '', prompt_tokens: 0, completion_tokens: 0,
    }, storage)();
    if (E.isRight(rr)) expect(rr.right.variant).toBe('notfound');

    const val = await llmCallHandler.validate({ call_id: 'ghost' }, storage)();
    if (E.isRight(val)) expect(val.right.variant).toBe('notfound');

    const rep = await llmCallHandler.repair({ call_id: 'ghost', feedback: '' }, storage)();
    if (E.isRight(rep)) expect(rep.right.variant).toBe('notfound');

    const acc = await llmCallHandler.accept({ call_id: 'ghost' }, storage)();
    if (E.isRight(acc)) expect(acc.right.variant).toBe('notfound');

    const rej = await llmCallHandler.reject({ call_id: 'ghost' }, storage)();
    if (E.isRight(rej)) expect(rej.right.variant).toBe('notfound');
  });

  it('recordResponse without output_schema stays in requesting status', async () => {
    const storage = createTestStorage();

    await llmCallHandler.request({
      call_id: 'call-no-schema',
      step_ref: 'free',
      model: 'gpt-4',
      prompt: 'Write something',
      max_attempts: 1,
    }, storage)();

    const result = await llmCallHandler.recordResponse({
      call_id: 'call-no-schema',
      raw_output: 'Here is some output',
      prompt_tokens: 10,
      completion_tokens: 5,
    }, storage)();

    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.status).toBe('requesting');
    }
  });
});
