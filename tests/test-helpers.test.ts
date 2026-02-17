// ============================================================
// Test Helpers Tests
//
// Tests for createMockHandler:
// 1. Generates default ok responses from concept AST
// 2. Uses deterministic test values
// 3. Merges caller-provided overrides
// 4. Works with the kernel for sync testing
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createKernel,
  createMockHandler,
  parseConceptFile,
} from '@copf/kernel';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SPECS_DIR = resolve(__dirname, '../specs/app');

describe('createMockHandler', () => {

  it('generates a handler from Echo concept AST', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'echo.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast);

    // Handler should have a 'send' action
    expect(handler.send).toBeDefined();
    expect(typeof handler.send).toBe('function');
  });

  it('returns the first (ok) variant by default', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'echo.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast);
    const result = await handler.send(
      { id: 'msg-1', text: 'hello' },
      null as any, // storage not needed for mock
    );

    expect(result.variant).toBe('ok');
    // Should echo back input fields that match output params
    expect(result.id).toBe('msg-1');
  });

  it('produces deterministic test values for output fields', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast);
    const result = await handler.generate(
      { user: 'u-123' },
      null as any,
    );

    expect(result.variant).toBe('ok');
    // Token is a String type param — should get a deterministic test value
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
  });

  it('echoes back input fields that match output param names', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'user.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast);
    const result = await handler.register(
      { user: 'u-abc', name: 'alice', email: 'alice@test.com' },
      null as any,
    );

    expect(result.variant).toBe('ok');
    // 'user' param matches input — should echo back
    expect(result.user).toBe('u-abc');
  });

  it('allows overriding specific actions', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast, {
      verify: async (input) => ({
        variant: 'error',
        message: 'token expired',
      }),
    });

    // generate should still return default ok
    const genResult = await handler.generate(
      { user: 'u-123' },
      null as any,
    );
    expect(genResult.variant).toBe('ok');

    // verify should use the override
    const verifyResult = await handler.verify(
      { token: 'some-token' },
      null as any,
    );
    expect(verifyResult.variant).toBe('error');
    expect(verifyResult.message).toBe('token expired');
  });

  it('works with the kernel for sync testing', async () => {
    const echoSource = readFileSync(resolve(SPECS_DIR, 'echo.concept'), 'utf-8');
    const echoAst = parseConceptFile(echoSource);

    // Use mock handler instead of real implementation
    const mockEcho = createMockHandler(echoAst);

    const kernel = createKernel();
    kernel.registerConcept('urn:test/Echo', mockEcho);

    kernel.registerSync({
      name: 'HandleEcho',
      when: [{
        concept: 'urn:copf/Web', action: 'request',
        inputFields: [
          { name: 'method', match: { type: 'literal', value: 'echo' } },
          { name: 'text', match: { type: 'variable', name: 'text' } },
        ],
        outputFields: [
          { name: 'request', match: { type: 'variable', name: 'request' } },
        ],
      }],
      where: [{ type: 'bind', expr: 'uuid()', as: 'id' }],
      then: [{
        concept: 'urn:test/Echo', action: 'send',
        fields: [
          { name: 'id', value: { type: 'variable', name: 'id' } },
          { name: 'text', value: { type: 'variable', name: 'text' } },
        ],
      }],
    });

    kernel.registerSync({
      name: 'EchoResponse',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'echo' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        },
        {
          concept: 'urn:test/Echo', action: 'send',
          inputFields: [],
          outputFields: [
            { name: 'echo', match: { type: 'variable', name: 'echo' } },
          ],
        },
      ],
      where: [],
      then: [{
        concept: 'urn:copf/Web', action: 'respond',
        fields: [
          { name: 'request', value: { type: 'variable', name: 'request' } },
          { name: 'body', value: { type: 'variable', name: 'echo' } },
        ],
      }],
    });

    // Process a flow using mock handler
    const response = await kernel.handleRequest({
      method: 'echo',
      text: 'mock-test',
    });

    // Flow should complete successfully
    expect(response.body).toBeDefined();
    expect(response.flowId).toBeDefined();

    // Flow trace should work with mock handlers
    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();
    expect(trace!.status).toBe('ok');
  });

  it('generates handlers for all actions in a multi-action concept', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast);

    // JWT has two actions: generate and verify
    expect(handler.generate).toBeDefined();
    expect(handler.verify).toBeDefined();

    // Both should return ok by default
    const genResult = await handler.generate({ user: 'u-1' }, null as any);
    expect(genResult.variant).toBe('ok');

    const verifyResult = await handler.verify({ token: 'tok-1' }, null as any);
    expect(verifyResult.variant).toBe('ok');
  });

  // --- Retrofit test: testing the GenerateToken sync in isolation ---
  // This demonstrates the DX improvement from Section 16.4.
  // Instead of importing real User and JWT implementations,
  // we use createMockHandler to generate stubs from concept ASTs.
  it('tests GenerateToken sync in isolation using mock handlers', async () => {
    const userSource = readFileSync(resolve(SPECS_DIR, 'user.concept'), 'utf-8');
    const jwtSource = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const userAst = parseConceptFile(userSource);
    const jwtAst = parseConceptFile(jwtSource);

    // Mock concepts — only override what matters for this sync
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/User', createMockHandler(userAst));
    kernel.registerConcept('urn:copf/JWT', createMockHandler(jwtAst));

    // Load only the sync under test
    kernel.registerSync({
      name: 'GenerateToken',
      when: [{
        concept: 'urn:copf/User', action: 'register',
        inputFields: [],
        outputFields: [
          { name: 'user', match: { type: 'variable', name: 'user' } },
        ],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/JWT', action: 'generate',
        fields: [
          { name: 'user', value: { type: 'variable', name: 'user' } },
        ],
      }],
    });

    // Directly invoke User/register to produce a completion
    const registerResult = await kernel.invokeConcept(
      'urn:copf/User', 'register',
      { user: 'u-test-001', name: 'test', email: 'test@test.com' },
    );

    // Mock handler returns ok by default
    expect(registerResult.variant).toBe('ok');
    expect(registerResult.user).toBe('u-test-001');
  });

  it('overrides only specified actions, keeps defaults for others', async () => {
    const source = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    const handler = createMockHandler(ast, {
      generate: async () => ({
        variant: 'ok',
        token: 'custom-token-xyz',
      }),
    });

    // generate uses override
    const genResult = await handler.generate({ user: 'u-1' }, null as any);
    expect(genResult.token).toBe('custom-token-xyz');

    // verify uses default (still ok variant)
    const verifyResult = await handler.verify({ token: 'tok-1' }, null as any);
    expect(verifyResult.variant).toBe('ok');
  });
});
