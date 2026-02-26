// ============================================================
// CLI Generation Suite Integration Tests
//
// Validates that CliTarget generates correct CLI subcommands
// from generation suite concept actions. CLI surface for generation
// kit concepts is driven by the devtools interface manifest
// (concept-overrides), not hardcoded in the provider.
//
// See clef-generation-suite.md Part 6 (CLI Integration).
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { cliTargetHandler } from '../../../../implementations/typescript/framework/providers/cli-target.impl.js';
import type { ConceptManifest } from '@clef/kernel';

function makeProjection(manifest: ConceptManifest, name: string): string {
  return JSON.stringify({
    conceptName: name,
    conceptManifest: JSON.stringify(manifest),
  });
}

// Emitter manifest — matches the emitter.concept spec
const EMITTER_MANIFEST: ConceptManifest = {
  uri: 'urn:clef/Emitter',
  name: 'Emitter',
  typeParams: ['F'],
  relations: [],
  actions: [
    {
      name: 'write',
      description: 'Write a single generated file with content-addressed deduplication.',
      params: [
        { name: 'path', type: { kind: 'primitive', primitive: 'String' } },
        { name: 'content', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'written', type: { kind: 'primitive', primitive: 'Bool' }, optional: false }] },
        { tag: 'error', fields: [{ name: 'message', type: { kind: 'primitive', primitive: 'String' }, optional: false }] },
      ],
    },
    {
      name: 'writeBatch',
      description: 'Atomically write a batch of generated files.',
      params: [
        { name: 'files', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'results', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
    {
      name: 'audit',
      description: 'Check generated files for drift from expected output.',
      params: [
        { name: 'outputDir', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'status', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
    {
      name: 'clean',
      description: 'Remove orphaned generated files.',
      params: [
        { name: 'outputDir', type: { kind: 'primitive', primitive: 'String' } },
        { name: 'currentManifest', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'removed', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
    {
      name: 'trace',
      description: 'Show which sources produced an output file.',
      params: [
        { name: 'outputPath', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'sources', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
        { tag: 'notFound', fields: [{ name: 'path', type: { kind: 'primitive', primitive: 'String' }, optional: false }] },
      ],
    },
    {
      name: 'affected',
      description: 'Show what outputs are affected by a source file change.',
      params: [
        { name: 'sourcePath', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'outputs', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
  ],
  invariants: [],
  graphqlSchema: '',
  jsonSchemas: { invocations: {}, completions: {} },
  capabilities: [],
  purpose: 'Manage generated file output with content-addressed writes and source traceability.',
};

// KindSystem manifest — matches the kind-system.concept spec
const KIND_SYSTEM_MANIFEST: ConceptManifest = {
  uri: 'urn:clef/KindSystem',
  name: 'KindSystem',
  typeParams: ['K'],
  relations: [],
  actions: [
    {
      name: 'graph',
      description: 'Show the full kind taxonomy graph.',
      params: [],
      variants: [
        { tag: 'ok', fields: [{ name: 'kinds', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
    {
      name: 'route',
      description: 'Find shortest transform path between two kinds.',
      params: [
        { name: 'from', type: { kind: 'primitive', primitive: 'String' } },
        { name: 'to', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'path', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
        { tag: 'unreachable', fields: [{ name: 'message', type: { kind: 'primitive', primitive: 'String' }, optional: false }] },
      ],
    },
    {
      name: 'consumers',
      description: 'Show what transforms consume a given kind.',
      params: [
        { name: 'kind', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'transforms', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
    {
      name: 'producers',
      description: 'Show what transforms produce a given kind.',
      params: [
        { name: 'kind', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'transforms', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
      ],
    },
  ],
  invariants: [],
  graphqlSchema: '',
  jsonSchemas: { invocations: {}, completions: {} },
  capabilities: [],
  purpose: 'Model the pipeline topology as a directed acyclic graph of IR kinds.',
};

describe('CLI generation suite — manifest-driven commands', () => {
  it('generates CLI subcommands from Emitter concept actions', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(EMITTER_MANIFEST, 'Emitter'),
        overrides: '{}',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    expect(commandFile).toBeDefined();
    const content = commandFile!.content;

    // Each action in the concept spec becomes a CLI subcommand
    expect(content).toContain("command('write')");
    expect(content).toContain("command('write-batch')");
    expect(content).toContain("command('audit')");
    expect(content).toContain("command('clean')");
    expect(content).toContain("command('trace')");
    expect(content).toContain("command('affected')");
  });

  it('generates CLI subcommands from KindSystem concept actions', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(KIND_SYSTEM_MANIFEST, 'KindSystem'),
        overrides: '{}',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    expect(commandFile).toBeDefined();
    const content = commandFile!.content;

    expect(content).toContain("command('graph')");
    expect(content).toContain("command('route')");
    expect(content).toContain("command('consumers')");
    expect(content).toContain("command('producers')");
  });

  it('applies CLI overrides from manifest YAML (positional args, custom commands)', async () => {
    const storage = createInMemoryStorage();

    // Simulate what the devtools manifest provides
    const manifestYaml = {
      concepts: {
        Emitter: {
          cli: {
            'command-group': 'emitter',
            actions: {
              trace: {
                description: 'Show which sources produced an output file',
                args: {
                  outputPath: { positional: true },
                },
              },
              affected: {
                description: 'Show what outputs change if a source changes',
                args: {
                  sourcePath: { positional: true },
                },
              },
              audit: {
                description: 'Check generated files for drift',
                args: {
                  outputDir: { positional: true },
                },
              },
            },
          },
        },
      },
    };

    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(EMITTER_MANIFEST, 'Emitter'),
        overrides: '{}',
        manifestYaml: JSON.stringify(manifestYaml),
      },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    const content = commandFile!.content;

    // Command group should be 'emitter' (from manifest override)
    expect(content).toContain("Command('emitter')");

    // outputPath should be positional in trace
    expect(content).toContain("argument('<outputPath>'");

    // sourcePath should be positional in affected
    expect(content).toContain("argument('<sourcePath>'");
  });

  it('command tree lists all actions without generation-specific metadata', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(EMITTER_MANIFEST, 'Emitter'),
        overrides: '{}',
      },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    const content = commandFile!.content;

    // Command tree should list all actions
    expect(content).toContain('emitterCommandTree');
    expect(content).toContain("action: 'write'");
    expect(content).toContain("action: 'audit'");
    expect(content).toContain("action: 'clean'");
    expect(content).toContain("action: 'trace'");
    expect(content).toContain("action: 'affected'");

    // Should NOT have generation-specific metadata (that was the old hardcoded approach)
    expect(content).not.toContain('generation: {');
    expect(content).not.toContain("family: '");
    expect(content).not.toContain("inputKind: '");
  });
});
