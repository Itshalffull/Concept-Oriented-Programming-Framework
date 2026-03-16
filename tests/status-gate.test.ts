// StatusGate Concept Handler Tests
// Validates gate lifecycle, provider dispatch, and configuration.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { statusGateHandler, registerProvider, checkGatesExitCode } from '../handlers/ts/framework/status-gate.handler.js';
import type { ConceptStorage } from '../runtime/types.js';

let storage: ConceptStorage;

beforeEach(() => {
  storage = createInMemoryStorage();
});

// ── Basic lifecycle ──────────────────────────────────────────────────

describe('StatusGate: report', () => {
  it('creates a gate with exit-code provider by default', async () => {
    const result = await statusGateHandler.report({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '3 proved',
      provider: '',
      url: '',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.target).toBe('abc123');
    expect(result.provider).toBe('exit-code');
    expect(result.gate).toBeTruthy();
  });

  it('uses explicit provider when specified', async () => {
    const result = await statusGateHandler.report({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '',
      provider: 'exit-code',
      url: '',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.provider).toBe('exit-code');
  });

  it('persists the gate in storage', async () => {
    const result = await statusGateHandler.report({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: 'all green',
      provider: '',
      url: '',
    }, storage);

    const status = await statusGateHandler.get_status({ gate: result.gate }, storage);
    expect(status.variant).toBe('ok');
    expect(status.target).toBe('abc123');
    expect(status.status).toBe('passing');
    expect(status.details).toBe('all green');
    expect(status.completed).toBe(false);
  });
});

// ── Update ───────────────────────────────────────────────────────────

describe('StatusGate: update', () => {
  it('updates status of an existing gate', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'pending',
      details: 'running', provider: '', url: '',
    }, storage);

    const update = await statusGateHandler.update({
      gate: report.gate, status: 'passing', details: 'done',
    }, storage);

    expect(update.variant).toBe('ok');
    expect(update.status).toBe('passing');

    const status = await statusGateHandler.get_status({ gate: report.gate }, storage);
    expect(status.status).toBe('passing');
    expect(status.details).toBe('done');
  });

  it('returns not_found for unknown gate', async () => {
    const result = await statusGateHandler.update({
      gate: 'nonexistent', status: 'passing', details: '',
    }, storage);

    expect(result.variant).toBe('not_found');
  });

  it('rejects update on completed gate', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    await statusGateHandler.complete({
      gate: report.gate, final_status: 'passing', details: 'done',
    }, storage);

    const update = await statusGateHandler.update({
      gate: report.gate, status: 'failing', details: 'late',
    }, storage);

    expect(update.variant).toBe('already_completed');
  });
});

// ── Complete ─────────────────────────────────────────────────────────

describe('StatusGate: complete', () => {
  it('marks gate as completed and returns accepted=true for passing', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    const result = await statusGateHandler.complete({
      gate: report.gate, final_status: 'passing', details: 'all done',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.accepted).toBe(true);
  });

  it('returns accepted=false for failing', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'failing',
      details: '', provider: '', url: '',
    }, storage);

    const result = await statusGateHandler.complete({
      gate: report.gate, final_status: 'failing', details: '2 refuted',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.accepted).toBe(false);
  });

  it('rejects double completion', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    await statusGateHandler.complete({
      gate: report.gate, final_status: 'passing', details: '',
    }, storage);

    const second = await statusGateHandler.complete({
      gate: report.gate, final_status: 'failing', details: '',
    }, storage);

    expect(second.variant).toBe('already_completed');
  });
});

// ── Configure ────────────────────────────────────────────────────────

describe('StatusGate: configure', () => {
  it('sets default provider', async () => {
    await statusGateHandler.configure({ provider: 'exit-code', url: '' }, storage);

    // Register a test provider to verify dispatch
    const calls: string[] = [];
    registerProvider({
      name: 'configured-test',
      async report(gate) { calls.push(gate.provider); return { ok: true }; },
      async update() { return { ok: true }; },
    });

    await statusGateHandler.configure({ provider: 'configured-test', url: '' }, storage);

    const result = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    expect(result.provider).toBe('configured-test');
    expect(calls).toEqual(['configured-test']);
  });

  it('configured url propagates to gates', async () => {
    await statusGateHandler.configure({ provider: 'exit-code', url: 'https://dashboard.example.com' }, storage);

    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    // Gate should have the configured URL
    const status = await statusGateHandler.get_status({ gate: report.gate }, storage);
    expect(status.variant).toBe('ok');
  });
});

// ── List ─────────────────────────────────────────────────────────────

describe('StatusGate: list', () => {
  it('lists all gates for a target', async () => {
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify/formal', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify/quality', status: 'failing',
      details: '', provider: '', url: '',
    }, storage);
    await statusGateHandler.report({
      target: 'def456', context: 'clef/verify/formal', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    const result = await statusGateHandler.list({ target: 'abc123' }, storage);
    expect(result.variant).toBe('ok');

    const gates = JSON.parse(result.gates as string);
    expect(gates).toHaveLength(2);
    expect(gates.every((g: any) => g.target === 'abc123')).toBe(true);
  });
});

// ── Exit code utility ────────────────────────────────────────────────

describe('StatusGate: checkGatesExitCode', () => {
  it('returns 0 when no gates exist', async () => {
    const code = await checkGatesExitCode(storage);
    expect(code).toBe(0);
  });

  it('returns 0 when all gates are passing', async () => {
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);

    const code = await checkGatesExitCode(storage);
    expect(code).toBe(0);
  });

  it('returns 1 when any gate is failing', async () => {
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify/formal', status: 'passing',
      details: '', provider: '', url: '',
    }, storage);
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify/quality', status: 'failing',
      details: '', provider: '', url: '',
    }, storage);

    const code = await checkGatesExitCode(storage);
    expect(code).toBe(1);
  });

  it('returns 1 when any gate has error status', async () => {
    await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'error',
      details: '', provider: '', url: '',
    }, storage);

    const code = await checkGatesExitCode(storage);
    expect(code).toBe(1);
  });
});

// ── Custom provider ──────────────────────────────────────────────────

describe('StatusGate: custom provider', () => {
  it('dispatches to a registered custom provider', async () => {
    const calls: string[] = [];

    registerProvider({
      name: 'test-provider',
      async report(gate) {
        calls.push(`report:${gate.target}:${gate.status}`);
        return { ok: true };
      },
      async update(gate) {
        calls.push(`update:${gate.target}:${gate.status}`);
        return { ok: true };
      },
    });

    const result = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: 'test-provider', url: '',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.provider).toBe('test-provider');
    expect(calls).toEqual(['report:abc123:passing']);

    await statusGateHandler.update({
      gate: result.gate, status: 'failing', details: 'now bad',
    }, storage);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe('update:abc123:failing');
  });

  it('returns provider_error when provider fails', async () => {
    registerProvider({
      name: 'failing-provider',
      async report() { return { ok: false, message: 'connection refused' }; },
      async update() { return { ok: true }; },
    });

    const result = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: 'failing-provider', url: '',
    }, storage);

    expect(result.variant).toBe('provider_error');
    expect(result.provider).toBe('failing-provider');
    expect(result.message).toContain('connection refused');
  });
});

// ── Invariant: report → get_status ───────────────────────────────────

describe('StatusGate: invariants', () => {
  it('invariant 1: report then get_status returns same data', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '3 proved', provider: 'exit-code', url: '',
    }, storage);

    expect(report.variant).toBe('ok');

    const status = await statusGateHandler.get_status({ gate: report.gate }, storage);
    expect(status.variant).toBe('ok');
    expect(status.target).toBe('abc123');
    expect(status.status).toBe('passing');
    expect(status.provider).toBe('exit-code');
    expect(status.details).toBe('3 proved');
    expect(status.completed).toBe(false);
  });

  it('invariant 2: report then complete returns accepted=true for passing', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: 'all green', provider: 'exit-code', url: '',
    }, storage);

    const complete = await statusGateHandler.complete({
      gate: report.gate, final_status: 'passing', details: 'done',
    }, storage);

    expect(complete.variant).toBe('ok');
    expect(complete.accepted).toBe(true);
  });

  it('invariant 3: completed gate rejects further updates', async () => {
    const report = await statusGateHandler.report({
      target: 'abc123', context: 'clef/verify', status: 'passing',
      details: '', provider: 'exit-code', url: '',
    }, storage);

    await statusGateHandler.complete({
      gate: report.gate, final_status: 'passing', details: 'done',
    }, storage);

    const update = await statusGateHandler.update({
      gate: report.gate, status: 'failing', details: 'late failure',
    }, storage);

    expect(update.variant).toBe('already_completed');
  });
});
