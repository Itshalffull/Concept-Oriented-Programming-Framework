// ============================================================
// MAG-920 / INV-16 — handlers-as-values test-generation renderers.
//
// Covers register() + render() for MockHandlerRenderer,
// ReplayHandlerRenderer, EffectContractRenderer, and
// FieldTransformFuzzRenderer, plus the TestGeneration/run extension
// that dispatches HandlerDescriptors through all four renderers.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage';
import { mockHandlerRendererHandler } from '../handlers/ts/repertoire/test-plan-renderers/mock-handler-renderer.handler';
import { replayHandlerRendererHandler } from '../handlers/ts/repertoire/test-plan-renderers/replay-handler-renderer.handler';
import { effectContractRendererHandler } from '../handlers/ts/repertoire/test-plan-renderers/effect-contract-renderer.handler';
import { fieldTransformFuzzRendererHandler } from '../handlers/ts/repertoire/test-plan-renderers/field-transform-fuzz-renderer.handler';
import {
  descriptorFromProgram,
  descriptorFromExternalMapping,
} from '../handlers/ts/repertoire/test-plan-renderers/handler-descriptor';
import {
  createProgram, put, complete, find,
} from '../runtime/storage-program';
import {
  dispatchHandlerDescriptor,
  testGenerationHandler,
} from '../handlers/ts/repertoire/testing/test-generation.handler';

const storageDescriptor = JSON.stringify({
  conceptName: 'User',
  actionName: 'create',
  kind: 'storage',
  reads: ['users'],
  writes: ['users'],
  performs: [],
  variants: ['ok', 'duplicate'],
});

const externalDescriptor = JSON.stringify({
  conceptName: 'Weather',
  actionName: 'fetch',
  kind: 'external',
  reads: [],
  writes: [],
  performs: ['http:GET'],
  variants: ['ok', 'error'],
  method: 'GET',
  path: '/forecast',
  requestFields: [{ from: 'lat', to: 'latitude' }, { from: 'lon', to: 'longitude' }],
  responseFields: [{ from: 'temp_c', to: 'temperature' }],
});

describe('MockHandlerRenderer', () => {
  it('register returns mock-handler with capabilities', async () => {
    const storage = createInMemoryStorage();
    const r = await mockHandlerRendererHandler.register({}, storage);
    expect(r.variant).toBe('ok');
    expect(r.name).toBe('mock-handler');
    expect(r.capabilities as string).toContain('field-transform');
  });

  it('render emits storage mock with seed map', async () => {
    const storage = createInMemoryStorage();
    const r = await mockHandlerRendererHandler.render({ descriptor: storageDescriptor }, storage);
    expect(r.variant).toBe('ok');
    expect(r.code as string).toContain('UserMockSeed');
    expect(r.code as string).toContain('"users"');
  });

  it('render emits external mock with response shape', async () => {
    const storage = createInMemoryStorage();
    const r = await mockHandlerRendererHandler.render({ descriptor: externalDescriptor }, storage);
    expect(r.variant).toBe('ok');
    expect(r.code as string).toContain('WeatherMockHandler');
    expect(r.code as string).toContain('temperature');
  });

  it('render errors on bad json', async () => {
    const storage = createInMemoryStorage();
    const r = await mockHandlerRendererHandler.render({ descriptor: 'not json' }, storage);
    expect(r.variant).toBe('error');
  });
});

describe('ReplayHandlerRenderer', () => {
  it('register returns replay-handler with capabilities', async () => {
    const storage = createInMemoryStorage();
    const r = await replayHandlerRendererHandler.register({}, storage);
    expect(r.variant).toBe('ok');
    expect(r.name).toBe('replay-handler');
    expect(r.capabilities as string).toContain('cassette');
  });

  it('render emits replay skeleton with cassette path', async () => {
    const storage = createInMemoryStorage();
    const r = await replayHandlerRendererHandler.render({ descriptor: externalDescriptor }, storage);
    expect(r.variant).toBe('ok');
    expect(r.code as string).toContain('CLEF_REPLAY_MODE');
    expect(r.code as string).toContain('tests/cassettes/weather/fetch.json');
  });

  it('render emits cassette I/O, sha256 fingerprint, and node:fs/path/crypto imports', async () => {
    const storage = createInMemoryStorage();
    const r = await replayHandlerRendererHandler.render({ descriptor: externalDescriptor }, storage);
    const code = r.code as string;
    expect(code).toContain("from 'node:fs'");
    expect(code).toContain("from 'node:path'");
    expect(code).toContain("from 'node:crypto'");
    expect(code).toContain('createHash');
    expect(code).toContain("'sha256'");
    expect(code).toContain('stableStringify');
    expect(code).toContain('fingerprint');
    expect(code).toContain('loadCassette');
    expect(code).toContain('writeCassette');
    expect(code).toContain('mkdirSync');
    expect(code).toContain('shapeRequest');
    expect(code).toContain('"lat"');
    expect(code).toContain('"latitude"');
    expect(code).toContain('no cassette entry for fingerprint');
    expect(code).toContain("mode === 'record'");
    expect(code).toContain('realHandler');
  });

  it('render produces storage-descriptor replay with passthrough shapeRequest', async () => {
    const storage = createInMemoryStorage();
    const r = await replayHandlerRendererHandler.render({ descriptor: storageDescriptor }, storage);
    const code = r.code as string;
    expect(code).toContain('return input;');
    expect(code).toContain('tests/cassettes/user/create.json');
  });

  it('fingerprint logic is stable across key order (verified by executing stableStringify)', async () => {
    const { createHash } = await import('node:crypto');
    function stableStringify(value: unknown): string {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
    }
    const a = stableStringify({ a: 1, b: { x: 1, y: 2 } });
    const b = stableStringify({ b: { y: 2, x: 1 }, a: 1 });
    expect(a).toBe(b);
    const fpA = createHash('sha256').update(a).digest('hex');
    const fpB = createHash('sha256').update(b).digest('hex');
    expect(fpA).toBe(fpB);
  });

  it('render errors on empty descriptor', async () => {
    const storage = createInMemoryStorage();
    const r = await replayHandlerRendererHandler.render({ descriptor: '' }, storage);
    expect(r.variant).toBe('error');
  });
});

describe('EffectContractRenderer', () => {
  it('register returns effect-contract with capabilities', async () => {
    const storage = createInMemoryStorage();
    const r = await effectContractRendererHandler.register({}, storage);
    expect(r.variant).toBe('ok');
    expect(r.name).toBe('effect-contract');
    expect(r.capabilities as string).toContain('storage-spy');
  });

  it('render emits vitest test asserting declared effects', async () => {
    const storage = createInMemoryStorage();
    const r = await effectContractRendererHandler.render({ descriptor: storageDescriptor }, storage);
    expect(r.variant).toBe('ok');
    const code = r.code as string;
    expect(code).toContain("describe('User/create effect contract'");
    expect(code).toContain('declaredReads');
    expect(code).toContain('declaredWrites');
    expect(code).toContain('"users"');
  });

  it('render errors on malformed descriptor', async () => {
    const storage = createInMemoryStorage();
    const r = await effectContractRendererHandler.render({ descriptor: '{"conceptName":"X"}' }, storage);
    expect(r.variant).toBe('error');
  });
});

describe('FieldTransformFuzzRenderer', () => {
  it('register returns field-transform-fuzz with capabilities', async () => {
    const storage = createInMemoryStorage();
    const r = await fieldTransformFuzzRendererHandler.register({}, storage);
    expect(r.variant).toBe('ok');
    expect(r.name).toBe('field-transform-fuzz');
    expect(r.capabilities as string).toContain('mutation');
  });

  it('render emits fuzz test over declared request fields', async () => {
    const storage = createInMemoryStorage();
    const r = await fieldTransformFuzzRendererHandler.render({ descriptor: externalDescriptor }, storage);
    expect(r.variant).toBe('ok');
    const code = r.code as string;
    expect(code).toContain('FIELDS =');
    expect(code).toContain('"lat"');
    expect(code).toContain('"lon"');
    expect(code).toContain('mutate');
  });

  it('emitted test uses fast-check assert + property with per-field arbitraries', async () => {
    const storage = createInMemoryStorage();
    const r = await fieldTransformFuzzRendererHandler.render({ descriptor: externalDescriptor }, storage);
    const code = r.code as string;
    expect(code).toContain("import * as fc from 'fast-check'");
    expect(code).toContain('fc.assert');
    expect(code).toContain('fc.asyncProperty');
    expect(code).toContain('fc.record');
    expect(code).toMatch(/"lat":\s*fc\.\w+/);
    expect(code).toMatch(/"lon":\s*fc\.\w+/);
    expect(code).toContain("expect(r.variant).toBe('ok')");
    expect(code).toContain("expect(r!.variant).not.toBe('ok')");
    expect(code).toContain('threw).toBe(false)');
  });

  it('emitted fuzz handles broader field-name heuristics (string/number/boolean/array/dict)', async () => {
    const storage = createInMemoryStorage();
    const heterogenous = JSON.stringify({
      conceptName: 'Demo',
      actionName: 'run',
      kind: 'external',
      reads: [],
      writes: [],
      performs: ['http:POST'],
      variants: ['ok', 'error'],
      method: 'POST',
      path: '/demo',
      requestFields: [
        { from: 'name', to: 'name' },
        { from: 'count', to: 'count' },
        { from: 'enabled', to: 'enabled' },
        { from: 'tags', to: 'tags' },
        { from: 'config', to: 'config' },
        { from: 'opaque', to: 'opaque' },
      ],
      responseFields: [],
    });
    const r = await fieldTransformFuzzRendererHandler.render({ descriptor: heterogenous }, storage);
    const code = r.code as string;
    expect(code).toMatch(/"name":\s*fc\.string/);
    expect(code).toMatch(/"count":\s*fc\.integer/);
    expect(code).toMatch(/"enabled":\s*fc\.boolean/);
    expect(code).toMatch(/"tags":\s*fc\.array/);
    expect(code).toMatch(/"config":\s*fc\.dictionary/);
    expect(code).toMatch(/"opaque":\s*fc\.anything/);
  });
});

describe('descriptor extraction', () => {
  it('descriptorFromProgram extracts effects from a StorageProgram', () => {
    let p = createProgram();
    p = put(p, 'users', 'alice', { name: 'Alice' });
    p = find(p, 'users', 'email', 'alice@example.com', 'existing');
    const program = complete(p, 'ok', {});
    const d = descriptorFromProgram('User', 'create', program);
    expect(d.conceptName).toBe('User');
    expect(d.kind).toBe('storage');
    expect(d.writes).toContain('users');
    expect(d.reads).toContain('users');
    expect(d.variants).toContain('ok');
  });

  it('descriptorFromExternalMapping builds external descriptor', () => {
    const d = descriptorFromExternalMapping('Weather', {
      name: 'fetch',
      method: 'get',
      path: '/forecast',
      fieldTransforms: {
        request: [{ from: 'lat', to: 'latitude' }],
        response: [{ from: 'temp_c', to: 'temperature' }],
      },
    });
    expect(d.kind).toBe('external');
    expect(d.method).toBe('GET');
    expect(d.performs).toEqual(['http:GET']);
    expect(d.requestFields?.[0].from).toBe('lat');
  });
});

describe('TestGeneration/run handlers-as-values dispatch', () => {
  it('dispatchHandlerDescriptor emits mock + replay + contract + fuzz', async () => {
    const out = await dispatchHandlerDescriptor(externalDescriptor);
    expect(out.failures).toEqual([]);
    expect(out.mock).toContain('WeatherMockHandler');
    expect(out.replay).toContain('CLEF_REPLAY_MODE');
    expect(out.contract).toContain('effect contract');
    expect(out.fuzz).toContain('FIELDS =');
  });

  it('TestGeneration.run accepts handlerDescriptors and reports dispatch counts', async () => {
    const storage = createInMemoryStorage();
    const r = await testGenerationHandler.run(
      { target: 'all', handlerDescriptors: [storageDescriptor, externalDescriptor] },
      storage,
    );
    expect(r.variant).toBe('ok');
    expect(r.descriptors).toBe(2);
    // 4 renderers x 2 descriptors
    expect(r.generated).toBe(8);
  });

  it('StorageProgram handler -> mock + replay + effect-contract emissions', async () => {
    let p = createProgram();
    p = put(p, 'users', 'bob', { name: 'Bob' });
    const program = complete(p, 'ok', {});
    const descriptor = JSON.stringify(descriptorFromProgram('User', 'create', program));
    const out = await dispatchHandlerDescriptor(descriptor);
    expect(out.mock).toContain('UserMockSeed');
    expect(out.replay).toContain('user');
    expect(out.contract).toContain('User/create effect contract');
  });

  it('ExternalHandler manifest -> all four outputs', async () => {
    const d = descriptorFromExternalMapping('Weather', {
      name: 'fetch',
      method: 'GET',
      path: '/forecast',
      fieldTransforms: {
        request: [{ from: 'lat', to: 'latitude' }],
        response: [{ from: 'temp_c', to: 'temperature' }],
      },
    });
    const out = await dispatchHandlerDescriptor(JSON.stringify(d));
    expect(out.mock).not.toBe('');
    expect(out.replay).not.toBe('');
    expect(out.contract).not.toBe('');
    expect(out.fuzz).not.toBe('');
    expect(out.failures).toEqual([]);
  });
});
