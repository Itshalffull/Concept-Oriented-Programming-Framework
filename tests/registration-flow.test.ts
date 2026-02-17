// ============================================================
// Registration Flow Tests — Multi-Concept
// Validates: multiple concepts, sync chaining, error handling,
// where-clause queries, provenance graph.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createKernel } from '../implementations/typescript/framework/kernel-factory';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl';
import { userHandler } from '../implementations/typescript/app/user.impl';
import { passwordHandler } from '../implementations/typescript/app/password.impl';
import { jwtHandler } from '../implementations/typescript/app/jwt.impl';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SPECS_DIR = resolve(__dirname, '../specs/app');
const SYNCS_DIR = resolve(__dirname, '../syncs/app');

describe('Registration Flow', () => {

  it('parses all concept specs correctly', () => {
    for (const file of ['user.concept', 'password.concept', 'jwt.concept']) {
      const source = readFileSync(resolve(SPECS_DIR, file), 'utf-8');
      const ast = parseConceptFile(source);
      expect(ast.name).toBeDefined();
      expect(ast.typeParams.length).toBeGreaterThan(0);
      expect(ast.actions.length).toBeGreaterThan(0);
    }
  });

  function setupRegistrationKernel() {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/User', userHandler);
    kernel.registerConcept('urn:copf/Password', passwordHandler);
    kernel.registerConcept('urn:copf/JWT', jwtHandler);

    // Register syncs inline for precise control over matching
    // ValidatePassword
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

    // ValidatePasswordError
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

    // RegisterUser
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

    // SetPassword
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

    // GenerateToken
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

    // RegistrationResponse
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

    // RegistrationError
    kernel.registerSync({
      name: 'RegistrationError',
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
            { name: 'message', match: { type: 'variable', name: 'error' } },
          ],
        },
      ],
      where: [],
      then: [{
        concept: 'urn:copf/Web', action: 'respond',
        fields: [
          { name: 'request', value: { type: 'variable', name: 'request' } },
          { name: 'error', value: { type: 'variable', name: 'error' } },
          { name: 'code', value: { type: 'literal', value: 422 } },
        ],
      }],
    });

    return kernel;
  }

  it('registers a new user with valid credentials', async () => {
    const kernel = setupRegistrationKernel();

    const response = await kernel.handleRequest({
      method: 'register',
      username: 'alice',
      email: 'alice@example.com',
      password: 'secure-password-123',
    });

    // Should succeed with user data + token
    expect(response.code).toBeUndefined();
    expect(response.body).toBeDefined();
    expect(response.body!.user).toBeDefined();

    const user = response.body!.user as Record<string, unknown>;
    expect(user.username).toBe('alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.token).toBeDefined();
    expect(typeof user.token).toBe('string');

    // The JWT should be verifiable
    const verifyResult = await kernel.invokeConcept(
      'urn:copf/JWT', 'verify',
      { token: user.token },
    );
    expect(verifyResult.variant).toBe('ok');
  });

  it('rejects registration with a weak password', async () => {
    const kernel = setupRegistrationKernel();

    const response = await kernel.handleRequest({
      method: 'register',
      username: 'bob',
      email: 'bob@example.com',
      password: 'short',
    });

    // Should fail with 422
    expect(response.code).toBe(422);
    expect(response.error).toBeDefined();

    // User should NOT have been created
    const userQuery = await kernel.queryConcept(
      'urn:copf/User', 'user', { name: 'bob' },
    );
    expect(userQuery).toHaveLength(0);
  });

  it('rejects registration with a duplicate username', async () => {
    const kernel = setupRegistrationKernel();

    // First registration succeeds
    const first = await kernel.handleRequest({
      method: 'register',
      username: 'charlie',
      email: 'charlie@example.com',
      password: 'strong-password-456',
    });
    expect(first.code).toBeUndefined();

    // Second registration with same username fails
    const second = await kernel.handleRequest({
      method: 'register',
      username: 'charlie',
      email: 'charlie2@example.com',
      password: 'strong-password-789',
    });
    expect(second.code).toBe(422);
    expect(second.error).toContain('already taken');
  });

  it('produces a complete provenance graph for a successful registration', async () => {
    const kernel = setupRegistrationKernel();

    const response = await kernel.handleRequest({
      method: 'register',
      username: 'diana',
      email: 'diana@example.com',
      password: 'strong-password-000',
    });

    // Get the full flow
    const flow = kernel.getFlowLog(response.flowId);

    // Should contain all expected actions (invocations + completions)
    const completions = flow.filter(r => r.type === 'completion');
    const actionNames = completions.map(r => `${r.concept}/${r.action}:${r.variant}`);

    expect(actionNames).toContain('urn:copf/Web/request:ok');
    expect(actionNames).toContain('urn:copf/Password/validate:ok');
    expect(actionNames).toContain('urn:copf/User/register:ok');
    expect(actionNames).toContain('urn:copf/Password/set:ok');
    expect(actionNames).toContain('urn:copf/JWT/generate:ok');
    expect(actionNames).toContain('urn:copf/Web/respond:ok');

    // Every invocation with a sync should have parent defined
    const invocations = flow.filter(r => r.type === 'invocation' && r.sync);
    for (const inv of invocations) {
      expect(inv.sync).toBeDefined();
      expect(inv.parent).toBeDefined();
    }
  });
});
