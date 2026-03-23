// @clef-handler style=functional concept=DeployScaffoldGen
// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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

function normalizeList(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && (val as any).type === 'list') {
    return ((val as any).items || []).map((i: any) => i.value !== undefined ? i.value : i);
  }
  return [];
}

function buildDeployYaml(input: Record<string, unknown>): string {
  const appName = (input.appName as string) || 'my-app';
  const version = (input.version as string) || '0.1.0';
  const rawRuntimes = normalizeList(input.runtimes);
  const runtimes = rawRuntimes.length > 0 ? rawRuntimes as RuntimeConfig[] : [
    { name: 'main', type: 'node', transport: 'http', storage: 'sqlite' },
  ];
  const concepts = normalizeList(input.concepts) as ConceptAssignment[];
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
      lines.push(`    spec: ./concepts/${toKebab(c.name)}.concept`);
      lines.push('    implementations:');
      lines.push(`      - language: ${c.language || 'typescript'}`);
      lines.push(`        path: ./handlers/${(c.language || 'typescript') === 'typescript' ? 'ts' : (c.language || 'typescript')}/${toKebab(c.name)}.handler.ts`);
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

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    { let p = createProgram(); p = complete(p, 'ok', { name: 'DeployScaffoldGen',
      inputKind: 'DeployConfig',
      outputKind: 'DeployManifest',
      capabilities: JSON.stringify(['deploy-yaml', 'runtime-config', 'infrastructure']) }); return p; }
  },

  generate(input: Record<string, unknown>) {
    const rawAppName = input.appName as string;
    if (!rawAppName || typeof rawAppName !== 'string' || rawAppName.trim() === '') {
      { let p = createProgram(); p = complete(p, 'error', { message: 'App name is required' }); return p; }
    }
    const appName = rawAppName;

    try {
      const deployYaml = buildDeployYaml(input);

      const files: { path: string; content: string }[] = [
        { path: `deploys/${toKebab(appName)}.stub.deploy.yaml`, content: deployYaml },
      ];

      { let p = createProgram(); p = complete(p, 'ok', { files, filesGenerated: files.length }); return p; }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      { let p = createProgram(); p = complete(p, 'error', { message, ...(stack ? { stack } : {}) }); return p; }
    }
  },

  preview(input: Record<string, unknown>) {
    if (!input.appName || (typeof input.appName === 'string' && (input.appName as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'appName is required' }) as StorageProgram<Result>;
    }
    if (!input.runtimes || (typeof input.runtimes === 'string' && (input.runtimes as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'runtimes is required' }) as StorageProgram<Result>;
    }
    if (!input.concepts || (typeof input.concepts === 'string' && (input.concepts as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concepts is required' }) as StorageProgram<Result>;
    }
    return _handler.generate(input);
  },
};

export const deployScaffoldGenHandler = autoInterpret(_handler);
