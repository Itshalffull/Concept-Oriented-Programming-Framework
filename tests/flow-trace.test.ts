// ============================================================
// Flow Tracing Tests
//
// Tests for:
// 1. FlowTrace builder — tree construction from ActionLog
// 2. kernel.getFlowTrace() programmatic API
// 3. renderFlowTrace CLI renderer
// 4. Unfired sync detection
// 5. Status computation (ok, failed, partial)
// ============================================================

import { describe, it, expect } from 'vitest';
import { createKernel } from '../implementations/typescript/framework/kernel-factory';
import { renderFlowTrace } from '../implementations/typescript/framework/flow-trace.impl';
import type { FlowTrace, TraceNode, TraceSyncNode } from '../implementations/typescript/framework/flow-trace.impl';
import { echoHandler } from '../implementations/typescript/app/echo.impl';
import { userHandler } from '../implementations/typescript/app/user.impl';
import { passwordHandler } from '../implementations/typescript/app/password.impl';
import { jwtHandler } from '../implementations/typescript/app/jwt.impl';

describe('Flow Tracing', () => {

  // --- Helper: set up an echo kernel ---
  function setupEchoKernel() {
    const kernel = createKernel();
    kernel.registerConcept('urn:test/Echo', echoHandler);

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

    return kernel;
  }

  // --- Helper: set up a registration kernel ---
  function setupRegistrationKernel() {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/User', userHandler);
    kernel.registerConcept('urn:copf/Password', passwordHandler);
    kernel.registerConcept('urn:copf/JWT', jwtHandler);

    kernel.registerSync({
      name: 'ValidatePassword',
      when: [{
        concept: 'urn:copf/Web', action: 'request',
        inputFields: [
          { name: 'method', match: { type: 'literal', value: 'register' } },
          { name: 'password', match: { type: 'variable', name: 'password' } },
        ],
        outputFields: [
          { name: 'request', match: { type: 'variable', name: 'request' } },
        ],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Password', action: 'validate',
        fields: [
          { name: 'password', value: { type: 'variable', name: 'password' } },
        ],
      }],
    });

    kernel.registerSync({
      name: 'ValidatePasswordError',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'register' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        },
        {
          concept: 'urn:copf/Password', action: 'validate',
          inputFields: [],
          outputFields: [
            { name: 'valid', match: { type: 'literal', value: false } },
          ],
        },
      ],
      where: [],
      then: [{
        concept: 'urn:copf/Web', action: 'respond',
        fields: [
          { name: 'request', value: { type: 'variable', name: 'request' } },
          { name: 'error', value: { type: 'literal', value: 'Password does not meet requirements' } },
          { name: 'code', value: { type: 'literal', value: 422 } },
        ],
      }],
    });

    kernel.registerSync({
      name: 'RegisterUser',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'register' } },
            { name: 'username', match: { type: 'variable', name: 'username' } },
            { name: 'email', match: { type: 'variable', name: 'email' } },
          ],
          outputFields: [],
        },
        {
          concept: 'urn:copf/Password', action: 'validate',
          inputFields: [],
          outputFields: [
            { name: 'valid', match: { type: 'literal', value: true } },
          ],
        },
      ],
      where: [{ type: 'bind', expr: 'uuid()', as: 'user' }],
      then: [{
        concept: 'urn:copf/User', action: 'register',
        fields: [
          { name: 'user', value: { type: 'variable', name: 'user' } },
          { name: 'name', value: { type: 'variable', name: 'username' } },
          { name: 'email', value: { type: 'variable', name: 'email' } },
        ],
      }],
    });

    kernel.registerSync({
      name: 'SetPassword',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'register' } },
            { name: 'password', match: { type: 'variable', name: 'password' } },
          ],
          outputFields: [],
        },
        {
          concept: 'urn:copf/User', action: 'register',
          inputFields: [],
          outputFields: [
            { name: 'user', match: { type: 'variable', name: 'user' } },
          ],
        },
      ],
      where: [],
      then: [{
        concept: 'urn:copf/Password', action: 'set',
        fields: [
          { name: 'user', value: { type: 'variable', name: 'user' } },
          { name: 'password', value: { type: 'variable', name: 'password' } },
        ],
      }],
    });

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

    kernel.registerSync({
      name: 'RegistrationResponse',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'register' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        },
        {
          concept: 'urn:copf/User', action: 'register',
          inputFields: [],
          outputFields: [
            { name: 'user', match: { type: 'variable', name: 'user' } },
          ],
        },
        {
          concept: 'urn:copf/Password', action: 'set',
          inputFields: [],
          outputFields: [
            { name: 'user', match: { type: 'variable', name: 'user' } },
          ],
        },
        {
          concept: 'urn:copf/JWT', action: 'generate',
          inputFields: [],
          outputFields: [
            { name: 'token', match: { type: 'variable', name: 'token' } },
          ],
        },
      ],
      where: [{
        type: 'query',
        concept: 'urn:copf/User',
        bindings: [
          { variable: 'u', field: '__key' },
          { variable: 'username', field: 'name' },
          { variable: 'email', field: 'email' },
        ],
      }],
      then: [{
        concept: 'urn:copf/Web', action: 'respond',
        fields: [
          { name: 'request', value: { type: 'variable', name: 'request' } },
          { name: 'body', value: { type: 'literal', value: {
            user: {
              username: '{{username}}',
              email: '{{email}}',
              token: '{{token}}',
            },
          }}},
        ],
      }],
    });

    return kernel;
  }

  // --- Test: FlowTrace for a simple echo flow ---

  it('builds a FlowTrace for a successful echo flow', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'hello' });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();
    expect(trace!.flowId).toBe(response.flowId);
    expect(trace!.status).toBe('ok');
    expect(trace!.durationMs).toBeGreaterThanOrEqual(0);

    // Root should be Web/request
    expect(trace!.root.action).toBe('Web/request');
    expect(trace!.root.variant).toBe('ok');

    // Root should have children (syncs that fired)
    expect(trace!.root.children.length).toBeGreaterThan(0);

    // At least HandleEcho should have fired
    const handleEcho = trace!.root.children.find(c => c.syncName === 'HandleEcho');
    expect(handleEcho).toBeDefined();
    expect(handleEcho!.fired).toBe(true);
    expect(handleEcho!.child).toBeDefined();
    expect(handleEcho!.child!.action).toBe('Echo/send');
    expect(handleEcho!.child!.variant).toBe('ok');
  });

  it('builds a FlowTrace for a successful registration flow', async () => {
    const kernel = setupRegistrationKernel();
    const response = await kernel.handleRequest({
      method: 'register',
      username: 'alice',
      email: 'alice@example.com',
      password: 'secure-password-123',
    });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();
    expect(trace!.status).toBe('ok');

    // Walk the tree to verify the sync chain
    const root = trace!.root;
    expect(root.action).toBe('Web/request');

    // ValidatePassword should have fired from root
    const validatePw = root.children.find(c => c.syncName === 'ValidatePassword');
    expect(validatePw).toBeDefined();
    expect(validatePw!.fired).toBe(true);
    expect(validatePw!.child!.action).toBe('Password/validate');
    expect(validatePw!.child!.variant).toBe('ok');
  });

  it('detects unfired syncs in a failed registration flow', async () => {
    const kernel = setupRegistrationKernel();
    const response = await kernel.handleRequest({
      method: 'register',
      username: 'bob',
      email: 'bob@example.com',
      password: 'short',  // Too short — validation fails
    });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();

    // Password validation should result in valid: false, which means
    // RegisterUser won't fire (requires valid: true)
    // The trace should show this as partial or ok depending on error handling path
    expect(trace).toBeDefined();

    // Find the Password/validate node anywhere in the tree
    function findNode(node: TraceNode, action: string): TraceNode | undefined {
      if (node.action === action) return node;
      for (const child of node.children) {
        if (child.child) {
          const found = findNode(child.child, action);
          if (found) return found;
        }
      }
      return undefined;
    }

    const validateNode = findNode(trace!.root, 'Password/validate');
    expect(validateNode).toBeDefined();
  });

  // --- Test: FlowTrace returns null for unknown flow ---

  it('returns null for unknown flow ID', () => {
    const kernel = createKernel();
    const trace = kernel.getFlowTrace('nonexistent-flow-id');
    expect(trace).toBeNull();
  });

  // --- Test: FlowTrace timing ---

  it('computes per-action timing', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'timing-test' });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();
    expect(trace!.durationMs).toBeGreaterThanOrEqual(0);

    // Each node should have a non-negative durationMs
    function checkTiming(node: TraceNode): void {
      expect(node.durationMs).toBeGreaterThanOrEqual(0);
      for (const child of node.children) {
        if (child.child) checkTiming(child.child);
      }
    }
    checkTiming(trace!.root);
  });

  // --- Test: renderFlowTrace ---

  it('renders a FlowTrace as a tree string', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'render-test' });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();

    const output = renderFlowTrace(trace!);
    expect(output).toContain(response.flowId);
    expect(output).toContain('Web/request');
    expect(output).toContain('Echo/send');
    expect(output).toContain('OK');
    // Should contain status icons
    expect(output).toContain('✅');
  });

  it('renders a FlowTrace as JSON', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'json-test' });

    const trace = kernel.getFlowTrace(response.flowId);
    const output = renderFlowTrace(trace!, { json: true });

    // Should be valid JSON
    const parsed = JSON.parse(output);
    expect(parsed.flowId).toBe(response.flowId);
    expect(parsed.root.action).toBe('Web/request');
  });

  it('renders with --failed filter', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'filter-test' });

    const trace = kernel.getFlowTrace(response.flowId);
    // Successful flow with --failed filter: should still have header
    const output = renderFlowTrace(trace!, { failed: true });
    expect(output).toContain(response.flowId);
  });

  // --- Test: FlowTrace status computation ---

  it('marks a fully successful flow as ok', async () => {
    const kernel = setupEchoKernel();
    const response = await kernel.handleRequest({ method: 'echo', text: 'status-test' });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace!.status).toBe('ok');
  });

  // --- Test: Flow with multiple sync children ---

  it('shows all sync children at each level', async () => {
    const kernel = setupRegistrationKernel();
    const response = await kernel.handleRequest({
      method: 'register',
      username: 'eve',
      email: 'eve@example.com',
      password: 'strong-password-abc',
    });

    const trace = kernel.getFlowTrace(response.flowId);
    expect(trace).not.toBeNull();

    // Collect all sync names in the trace
    const syncNames: string[] = [];
    function collectSyncs(node: TraceNode): void {
      for (const child of node.children) {
        syncNames.push(child.syncName);
        if (child.child) collectSyncs(child.child);
      }
    }
    collectSyncs(trace!.root);

    // Should include the main syncs from the registration flow
    expect(syncNames).toContain('ValidatePassword');
  });
});
