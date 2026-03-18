// ============================================================
// Execution Layer — Conformance Tests
//
// Tests for all 14 new concepts in the three-tier execution
// architecture plus the two resilience concepts.
// ============================================================

import { describe, it, expect } from 'vitest';

// Tier 1: Dispatch Registries
import { externalCallHandler } from '../handlers/ts/execution/external-call.handler.js';
import { localProcessHandler } from '../handlers/ts/execution/local-process.handler.js';

// Tier 2: Protocol Providers
import { httpProviderHandler } from '../handlers/ts/execution/providers/http-provider.handler.js';
import { grpcProviderHandler } from '../handlers/ts/execution/providers/grpc-provider.handler.js';
import { graphqlProviderHandler } from '../handlers/ts/execution/providers/graphql-provider.handler.js';
import { webSocketProviderHandler } from '../handlers/ts/execution/providers/websocket-provider.handler.js';
import { wasmProviderHandler } from '../handlers/ts/execution/providers/wasm-provider.handler.js';
import { onnxProviderHandler } from '../handlers/ts/execution/providers/onnx-provider.handler.js';
import { shellProviderHandler } from '../handlers/ts/execution/providers/shell-provider.handler.js';

// Tier 3: Instance Providers
import { openAiEndpointHandler } from '../handlers/ts/execution/instances/openai-endpoint.handler.js';
import { voyageEndpointHandler } from '../handlers/ts/execution/instances/voyage-endpoint.handler.js';
import { localModelInstanceHandler } from '../handlers/ts/execution/instances/local-model-instance.handler.js';

// Resilience
import { circuitBreakerHandler } from '../handlers/ts/execution/circuit-breaker.handler.js';
import { rateLimiterHandler } from '../handlers/ts/execution/rate-limiter.handler.js';

// ============================================================
// Helper: extract variant from a program's pure instruction
// ============================================================
function getPureVariant(program: { instructions: Array<Record<string, unknown>> }): string {
  const pureInstr = program.instructions.find(i => i.tag === 'pure');
  return pureInstr ? (pureInstr.value as Record<string, unknown>).variant as string : '';
}

function getPureValue(program: { instructions: Array<Record<string, unknown>> }): Record<string, unknown> {
  const pureInstr = program.instructions.find(i => i.tag === 'pure');
  return pureInstr ? pureInstr.value as Record<string, unknown> : {};
}

function getPutInstruction(program: { instructions: Array<Record<string, unknown>> }, relation?: string) {
  return program.instructions.find(
    i => i.tag === 'put' && (!relation || i.relation === relation),
  );
}

function getPerformInstruction(program: { instructions: Array<Record<string, unknown>> }) {
  return program.instructions.find(i => i.tag === 'perform');
}

function getGetInstruction(program: { instructions: Array<Record<string, unknown>> }) {
  return program.instructions.find(i => i.tag === 'get');
}

// ============================================================
// Tier 1: ExternalCall
// ============================================================
describe('ExternalCall', () => {
  it('initialize returns a program with ok variant', () => {
    const p = externalCallHandler.initialize!({});
    expect(getPureVariant(p)).toBe('ok');
  });

  it('registerProtocol stores protocol-provider mapping', () => {
    const p = externalCallHandler.registerProtocol!({
      protocol: 'http',
      providerName: 'HttpProvider',
    });
    const putInstr = getPutInstruction(p, 'protocol-providers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).protocol).toBe('http');
    expect((putInstr!.value as Record<string, unknown>).providerName).toBe('HttpProvider');
  });

  it('dispatch creates a call record and returns protocol+endpoint info', () => {
    const p = externalCallHandler.dispatch!({
      protocol: 'http',
      operation: 'POST',
      endpoint: 'openai-api',
      payload: '{"model":"gpt-4"}',
      config: '{}',
    });
    const putInstr = getPutInstruction(p, 'calls');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).protocol).toBe('http');
    expect((putInstr!.value as Record<string, unknown>).status).toBe('dispatching');
    const pv = getPureValue(p);
    expect(pv.protocol).toBe('http');
    expect(pv.endpoint).toBe('openai-api');
  });

  it('listProtocols returns ok variant', () => {
    const p = externalCallHandler.listProtocols!({});
    expect(getPureVariant(p)).toBe('ok');
  });
});

// ============================================================
// Tier 1: LocalProcess
// ============================================================
describe('LocalProcess', () => {
  it('initialize returns a program with ok variant', () => {
    const p = localProcessHandler.initialize!({});
    expect(getPureVariant(p)).toBe('ok');
  });

  it('registerRuntime stores runtime-provider mapping', () => {
    const p = localProcessHandler.registerRuntime!({
      runtime: 'onnx',
      providerName: 'OnnxProvider',
    });
    const putInstr = getPutInstruction(p, 'runtime-providers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).runtime).toBe('onnx');
  });

  it('dispatch creates a process record with runtime info', () => {
    const p = localProcessHandler.dispatch!({
      runtime: 'onnx',
      operation: 'infer',
      moduleRef: 'codebert-base',
      input: '{"tokens":[]}',
      config: '{}',
    });
    const putInstr = getPutInstruction(p, 'processes');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).runtime).toBe('onnx');
    expect((putInstr!.value as Record<string, unknown>).status).toBe('running');
  });

  it('listRuntimes returns ok variant', () => {
    const p = localProcessHandler.listRuntimes!({});
    expect(getPureVariant(p)).toBe('ok');
  });
});

// ============================================================
// Tier 2: HttpProvider
// ============================================================
describe('HttpProvider', () => {
  it('register returns provider metadata', () => {
    const p = httpProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.variant).toBe('ok');
    expect(pv.name).toBe('http-provider');
    expect(pv.kind).toBe('protocol');
  });

  it('configure stores an HTTP instance', () => {
    const p = httpProviderHandler.configure!({
      name: 'test-api',
      baseUrl: 'https://api.example.com',
      headers: '{"Authorization":"Bearer tok"}',
      timeout: 5000,
    });
    const putInstr = getPutInstruction(p, 'instances');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).baseUrl).toBe('https://api.example.com');
    expect((putInstr!.value as Record<string, unknown>).status).toBe('ready');
  });

  it('execute declares http transport effect via perform', () => {
    const p = httpProviderHandler.execute!({
      instance: 'test-api',
      method: 'GET',
      path: '/health',
      body: '',
      headers: '{}',
    });
    expect(p.effects.performs.has('http:GET')).toBe(true);
    const perf = getPerformInstruction(p);
    expect(perf).toBeDefined();
    expect(perf!.protocol).toBe('http');
  });
});

// ============================================================
// Tier 2: GrpcProvider
// ============================================================
describe('GrpcProvider', () => {
  it('register returns provider metadata', () => {
    const p = grpcProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('grpc-provider');
    expect(pv.kind).toBe('protocol');
  });

  it('configure stores a gRPC channel', () => {
    const p = grpcProviderHandler.configure!({
      name: 'user-svc',
      target: 'localhost:50051',
      protoRef: 'user.proto',
    });
    const putInstr = getPutInstruction(p, 'channels');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).target).toBe('localhost:50051');
  });

  it('execute declares grpc transport effect via perform', () => {
    const p = grpcProviderHandler.execute!({
      channel: 'user-svc',
      service: 'UserService',
      method: 'GetUser',
      payload: '{}',
    });
    expect(p.effects.performs.has('grpc:invoke')).toBe(true);
  });
});

// ============================================================
// Tier 2: GraphqlProvider
// ============================================================
describe('GraphqlProvider', () => {
  it('register returns provider metadata', () => {
    const p = graphqlProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('graphql-provider');
  });

  it('execute declares graphql transport effect via perform', () => {
    const p = graphqlProviderHandler.execute!({
      endpoint: 'github',
      query: '{ viewer { login } }',
      variables: '{}',
      operationType: 'query',
    });
    expect(p.effects.performs.has('graphql:query')).toBe(true);
  });
});

// ============================================================
// Tier 2: WebSocketProvider
// ============================================================
describe('WebSocketProvider', () => {
  it('register returns provider metadata', () => {
    const p = webSocketProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('websocket-provider');
  });

  it('send declares ws transport effect via perform', () => {
    const p = webSocketProviderHandler.send!({
      connection: 'events',
      message: '{"type":"ping"}',
    });
    expect(p.effects.performs.has('ws:send')).toBe(true);
  });

  it('receive declares ws transport effect via perform', () => {
    const p = webSocketProviderHandler.receive!({
      connection: 'events',
    });
    expect(p.effects.performs.has('ws:receive')).toBe(true);
  });
});

// ============================================================
// Tier 2: WasmProvider
// ============================================================
describe('WasmProvider', () => {
  it('register returns provider metadata', () => {
    const p = wasmProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('wasm-provider');
    expect(pv.kind).toBe('runtime');
  });

  it('load declares wasm:load transport effect', () => {
    const p = wasmProviderHandler.load!({
      name: 'tokenizer',
      wasmPath: '/models/tokenizer.wasm',
      memoryLimit: 65536,
    });
    expect(p.effects.performs.has('wasm:load')).toBe(true);
  });

  it('execute declares wasm:call transport effect', () => {
    const p = wasmProviderHandler.execute!({
      module: 'tokenizer',
      function: 'tokenize',
      args: '["hello world"]',
    });
    expect(p.effects.performs.has('wasm:call')).toBe(true);
  });
});

// ============================================================
// Tier 2: OnnxProvider
// ============================================================
describe('OnnxProvider', () => {
  it('register returns provider metadata', () => {
    const p = onnxProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('onnx-provider');
    expect(pv.kind).toBe('runtime');
  });

  it('load declares onnx:load transport effect', () => {
    const p = onnxProviderHandler.load!({
      name: 'codebert',
      modelPath: '/models/codebert.onnx',
      device: 'cpu',
    });
    expect(p.effects.performs.has('onnx:load')).toBe(true);
  });

  it('infer declares onnx:infer transport effect', () => {
    const p = onnxProviderHandler.infer!({
      session: 'codebert',
      inputs: '[]',
      options: '{}',
    });
    expect(p.effects.performs.has('onnx:infer')).toBe(true);
  });
});

// ============================================================
// Tier 2: ShellProvider
// ============================================================
describe('ShellProvider', () => {
  it('register returns provider metadata', () => {
    const p = shellProviderHandler.register!({});
    const pv = getPureValue(p);
    expect(pv.name).toBe('shell-provider');
    expect(pv.kind).toBe('runtime');
  });

  it('execute declares shell:exec transport effect', () => {
    const p = shellProviderHandler.execute!({
      command: 'echo',
      args: 'hello',
      env: '{}',
      cwd: '/tmp',
      timeout: 5000,
    });
    expect(p.effects.performs.has('shell:exec')).toBe(true);
  });
});

// ============================================================
// Tier 3: OpenAiEndpoint
// ============================================================
describe('OpenAiEndpoint', () => {
  it('register stores endpoint config with model and dimensions', () => {
    const p = openAiEndpointHandler.register!({
      name: 'embeddings',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      baseUrl: 'https://api.openai.com/v1',
      dimensions: 1536,
    });
    const putInstr = getPutInstruction(p, 'endpoints');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).model).toBe('text-embedding-3-small');
    expect((putInstr!.value as Record<string, unknown>).dimensions).toBe(1536);
    expect(getPureVariant(p)).toBe('ok');
  });

  it('resolve reads endpoint by name', () => {
    const p = openAiEndpointHandler.resolve!({ name: 'embeddings' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getInstr!.relation).toBe('endpoints');
    expect(getInstr!.key).toBe('oai-embeddings');
  });
});

// ============================================================
// Tier 3: VoyageEndpoint
// ============================================================
describe('VoyageEndpoint', () => {
  it('register stores endpoint config with model and inputType', () => {
    const p = voyageEndpointHandler.register!({
      name: 'code-search',
      apiKey: 'vk-test',
      model: 'voyage-code-3',
      inputType: 'document',
    });
    const putInstr = getPutInstruction(p, 'endpoints');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).model).toBe('voyage-code-3');
    expect((putInstr!.value as Record<string, unknown>).inputType).toBe('document');
  });

  it('resolve reads endpoint by name', () => {
    const p = voyageEndpointHandler.resolve!({ name: 'code-search' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getInstr!.key).toBe('voyage-code-search');
  });
});

// ============================================================
// Tier 3: LocalModelInstance
// ============================================================
describe('LocalModelInstance', () => {
  it('register stores instance config with runtime and dimensions', () => {
    const p = localModelInstanceHandler.register!({
      name: 'codebert-base',
      runtime: 'onnx',
      modelPath: '/models/codebert.onnx',
      tokenizerPath: '/models/codebert-tokenizer.json',
      device: 'cpu',
      maxSequenceLength: 512,
      dimensions: 768,
    });
    const putInstr = getPutInstruction(p, 'instances');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).runtime).toBe('onnx');
    expect((putInstr!.value as Record<string, unknown>).dimensions).toBe(768);
    expect((putInstr!.value as Record<string, unknown>).device).toBe('cpu');
  });

  it('resolve reads instance by name', () => {
    const p = localModelInstanceHandler.resolve!({ name: 'codebert-base' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getInstr!.key).toBe('local-codebert-base');
  });
});

// ============================================================
// CircuitBreaker
// ============================================================
describe('CircuitBreaker', () => {
  it('configure creates a breaker in closed state', () => {
    const p = circuitBreakerHandler.configure!({
      endpoint: 'openai-api',
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeoutMs: 30000,
    });
    const putInstr = getPutInstruction(p, 'breakers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).status).toBe('closed');
    expect((putInstr!.value as Record<string, unknown>).failureCount).toBe(0);
    expect((putInstr!.value as Record<string, unknown>).failureThreshold).toBe(5);
  });

  it('check reads breaker state', () => {
    const p = circuitBreakerHandler.check!({ endpoint: 'openai-api' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getInstr!.key).toBe('cb-openai-api');
    expect(getPureVariant(p)).toBe('closed');
  });

  it('recordSuccess resets failure count', () => {
    const p = circuitBreakerHandler.recordSuccess!({ endpoint: 'openai-api' });
    const putInstr = getPutInstruction(p, 'breakers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).failureCount).toBe(0);
    expect((putInstr!.value as Record<string, unknown>).status).toBe('closed');
  });

  it('recordFailure increments failure count', () => {
    const p = circuitBreakerHandler.recordFailure!({ endpoint: 'openai-api' });
    const putInstr = getPutInstruction(p, 'breakers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).failureCount).toBe(1);
  });

  it('reset clears all counters', () => {
    const p = circuitBreakerHandler.reset!({ endpoint: 'openai-api' });
    const putInstr = getPutInstruction(p, 'breakers');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).failureCount).toBe(0);
    expect((putInstr!.value as Record<string, unknown>).successCount).toBe(0);
    expect((putInstr!.value as Record<string, unknown>).status).toBe('closed');
  });

  it('get reads breaker diagnostics', () => {
    const p = circuitBreakerHandler.get!({ endpoint: 'openai-api' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getPureVariant(p)).toBe('ok');
  });
});

// ============================================================
// RateLimiter
// ============================================================
describe('RateLimiter', () => {
  it('configure creates a limiter with full token bucket', () => {
    const p = rateLimiterHandler.configure!({
      endpoint: 'openai-api',
      maxTokens: 100,
      refillRate: 10,
      refillIntervalMs: 1000,
    });
    const putInstr = getPutInstruction(p, 'limiters');
    expect(putInstr).toBeDefined();
    expect((putInstr!.value as Record<string, unknown>).tokens).toBe(100);
    expect((putInstr!.value as Record<string, unknown>).maxTokens).toBe(100);
    expect((putInstr!.value as Record<string, unknown>).refillRate).toBe(10);
  });

  it('acquire reads limiter state before consuming tokens', () => {
    const p = rateLimiterHandler.acquire!({
      endpoint: 'openai-api',
      tokens: 1,
    });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getInstr!.key).toBe('rl-openai-api');
    expect(getPureVariant(p)).toBe('ok');
  });

  it('release returns tokens to the bucket', () => {
    const p = rateLimiterHandler.release!({
      endpoint: 'openai-api',
      tokens: 5,
    });
    const putInstr = getPutInstruction(p, 'limiters');
    expect(putInstr).toBeDefined();
    expect(getPureVariant(p)).toBe('ok');
  });

  it('get reads limiter diagnostics', () => {
    const p = rateLimiterHandler.get!({ endpoint: 'openai-api' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getPureVariant(p)).toBe('ok');
  });

  it('reset refills the bucket', () => {
    const p = rateLimiterHandler.reset!({ endpoint: 'openai-api' });
    const getInstr = getGetInstruction(p);
    expect(getInstr).toBeDefined();
    expect(getPureVariant(p)).toBe('ok');
  });
});
