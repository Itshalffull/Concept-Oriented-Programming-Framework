// ============================================================
// DeployScaffoldGen — Deployment manifest (deploy.yaml) generator
//
// Generates deploy.yaml scaffolds from provided inputs: app name,
// runtime configs, concept assignments, and infrastructure settings.
//
// See architecture doc:
//   - Section 11: Deployment manifests
//   - Section 12: Runtime configuration
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface RuntimeConfig {
  name: string;
  type?: string;
  transport?: string;
  storage?: string;
  iac?: string;
}

interface ConceptAssignment {
  name: string;
  runtime: string;
  spec?: string;
  language?: string;
}

function buildDeployYaml(input: Record<string, unknown>): string {
  const appName = (input.appName as string) || 'my-app';
  const version = (input.version as string) || '0.1.0';
  const runtimes = (input.runtimes as RuntimeConfig[]) || [
    { name: 'main', type: 'node', transport: 'http', storage: 'sqlite' },
  ];
  const concepts = (input.concepts as ConceptAssignment[]) || [];
  const iacProvider = (input.iacProvider as string) || 'terraform';

  const lines: string[] = [
    'app:',
    `  name: ${appName}`,
    `  version: "${version}"`,
    '',
  ];

  // Runtimes
  lines.push('runtimes:');
  for (const rt of runtimes) {
    lines.push(`  ${rt.name}:`);
    lines.push(`    type: ${rt.type || 'node'}`);
    if (rt.transport) lines.push(`    transport: ${rt.transport}`);
    if (rt.storage) lines.push(`    storage: ${rt.storage}`);
    if (rt.iac) lines.push(`    iac: ${rt.iac}`);
  }
  lines.push('');

  // Engine runtime
  lines.push('  engine:');
  lines.push('    engine: true');
  lines.push('    transport: http');
  lines.push('');

  // Infrastructure
  lines.push('infrastructure:');
  lines.push('  storage:');
  const storageBackends = new Set(runtimes.map(r => r.storage).filter(Boolean));
  if (storageBackends.size === 0) storageBackends.add('sqlite');
  for (const backend of storageBackends) {
    lines.push(`    ${backend}:`);
    lines.push(`      type: ${backend}`);
    lines.push(`      config: {}`);
  }
  lines.push('');

  lines.push('  transports:');
  const transportTypes = new Set(runtimes.map(r => r.transport).filter(Boolean));
  if (transportTypes.size === 0) transportTypes.add('http');
  for (const tp of transportTypes) {
    lines.push(`    ${tp}:`);
    lines.push(`      type: ${tp}`);
    lines.push(`      config: {}`);
  }
  lines.push('');

  lines.push(`  iac:`);
  lines.push(`    provider: ${iacProvider}`);
  lines.push('');

  // Concepts
  if (concepts.length > 0) {
    lines.push('concepts:');
    for (const c of concepts) {
      lines.push(`  ${c.name}:`);
      lines.push(`    spec: ./specs/app/${toKebab(c.name)}.concept`);
      lines.push('    implementations:');
      lines.push(`      - language: ${c.language || 'typescript'}`);
      lines.push(`        path: ./implementations/${c.language || 'typescript'}/app/${toKebab(c.name)}.impl.ts`);
      lines.push(`        runtime: ${c.runtime || runtimes[0]?.name || 'main'}`);
      lines.push(`        storage: ${runtimes.find(r => r.name === (c.runtime || runtimes[0]?.name))?.storage || 'sqlite'}`);
    }
    lines.push('');
  }

  // Syncs
  lines.push('syncs: []');
  lines.push('');

  // Build
  lines.push('build:');
  lines.push('  typescript:');
  lines.push('    compiler: tsc');
  lines.push('    testRunner: vitest');
  lines.push('');

  return lines.join('\n');
}

export const deployScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'DeployScaffoldGen',
      inputKind: 'DeployConfig',
      outputKind: 'DeployManifest',
      capabilities: JSON.stringify(['deploy-yaml', 'runtime-config', 'infrastructure']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const appName = (input.appName as string) || 'my-app';

    if (!appName || typeof appName !== 'string') {
      return { variant: 'error', message: 'App name is required' };
    }

    try {
      const deployYaml = buildDeployYaml(input);

      const files: { path: string; content: string }[] = [
        { path: `deploy/${toKebab(appName)}.deploy.yaml`, content: deployYaml },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await deployScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
