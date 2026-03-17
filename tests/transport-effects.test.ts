// ============================================================
// Transport Effects Tests
//
// Tests for transport effect tracking in EffectSet (performs),
// the perform()/performFrom() builders, extractPerformSet(),
// TransportEffectProvider, and EffectHandler concept.
//
// See Architecture doc — Transport Effects
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createProgram, get, put, pure, perform, performFrom,
  branch, complete, extractPerformSet, serializeProgram,
  type StorageProgram,
} from '../runtime/storage-program.js';
import { transportEffectProviderHandler } from '../handlers/ts/monadic/providers/transport-effect-provider.handler.js';
import { effectHandlerHandler } from '../handlers/ts/monadic/effect-handler.handler.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
 */
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
    if (instr.tag === 'branch') {
      const thenVal = getPureValue(instr.thenBranch as StorageProgram<unknown>);
      const elseVal = getPureValue(instr.elseBranch as StorageProgram<unknown>);
      return thenVal || elseVal;
    }
  }
  return null;
}

// ============================================================
// EffectSet Extension — performs
// ============================================================

describe('EffectSet performs', () => {
  it('emptyEffects includes empty performs', () => {
    const p = createProgram();
    expect(p.effects.performs).toBeDefined();
    expect(p.effects.performs.size).toBe(0);
  });

  it('get/put do not add performs', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    expect(p.effects.performs.size).toBe(0);
    p = put(p, 'users', 'u1', { name: 'Alice' });
    expect(p.effects.performs.size).toBe(0);
  });

  it('perform() adds protocol:operation to performs', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/api/users' }, 'resp');
    expect(p.effects.performs.size).toBe(1);
    expect(p.effects.performs.has('http:GET')).toBe(true);
  });

  it('performFrom() adds protocol:operation to performs', () => {
    let p = createProgram();
    p = performFrom(p, 'grpc', 'invoke', () => ({ service: 'UserService' }), 'resp');
    expect(p.effects.performs.size).toBe(1);
    expect(p.effects.performs.has('grpc:invoke')).toBe(true);
  });

  it('multiple performs accumulate', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/users' }, 'users');
    p = perform(p, 'http', 'POST', { url: '/users', body: {} }, 'created');
    p = perform(p, 'ws', 'send', { channel: 'updates' }, 'sent');
    expect(p.effects.performs.size).toBe(3);
    expect(p.effects.performs.has('http:GET')).toBe(true);
    expect(p.effects.performs.has('http:POST')).toBe(true);
    expect(p.effects.performs.has('ws:send')).toBe(true);
  });

  it('duplicate protocol:operation is deduplicated in effects', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/users' }, 'resp1');
    p = perform(p, 'http', 'GET', { url: '/posts' }, 'resp2');
    expect(p.effects.performs.size).toBe(1);
    expect(p.effects.performs.has('http:GET')).toBe(true);
  });

  it('perform() produces correct instruction', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/api' }, 'response');
    const instr = p.instructions[0];
    expect(instr.tag).toBe('perform');
    if (instr.tag === 'perform') {
      expect(instr.protocol).toBe('http');
      expect(instr.operation).toBe('GET');
      expect(instr.payload).toEqual({ url: '/api' });
      expect(instr.bindAs).toBe('response');
    }
  });

  it('performFrom() produces correct instruction', () => {
    let p = createProgram();
    const payloadFn = () => ({ service: 'Test' });
    p = performFrom(p, 'grpc', 'invoke', payloadFn, 'result');
    const instr = p.instructions[0];
    expect(instr.tag).toBe('performFrom');
    if (instr.tag === 'performFrom') {
      expect(instr.protocol).toBe('grpc');
      expect(instr.operation).toBe('invoke');
      expect(instr.payloadFn).toBe(payloadFn);
      expect(instr.bindAs).toBe('result');
    }
  });

  it('perform() rejects sealed programs', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok' });
    expect(() => perform(p, 'http', 'GET', {}, 'resp')).toThrow('sealed');
  });

  it('performFrom() rejects sealed programs', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok' });
    expect(() => performFrom(p, 'http', 'GET', () => ({}), 'resp')).toThrow('sealed');
  });

  it('branch merges performs from both arms', () => {
    let p = createProgram();
    const thenBranch = perform(createProgram(), 'http', 'GET', {}, 'resp');
    const elseBranch = perform(createProgram(), 'ws', 'send', {}, 'sent');
    p = branch(p, () => true, thenBranch, elseBranch);
    expect(p.effects.performs.size).toBe(2);
    expect(p.effects.performs.has('http:GET')).toBe(true);
    expect(p.effects.performs.has('ws:send')).toBe(true);
  });

  it('performs coexist with reads, writes, and completionVariants', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = perform(p, 'http', 'POST', { body: {} }, 'resp');
    p = put(p, 'results', 'r1', { status: 'ok' });
    p = complete(p, 'ok', { result: 'r1' });
    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.writes.has('results')).toBe(true);
    expect(p.effects.performs.has('http:POST')).toBe(true);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
  });
});

// ============================================================
// extractPerformSet — Analysis Helper
// ============================================================

describe('extractPerformSet', () => {
  it('extracts from perform instruction', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', {}, 'resp');
    const performs = extractPerformSet(p);
    expect(performs.has('http:GET')).toBe(true);
    expect(performs.size).toBe(1);
  });

  it('extracts from performFrom instruction', () => {
    let p = createProgram();
    p = performFrom(p, 'grpc', 'invoke', () => ({}), 'resp');
    const performs = extractPerformSet(p);
    expect(performs.has('grpc:invoke')).toBe(true);
  });

  it('extracts from branching programs', () => {
    const thenP = perform(createProgram(), 'http', 'GET', {}, 'r1');
    const elseP = perform(createProgram(), 'http', 'POST', {}, 'r2');
    let p = createProgram();
    p = branch(p, () => true, thenP, elseP);
    const performs = extractPerformSet(p);
    expect(performs.has('http:GET')).toBe(true);
    expect(performs.has('http:POST')).toBe(true);
    expect(performs.size).toBe(2);
  });

  it('returns empty set for programs without performs', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = pure(p, { variant: 'ok' });
    const performs = extractPerformSet(p);
    expect(performs.size).toBe(0);
  });
});

// ============================================================
// serializeProgram — performs in serialization
// ============================================================

describe('serializeProgram with performs', () => {
  it('includes performs in serialized output', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/api' }, 'resp');
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.performs).toEqual(['http:GET']);
  });

  it('serializes empty performs when none present', () => {
    let p = createProgram();
    p = pure(p, { variant: 'ok' });
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.performs).toEqual([]);
  });

  it('serializes multiple performs', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', {}, 'r1');
    p = perform(p, 'ws', 'send', {}, 'r2');
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.performs.sort()).toEqual(['http:GET', 'ws:send']);
  });

  it('serializes performFrom payloadFn as string', () => {
    let p = createProgram();
    p = performFrom(p, 'http', 'POST', (b) => ({ user: b.userId }), 'resp');
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    const instr = parsed.instructions[0];
    expect(typeof instr.payloadFn).toBe('string');
    expect(instr.payloadFn).toContain('userId');
  });

  it('serializes perform instruction fields correctly', () => {
    let p = createProgram();
    p = perform(p, 'http', 'GET', { url: '/api', headers: { auth: 'token' } }, 'resp');
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    const instr = parsed.instructions[0];
    expect(instr.tag).toBe('perform');
    expect(instr.protocol).toBe('http');
    expect(instr.operation).toBe('GET');
    expect(instr.payload).toEqual({ url: '/api', headers: { auth: 'token' } });
    expect(instr.bindAs).toBe('resp');
  });
});

// ============================================================
// TransportEffectProvider — Handler Tests
// ============================================================

describe('TransportEffectProvider', () => {
  describe('analyze', () => {
    it('extracts performs from structural effects (fast path)', () => {
      let p = createProgram();
      p = perform(p, 'http', 'GET', {}, 'resp');
      p = complete(p, 'ok', {});
      const serialized = serializeProgram(p);

      const result = transportEffectProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs).toEqual(['http:GET']);
      expect(val?.performCount).toBe(1);
    });

    it('extracts multiple performs from program', () => {
      let p = createProgram();
      p = perform(p, 'http', 'GET', {}, 'r1');
      p = perform(p, 'http', 'POST', {}, 'r2');
      p = perform(p, 'ws', 'send', {}, 'r3');
      const serialized = serializeProgram(p);

      const result = transportEffectProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs.sort()).toEqual(['http:GET', 'http:POST', 'ws:send']);
    });

    it('extracts from instruction walk when no structural effects', () => {
      const programStr = JSON.stringify({
        instructions: [
          { tag: 'perform', protocol: 'http', operation: 'GET', payload: {}, bindAs: 'resp' },
        ],
        terminated: false,
        effects: { reads: [], writes: [], completionVariants: [] },
      });

      const result = transportEffectProviderHandler.analyze({ program: programStr });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs).toEqual(['http:GET']);
      expect(val?.performCount).toBe(1);
    });

    it('extracts from branch instructions', () => {
      const programStr = JSON.stringify({
        instructions: [
          {
            tag: 'branch',
            condition: '() => true',
            thenBranch: {
              instructions: [{ tag: 'perform', protocol: 'http', operation: 'GET', payload: {}, bindAs: 'r1' }],
              terminated: false,
              effects: { reads: [], writes: [] },
            },
            elseBranch: {
              instructions: [{ tag: 'perform', protocol: 'ws', operation: 'send', payload: {}, bindAs: 'r2' }],
              terminated: false,
              effects: { reads: [], writes: [] },
            },
          },
        ],
        terminated: false,
        effects: { reads: [], writes: [] },
      });

      const result = transportEffectProviderHandler.analyze({ program: programStr });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs.sort()).toEqual(['http:GET', 'ws:send']);
    });

    it('returns empty performs for programs without transport effects', () => {
      let p = createProgram();
      p = get(p, 'users', 'u1', 'user');
      p = complete(p, 'ok', {});
      const serialized = serializeProgram(p);

      const result = transportEffectProviderHandler.analyze({ program: serialized });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs).toEqual([]);
      expect(val?.performCount).toBe(0);
    });

    it('handles invalid JSON gracefully', () => {
      const result = transportEffectProviderHandler.analyze({ program: 'not valid json{{{' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      const performs = JSON.parse(val?.performs as string);
      expect(performs).toEqual([]);
    });

    it('uses complete() in its own output (dogfooding)', () => {
      let p = createProgram();
      p = perform(p, 'http', 'GET', {}, 'resp');
      const serialized = serializeProgram(p);
      const result = transportEffectProviderHandler.analyze({ program: serialized });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });

    it('counts performs including duplicates', () => {
      const programStr = JSON.stringify({
        instructions: [
          { tag: 'perform', protocol: 'http', operation: 'GET', payload: {}, bindAs: 'r1' },
          { tag: 'perform', protocol: 'http', operation: 'GET', payload: {}, bindAs: 'r2' },
          { tag: 'perform', protocol: 'http', operation: 'POST', payload: {}, bindAs: 'r3' },
        ],
        terminated: false,
        effects: { reads: [], writes: [] },
      });

      const result = transportEffectProviderHandler.analyze({ program: programStr });
      const val = getPureValue(result);
      expect(val?.performCount).toBe(3);
    });
  });
});

// ============================================================
// EffectHandler — Handler Tests
// ============================================================

describe('EffectHandler', () => {
  describe('register', () => {
    it('registers a protocol:operation handler', () => {
      const result = effectHandlerHandler.register({ protocol: 'http', operation: 'GET' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.handler).toBe('http:GET');
    });

    it('uses complete() in its own output (dogfooding)', () => {
      const result = effectHandlerHandler.register({ protocol: 'http', operation: 'GET' });
      expect(result.effects.completionVariants.has('ok')).toBe(true);
    });

    it('tracks writes to handlers relation', () => {
      const result = effectHandlerHandler.register({ protocol: 'ws', operation: 'send' });
      expect(result.effects.writes.has('handlers')).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns ok with handler id', () => {
      const result = effectHandlerHandler.resolve({ protocol: 'http', operation: 'GET' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.handler).toBe('http:GET');
    });

    it('tracks reads from handlers relation', () => {
      const result = effectHandlerHandler.resolve({ protocol: 'http', operation: 'GET' });
      expect(result.effects.reads.has('handlers')).toBe(true);
    });
  });

  describe('listByProtocol', () => {
    it('returns ok variant', () => {
      const result = effectHandlerHandler.listByProtocol({ protocol: 'http' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
    });
  });

  describe('deregister', () => {
    it('returns ok with handler id', () => {
      const result = effectHandlerHandler.deregister({ protocol: 'http', operation: 'GET' });
      const val = getPureValue(result);
      expect(val?.variant).toBe('ok');
      expect(val?.handler).toBe('http:GET');
    });

    it('tracks writes to handlers relation', () => {
      const result = effectHandlerHandler.deregister({ protocol: 'ws', operation: 'send' });
      expect(result.effects.writes.has('handlers')).toBe(true);
    });
  });
});

// ============================================================
// Integration — End-to-End Flow
// ============================================================

describe('Transport Effects Integration', () => {
  it('perform() → serialize → TransportEffectProvider extracts effects', () => {
    // Step 1: Build a handler program with transport effects
    let handlerProgram = createProgram();
    handlerProgram = perform(handlerProgram, 'http', 'GET', { url: '/api/users' }, 'users');
    handlerProgram = perform(handlerProgram, 'http', 'POST', { url: '/api/notify', body: {} }, 'notified');
    handlerProgram = complete(handlerProgram, 'ok', { users: 'bound', notified: 'bound' });

    // Step 2: Serialize
    const serialized = serializeProgram(handlerProgram);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.performs.sort()).toEqual(['http:GET', 'http:POST']);

    // Step 3: Extract transport effects via provider
    const result = transportEffectProviderHandler.analyze({ program: serialized });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const performs = JSON.parse(val?.performs as string);
    expect(performs.sort()).toEqual(['http:GET', 'http:POST']);
  });

  it('perform() + complete() track all three effect dimensions', () => {
    let p = createProgram();
    p = get(p, 'config', 'app', 'config');
    p = perform(p, 'http', 'POST', { body: {} }, 'resp');
    p = put(p, 'results', 'r1', { status: 'sent' });
    p = complete(p, 'ok', { result: 'r1' });

    // All three dimensions tracked structurally
    expect(p.effects.reads.has('config')).toBe(true);
    expect(p.effects.writes.has('results')).toBe(true);
    expect(p.effects.performs.has('http:POST')).toBe(true);
    expect(p.effects.completionVariants.has('ok')).toBe(true);

    // Serialization preserves all dimensions
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.reads).toEqual(['config']);
    expect(parsed.effects.writes).toEqual(['results']);
    expect(parsed.effects.performs).toEqual(['http:POST']);
    expect(parsed.effects.completionVariants).toEqual(['ok']);
  });

  it('branching with mixed transport effects and completions', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');

    // Then: call external API + succeed
    let thenBranch = createProgram();
    thenBranch = perform(thenBranch, 'http', 'POST', { action: 'notify' }, 'notified');
    thenBranch = complete(thenBranch, 'ok', { notified: true });

    // Else: different external call + fail
    let elseBranch = createProgram();
    elseBranch = perform(elseBranch, 'ws', 'send', { channel: 'errors' }, 'sent');
    elseBranch = complete(elseBranch, 'notfound', { message: 'user missing' });

    p = branch(p, (b) => !!b.user, thenBranch, elseBranch);

    // All effects merged conservatively
    expect(p.effects.reads.has('users')).toBe(true);
    expect(p.effects.performs.has('http:POST')).toBe(true);
    expect(p.effects.performs.has('ws:send')).toBe(true);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
    expect(p.effects.completionVariants.has('notfound')).toBe(true);

    // Provider extracts both transport effects
    const serialized = serializeProgram(p);
    const result = transportEffectProviderHandler.analyze({ program: serialized });
    const val = getPureValue(result);
    const performs = JSON.parse(val?.performs as string);
    expect(performs.sort()).toEqual(['http:POST', 'ws:send']);
  });

  it('EffectHandler register + resolve round trip', () => {
    // Register
    const regResult = effectHandlerHandler.register({ protocol: 'http', operation: 'GET' });
    const regVal = getPureValue(regResult);
    expect(regVal?.variant).toBe('ok');
    expect(regVal?.handler).toBe('http:GET');

    // Resolve the same
    const resResult = effectHandlerHandler.resolve({ protocol: 'http', operation: 'GET' });
    const resVal = getPureValue(resResult);
    expect(resVal?.variant).toBe('ok');
    expect(resVal?.handler).toBe('http:GET');
  });
});

// ============================================================
// Backward Compatibility
// ============================================================

describe('Transport Effects Backward Compatibility', () => {
  it('programs without performs serialize with empty performs array', () => {
    let p = createProgram();
    p = get(p, 'users', 'u1', 'user');
    p = pure(p, { variant: 'ok' });
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    expect(parsed.effects.performs).toEqual([]);
  });

  it('existing complete() programs still work with performs tracking', () => {
    let p = createProgram();
    p = complete(p, 'ok', { data: 'test' });
    expect(p.effects.performs.size).toBe(0);
    expect(p.effects.completionVariants.has('ok')).toBe(true);
  });

  it('TransportEffectProvider handles legacy programs without performs', () => {
    const legacyProgram = JSON.stringify({
      instructions: [
        { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
        { tag: 'pure', value: { variant: 'ok' } },
      ],
      terminated: true,
      effects: { reads: ['users'], writes: [] },
    });

    const result = transportEffectProviderHandler.analyze({ program: legacyProgram });
    const val = getPureValue(result);
    expect(val?.variant).toBe('ok');
    const performs = JSON.parse(val?.performs as string);
    expect(performs).toEqual([]);
  });

  it('VariantExtractionProvider is unaffected by performs', () => {
    // Import lazily to avoid duplicate import issues in test
    let p = createProgram();
    p = perform(p, 'http', 'GET', {}, 'resp');
    p = complete(p, 'ok', {});
    const serialized = serializeProgram(p);
    const parsed = JSON.parse(serialized);
    // completionVariants still present alongside performs
    expect(parsed.effects.completionVariants).toEqual(['ok']);
    expect(parsed.effects.performs).toEqual(['http:GET']);
  });
});
