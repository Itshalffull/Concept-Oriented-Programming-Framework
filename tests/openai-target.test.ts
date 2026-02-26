// ============================================================
// OpenAI Function-Calling Target Provider Tests
//
// Validates that the OpenAI target generates correct function
// definitions from concept projections, with strict mode,
// description generation, and hierarchical support.
// See Architecture doc Section 2.7.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { openaiTargetHandler } from '../handlers/ts/framework/providers/openai-target.handler.js';
import type { ConceptManifest, ConceptStorage } from '../runtime/types.js';

// --- Test Helpers ---

function makeProjection(manifest: Partial<ConceptManifest>, conceptName: string): string {
  return JSON.stringify({
    conceptName,
    conceptManifest: JSON.stringify({
      name: conceptName,
      uri: `urn:clef/${conceptName}`,
      purpose: manifest.purpose || `Manage ${conceptName}`,
      actions: manifest.actions || [],
      stateFields: [],
      typeParams: [],
      invariants: [],
      jsonSchemas: {},
      graphqlSchema: '',
      ...manifest,
    }),
  });
}

function parseGeneratedFunctions(files: Array<{ path: string; content: string }>): any[] {
  const functionsFile = files.find(f => f.path.endsWith('.functions.ts'));
  if (!functionsFile) return [];

  // Extract the JSON array from the generated TypeScript
  const match = functionsFile.content.match(/= (\[[\s\S]*?\]) as const;/);
  if (!match) return [];

  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

// --- Tests ---

describe('OpenAI Target Provider', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should register with correct metadata', async () => {
    const result = await openaiTargetHandler.register();
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('OpenaiTarget');
    expect(result.targetKey).toBe('openai');
    expect(result.inputKind).toBe('InterfaceProjection');
    expect(result.outputKind).toBe('OpenAiFunctions');
  });

  it('should generate function definitions for a simple concept', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'register',
          params: [
            { name: 'email', type: { kind: 'primitive', primitive: 'String' } },
            { name: 'name', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'User registered successfully.' },
            { name: 'alreadyExists', fields: [], prose: 'Email already in use.' },
          ],
        },
        {
          name: 'login',
          params: [
            { name: 'email', type: { kind: 'primitive', primitive: 'String' } },
            { name: 'password', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'Login successful.' },
          ],
        },
      ],
    }, 'User');

    const result = await openaiTargetHandler.generate(
      { projection, config: '{"strict": true}' },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBeGreaterThanOrEqual(1);

    const functionsFile = files.find(f => f.path.endsWith('.functions.ts'));
    expect(functionsFile).toBeDefined();
    expect(functionsFile!.path).toBe('user/user.functions.ts');

    // Verify the generated content structure
    expect(functionsFile!.content).toContain('userFunctions');
    expect(functionsFile!.content).toContain('UserFunctionName');
  });

  it('should generate strict mode function definitions by default', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'create',
          params: [
            { name: 'title', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'Created.' },
          ],
        },
      ],
    }, 'Article');

    const result = await openaiTargetHandler.generate(
      { projection },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    expect(functions.length).toBe(1);
    expect(functions[0].type).toBe('function');
    expect(functions[0].function.name).toBe('article_create');
    expect(functions[0].function.strict).toBe(true);
    expect(functions[0].function.parameters.additionalProperties).toBe(false);
    expect(functions[0].function.parameters.required).toContain('title');
  });

  it('should respect strict: false config', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'search',
          params: [
            { name: 'query', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'Results found.' },
          ],
        },
      ],
    }, 'Search');

    const result = await openaiTargetHandler.generate(
      { projection, config: '{"strict": false}' },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    expect(functions.length).toBe(1);
    expect(functions[0].function.strict).toBeUndefined();
    expect(functions[0].function.parameters.additionalProperties).toBeUndefined();
  });

  it('should map parameter types to JSON Schema correctly', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'complexAction',
          params: [
            { name: 'name', type: { kind: 'primitive', primitive: 'String' } },
            { name: 'count', type: { kind: 'primitive', primitive: 'Int' } },
            { name: 'score', type: { kind: 'primitive', primitive: 'Float' } },
            { name: 'active', type: { kind: 'primitive', primitive: 'Bool' } },
            { name: 'tags', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'Done.' },
          ],
        },
      ],
    }, 'Complex');

    const result = await openaiTargetHandler.generate(
      { projection, config: '{"strict": true}' },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    const params = functions[0].function.parameters;
    expect(params.properties.name.type).toBe('string');
    expect(params.properties.count.type).toBe('integer');
    expect(params.properties.score.type).toBe('number');
    expect(params.properties.active.type).toBe('boolean');
    expect(params.properties.tags.type).toBe('array');
    expect(params.properties.tags.items.type).toBe('string');
  });

  it('should use action variant prose as function description', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'analyze',
          params: [
            { name: 'target', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [
            { name: 'ok', fields: [], prose: 'Analyze dependencies and return the full graph.' },
          ],
        },
      ],
    }, 'Analysis');

    const result = await openaiTargetHandler.generate(
      { projection },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    expect(functions[0].function.description).toContain('Analyze dependencies');
  });

  it('should return empty files for invalid projection', async () => {
    const result = await openaiTargetHandler.generate(
      { projection: 'not-json' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.files).toEqual([]);
  });

  it('should return empty files for missing projection', async () => {
    const result = await openaiTargetHandler.generate(
      { projection: '' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.files).toEqual([]);
  });

  it('should generate multiple functions for multi-action concepts', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'listConcepts',
          params: [],
          variants: [{ name: 'ok', fields: [], prose: 'List all concepts.' }],
        },
        {
          name: 'getConcept',
          params: [{ name: 'name', type: { kind: 'primitive', primitive: 'String' } }],
          variants: [{ name: 'ok', fields: [], prose: 'Get concept details.' }],
        },
        {
          name: 'search',
          params: [
            { name: 'query', type: { kind: 'primitive', primitive: 'String' } },
            { name: 'limit', type: { kind: 'primitive', primitive: 'Int' } },
          ],
          variants: [{ name: 'ok', fields: [], prose: 'Search the project.' }],
        },
      ],
    }, 'ScoreApi');

    const result = await openaiTargetHandler.generate(
      { projection, config: '{"strict": true}' },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    expect(functions.length).toBe(3);
    const names = functions.map((f: any) => f.function.name);
    expect(names).toContain('score_api_list_concepts');
    expect(names).toContain('score_api_get_concept');
    expect(names).toContain('score_api_search');
  });

  it('should add parameter descriptions for LLM comprehension', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'findSymbol',
          params: [
            { name: 'name', type: { kind: 'primitive', primitive: 'String' } },
          ],
          variants: [{ name: 'ok', fields: [], prose: 'Find symbols.' }],
        },
      ],
    }, 'Score');

    const result = await openaiTargetHandler.generate(
      { projection },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functions = parseGeneratedFunctions(files);

    // Each parameter should have a description
    expect(functions[0].function.parameters.properties.name.description).toBeTruthy();
  });

  it('should generate TypeScript type export', async () => {
    const projection = makeProjection({
      actions: [
        {
          name: 'status',
          params: [],
          variants: [{ name: 'ok', fields: [], prose: 'Get status.' }],
        },
      ],
    }, 'Index');

    const result = await openaiTargetHandler.generate(
      { projection },
      storage,
    );

    const files = result.files as Array<{ path: string; content: string }>;
    const functionsFile = files.find(f => f.path.endsWith('.functions.ts'));

    expect(functionsFile!.content).toContain('export type IndexFunctionName');
    expect(functionsFile!.content).toContain("typeof indexFunctions[number]['function']['name']");
  });
});
