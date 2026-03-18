// StatusGate Concept Handler Tests — Functional Style
// Validates gate lifecycle, provider dispatch, and configuration.
// Handler now returns StoragePrograms (functional style).

import { describe, it, expect } from 'vitest';
import { statusGateHandler } from '../handlers/ts/framework/status-gate.handler.js';

// Helper to extract pure instruction value
function getPureValue(program: { instructions: Array<Record<string, unknown>> }): Record<string, unknown> {
  const pureInstr = program.instructions.find(i => i.tag === 'pure');
  return pureInstr ? pureInstr.value as Record<string, unknown> : {};
}

function getPutInstruction(program: { instructions: Array<Record<string, unknown>> }, relation: string) {
  return program.instructions.find(i => i.tag === 'put' && i.relation === relation);
}

function getPerformInstruction(program: { instructions: Array<Record<string, unknown>> }) {
  return program.instructions.find(i => i.tag === 'perform');
}

// ── Basic lifecycle ──────────────────────────────────────────────────

describe('StatusGate: report', () => {
  it('creates a gate with exit-code provider by default', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '3 proved',
      provider: '',
      url: '',
    });

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.target).toBe('abc123');
    expect(pv.provider).toBe('exit-code');
    expect(pv.gate).toBeTruthy();
  });

  it('uses explicit provider when specified', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '',
      provider: 'github',
      url: '',
    });

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.provider).toBe('github');
  });

  it('persists the gate in storage via put instruction', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: 'all green',
      provider: '',
      url: '',
    });

    const putInstr = getPutInstruction(p, 'gates');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).target).toBe('abc123');
    expect((putInstr!.value as Record<string, unknown>).status).toBe('passing');
    expect((putInstr!.value as Record<string, unknown>).details).toBe('all green');
    expect((putInstr!.value as Record<string, unknown>).completed).toBe(false);
  });

  it('declares http perform effect for github provider', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: 'proved',
      provider: 'github',
      url: '',
    });

    expect(p.effects.performs.has('http:POST')).toBe(true);
    const perf = getPerformInstruction(p);
    expect(perf).toBeDefined();
    expect((perf!.payload as Record<string, unknown>).endpoint).toBe('github-api');
  });

  it('declares http perform effect for gitlab provider', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '',
      provider: 'gitlab',
      url: '',
    });

    expect(p.effects.performs.has('http:POST')).toBe(true);
    const perf = getPerformInstruction(p);
    expect(perf).toBeDefined();
    expect((perf!.payload as Record<string, unknown>).endpoint).toBe('gitlab-api');
  });

  it('declares http perform effect for webhook provider', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '',
      provider: 'webhook',
      url: 'https://hooks.example.com/gate',
    });

    expect(p.effects.performs.has('http:POST')).toBe(true);
    const perf = getPerformInstruction(p);
    expect(perf).toBeDefined();
    expect((perf!.payload as Record<string, unknown>).endpoint).toBe('webhook');
  });

  it('does not declare perform for exit-code provider', () => {
    const p = statusGateHandler.report!({
      target: 'abc123',
      context: 'clef/verify',
      status: 'passing',
      details: '',
      provider: 'exit-code',
      url: '',
    });

    expect(p.effects.performs.size).toBe(0);
  });
});

// ── Update ───────────────────────────────────────────────────────────

describe('StatusGate: update', () => {
  it('reads gate and updates status', () => {
    const p = statusGateHandler.update!({
      gate: 'gate-123',
      status: 'passing',
      details: 'done',
    });

    const getInstr = p.instructions.find(i => i.tag === 'get');
    expect(getInstr).toBeDefined();
    expect(getInstr!.relation).toBe('gates');
    expect(getInstr!.key).toBe('gate-123');

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.gate).toBe('gate-123');
    expect(pv.status).toBe('passing');
  });

  it('declares http perform for provider dispatch', () => {
    const p = statusGateHandler.update!({
      gate: 'gate-123',
      status: 'passing',
      details: 'all green',
    });

    expect(p.effects.performs.has('http:POST')).toBe(true);
  });
});

// ── Complete ─────────────────────────────────────────────────────────

describe('StatusGate: complete', () => {
  it('marks gate as completed with accepted=true for passing', () => {
    const p = statusGateHandler.complete!({
      gate: 'gate-123',
      final_status: 'passing',
      details: 'all done',
    });

    const putInstr = getPutInstruction(p, 'gates');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).completed).toBe(true);

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.accepted).toBe(true);
  });

  it('returns accepted=false for failing', () => {
    const p = statusGateHandler.complete!({
      gate: 'gate-123',
      final_status: 'failing',
      details: '2 refuted',
    });

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.accepted).toBe(false);
  });
});

// ── Configure ────────────────────────────────────────────────────────

describe('StatusGate: configure', () => {
  it('stores default provider config', () => {
    const p = statusGateHandler.configure!({
      provider: 'github',
      url: 'https://dashboard.example.com',
    });

    const putInstr = getPutInstruction(p, 'config');
    expect(putInstr).toBeDefined();
    expect(putInstr!.key).toBe('default');
    expect((putInstr!.value as Record<string, unknown>).provider).toBe('github');
    expect((putInstr!.value as Record<string, unknown>).url).toBe('https://dashboard.example.com');

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.provider).toBe('github');
  });
});

// ── List ─────────────────────────────────────────────────────────────

describe('StatusGate: list', () => {
  it('queries gates by target', () => {
    const p = statusGateHandler.list!({ target: 'abc123' });

    const findInstr = p.instructions.find(i => i.tag === 'find');
    expect(findInstr).toBeDefined();
    expect(findInstr!.relation).toBe('gates');

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
  });
});

// ── get_status ───────────────────────────────────────────────────────

describe('StatusGate: get_status', () => {
  it('reads gate by ID', () => {
    const p = statusGateHandler.get_status!({ gate: 'gate-123' });

    const getInstr = p.instructions.find(i => i.tag === 'get');
    expect(getInstr).toBeDefined();
    expect(getInstr!.key).toBe('gate-123');

    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
  });
});
