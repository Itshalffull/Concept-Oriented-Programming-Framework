// ============================================================
// CLI Generation Kit Integration Tests
//
// Validates that CliTarget generates generation-kit-aware
// subcommands when a concept is declared as a generator.
// Tests both the ConceptManifest.generation field path and
// the manifest YAML generation.generators path.
//
// See copf-generation-kit.md Part 6 (CLI Integration).
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { cliTargetHandler } from '../../../../implementations/typescript/framework/providers/cli-target.impl.js';
import type { ConceptManifest } from '@copf/kernel';

function makeProjection(manifest: ConceptManifest, name: string): string {
  return JSON.stringify({
    conceptName: name,
    conceptManifest: JSON.stringify(manifest),
  });
}

const MINIMAL_MANIFEST: ConceptManifest = {
  uri: 'urn:copf/TestGen',
  name: 'TestGen',
  typeParams: [],
  relations: [],
  actions: [
    {
      name: 'generate',
      description: 'Generate test output',
      params: [
        { name: 'spec', type: { kind: 'primitive', primitive: 'String' } },
        { name: 'manifest', type: { kind: 'primitive', primitive: 'String' } },
      ],
      variants: [
        { tag: 'ok', fields: [{ name: 'files', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } }, optional: false }] },
        { tag: 'error', fields: [{ name: 'message', type: { kind: 'primitive', primitive: 'String' }, optional: false }] },
      ],
    },
  ],
  invariants: [],
  graphqlSchema: '',
  jsonSchemas: { invocations: {}, completions: {} },
  capabilities: [],
  purpose: 'Test code generator',
};

describe('CLI generation kit integration', () => {
  it('should generate standard CLI without generation subcommands', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(MINIMAL_MANIFEST, 'TestGen'),
        overrides: '{}',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(1);

    const commandFile = files.find(f => f.path.includes('.command.ts'));
    expect(commandFile).toBeDefined();
    expect(commandFile!.content).toContain("command('generate')");
    expect(commandFile!.content).not.toContain("command('plan')");
    expect(commandFile!.content).not.toContain("command('audit')");
    expect(commandFile!.content).not.toContain('Generation Kit Integration');
  });

  it('should generate generation-kit-aware CLI via manifest YAML', async () => {
    const storage = createInMemoryStorage();
    const manifestYaml = {
      generation: {
        generators: {
          TestGen: {
            family: 'framework',
            inputKind: 'ConceptManifest',
            outputKind: 'TestFiles',
            deterministic: true,
            pure: true,
          },
        },
      },
    };

    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(MINIMAL_MANIFEST, 'TestGen'),
        overrides: '{}',
        manifestYaml: JSON.stringify(manifestYaml),
      },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    expect(commandFile).toBeDefined();
    const content = commandFile!.content;

    // Should have generation kit subcommands
    expect(content).toContain("command('plan')");
    expect(content).toContain("command('status')");
    expect(content).toContain("command('summary')");
    expect(content).toContain("command('history')");
    expect(content).toContain("command('audit')");
    expect(content).toContain("command('clean')");
    expect(content).toContain("command('impact')");
    expect(content).toContain("command('kinds')");

    // Should have --force flag on generate subcommand
    expect(content).toContain("'--force'");
    expect(content).toContain("'--dry-run'");

    // Command tree should include generation metadata
    expect(content).toContain("generation: {");
    expect(content).toContain("family: 'framework'");
    expect(content).toContain("inputKind: 'ConceptManifest'");
    expect(content).toContain("outputKind: 'TestFiles'");
  });

  it('should generate generation-kit-aware CLI via ConceptManifest.generation', async () => {
    const storage = createInMemoryStorage();
    const manifestWithGen: ConceptManifest = {
      ...MINIMAL_MANIFEST,
      generation: {
        family: 'interface',
        inputKind: 'Projection',
        outputKind: 'CliCommands',
        deterministic: true,
        pure: true,
      },
    };

    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(manifestWithGen, 'TestGen'),
        overrides: '{}',
      },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    const content = commandFile!.content;

    expect(content).toContain("command('plan')");
    expect(content).toContain("command('audit')");
    expect(content).toContain("family: 'interface'");
    expect(content).toContain("inputKind: 'Projection'");
    expect(content).toContain("outputKind: 'CliCommands'");
  });

  it('should not duplicate generation subcommands with regular actions', async () => {
    const storage = createInMemoryStorage();
    const manifestWithGen: ConceptManifest = {
      ...MINIMAL_MANIFEST,
      generation: {
        family: 'framework',
        inputKind: 'ConceptManifest',
        outputKind: 'TestFiles',
        deterministic: true,
        pure: true,
      },
    };

    const result = await cliTargetHandler.generate(
      {
        projection: makeProjection(manifestWithGen, 'TestGen'),
        overrides: '{}',
      },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const commandFile = files.find(f => f.path.includes('.command.ts'));
    const content = commandFile!.content;

    // Count occurrences of plan command — should appear exactly once
    const planMatches = content.match(/\.command\('plan'\)/g);
    expect(planMatches).toHaveLength(1);
  });
});
