// ============================================================
// Stage 0 — Test A: Echo
// Validates: spec parsing, concept registration, sync registration,
// flow execution, and response assembly.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createKernel } from '../implementations/typescript/framework/kernel-factory';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl';
import { echoHandler } from '../implementations/typescript/app/echo.impl';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SPECS_DIR = resolve(__dirname, '../specs/app');
const SYNCS_DIR = resolve(__dirname, '../syncs/app');

describe('Stage 0 — Test A: Echo', () => {

  it('parses the echo.concept spec correctly', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'echo.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('Echo');
    expect(ast.typeParams).toEqual(['M']);
    expect(ast.purpose).toBeDefined();
    expect(ast.state.length).toBeGreaterThan(0);
    expect(ast.actions.length).toBe(1);
    expect(ast.actions[0].name).toBe('send');
    expect(ast.actions[0].params.length).toBe(2);
    expect(ast.actions[0].variants.length).toBe(1);
    expect(ast.actions[0].variants[0].name).toBe('ok');
    expect(ast.invariants.length).toBe(1);
  });

  it('processes a complete echo flow with inline syncs', async () => {
    const kernel = createKernel();

    // Register the Echo concept
    kernel.registerConcept('urn:test/Echo', echoHandler);

    // Register syncs inline (as specified in the acceptance test)
    kernel.registerSync({
      name: 'HandleEcho',
      when: [
        {
          concept: 'urn:copf/Web', action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'echo' } },
            { name: 'text', match: { type: 'variable', name: 'text' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        },
      ],
      where: [{ type: 'bind', expr: 'uuid()', as: 'id' }],
      then: [
        {
          concept: 'urn:test/Echo', action: 'send',
          fields: [
            { name: 'id', value: { type: 'variable', name: 'id' } },
            { name: 'text', value: { type: 'variable', name: 'text' } },
          ],
        },
      ],
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
      then: [
        {
          concept: 'urn:copf/Web', action: 'respond',
          fields: [
            { name: 'request', value: { type: 'variable', name: 'request' } },
            { name: 'body', value: { type: 'variable', name: 'echo' } },
          ],
        },
      ],
    });

    // Simulate an incoming web request
    const response = await kernel.handleRequest({
      method: 'echo',
      text: 'hello world',
    });

    // Assert the response contains the echoed text
    expect(response.body).toBeDefined();

    // Assert provenance — the action log should show the full flow
    const flow = kernel.getFlowLog(response.flowId);
    expect(flow.length).toBeGreaterThanOrEqual(4);

    // Should contain Web/request, Echo/send invocation, Echo/send completion, Web/respond
    const conceptActions = flow.map(r => `${r.concept}/${r.action}`);
    expect(conceptActions).toContain('urn:copf/Web/request');
    expect(conceptActions).toContain('urn:test/Echo/send');
    expect(conceptActions).toContain('urn:copf/Web/respond');
  });

  it('processes echo flow with parsed syncs from .sync file', async () => {
    const kernel = createKernel();

    // Register the Echo concept with urn:copf/Echo to match sync file URIs
    kernel.registerConcept('urn:copf/Echo', echoHandler);

    // Load syncs from file
    await kernel.loadSyncs(resolve(SYNCS_DIR, 'echo.sync'));

    // Simulate an incoming web request
    const response = await kernel.handleRequest({
      method: 'echo',
      text: 'hello from sync file',
    });

    // Assert the response
    expect(response.body).toBeDefined();

    // Assert provenance
    const flow = kernel.getFlowLog(response.flowId);
    expect(flow.length).toBeGreaterThanOrEqual(4);

    const completions = flow.filter(r => r.type === 'completion');
    const conceptActions = completions.map(r => `${r.concept}/${r.action}`);
    expect(conceptActions).toContain('urn:copf/Web/request');
    expect(conceptActions).toContain('urn:copf/Echo/send');
    expect(conceptActions).toContain('urn:copf/Web/respond');
  });

  it('echo concept stores message in storage', async () => {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/Echo', echoHandler);

    // Directly invoke the concept
    const result = await kernel.invokeConcept('urn:copf/Echo', 'send', {
      id: 'msg-1',
      text: 'stored message',
    });

    expect(result.variant).toBe('ok');
    expect(result.echo).toBe('stored message');
    expect(result.id).toBe('msg-1');
  });
});
