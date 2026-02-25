// ============================================================
// InterfaceScaffoldGen — Interface manifest (interface.yaml) generator
//
// Generates interface.yaml scaffolds with target configs, SDK
// settings, spec output options, and per-concept overrides.
//
// See architecture doc:
//   - Section 8: Interface generation pipeline
//   - Section 8.1: Target configuration
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

const TARGET_DEFAULTS: Record<string, string> = {
  rest: [
    '    rest:',
    '      basePath: /api',
    '      framework: hono',
    '      versioning: url',
  ].join('\n'),
  graphql: [
    '    graphql:',
    '      path: /graphql',
    '      relay: true',
    '      subscriptions: true',
  ].join('\n'),
  grpc: [
    '    grpc:',
    '      package: app.v1',
  ].join('\n'),
  cli: [
    '    cli:',
    '      name: my-cli',
    '      shell: [bash, zsh, fish]',
  ].join('\n'),
  mcp: [
    '    mcp:',
    '      name: my-mcp-server',
    '      transport: stdio',
  ].join('\n'),
  'claude-skills': [
    '    claude-skills:',
    '      name: my-skills',
    '      progressive: true',
  ].join('\n'),
};

const SDK_DEFAULTS: Record<string, string> = {
  typescript: [
    '    typescript:',
    '      packageName: "@app/sdk"',
    '      moduleSystem: esm',
  ].join('\n'),
  python: [
    '    python:',
    '      packageName: app-sdk',
    '      asyncSupport: true',
  ].join('\n'),
  go: [
    '    go:',
    '      modulePath: github.com/org/app-sdk-go',
  ].join('\n'),
  rust: [
    '    rust:',
    '      packageName: app-sdk',
  ].join('\n'),
  java: [
    '    java:',
    '      packageName: com.org.app.sdk',
  ].join('\n'),
  swift: [
    '    swift:',
    '      packageName: AppSDK',
  ].join('\n'),
};

function buildInterfaceYaml(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'my-interface';
  const version = (input.version as string) || '0.1.0';
  const targets = (input.targets as string[]) || ['rest'];
  const sdks = (input.sdks as string[]) || ['typescript'];
  const concepts = (input.concepts as string[]) || [];
  const openapi = (input.openapi as boolean) !== false;
  const asyncapi = (input.asyncapi as boolean) || false;

  const lines: string[] = [
    'interface:',
    `  name: ${name}`,
    `  version: "${version}"`,
    '',
  ];

  // Targets
  if (targets.length > 0) {
    lines.push('  targets:');
    for (const t of targets) {
      const template = TARGET_DEFAULTS[t];
      if (template) {
        lines.push(template);
      } else {
        lines.push(`    ${t}:`);
        lines.push('      # TODO: configure target');
      }
    }
    lines.push('');
  }

  // SDKs
  if (sdks.length > 0) {
    lines.push('  sdk:');
    for (const s of sdks) {
      const template = SDK_DEFAULTS[s];
      if (template) {
        lines.push(template);
      } else {
        lines.push(`    ${s}:`);
        lines.push(`      packageName: "${name}-sdk-${s}"`);
      }
    }
    lines.push('');
  }

  // Specs
  lines.push('  specs:');
  lines.push(`    openapi: ${openapi}`);
  lines.push(`    asyncapi: ${asyncapi}`);
  lines.push('');

  // Output
  lines.push('  output:');
  lines.push('    dir: ./generated/interface');
  lines.push('    clean: true');
  lines.push('');

  // Grouping
  lines.push('  grouping:');
  lines.push('    strategy: per-concept');
  lines.push('');

  // Per-concept overrides
  if (concepts.length > 0) {
    lines.push('  concepts:');
    for (const c of concepts) {
      const kebab = toKebab(c);
      lines.push(`    ${c}:`);
      if (targets.includes('rest')) {
        lines.push('      rest:');
        lines.push(`        basePath: /api/${kebab}s`);
      }
      if (targets.includes('graphql')) {
        lines.push('      graphql:');
        lines.push(`        typeName: ${c}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const interfaceScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'InterfaceScaffoldGen',
      inputKind: 'InterfaceConfig',
      outputKind: 'InterfaceManifest',
      capabilities: JSON.stringify(['interface-yaml', 'target-config', 'sdk-config']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'my-interface';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Interface name is required' };
    }

    try {
      const interfaceYaml = buildInterfaceYaml(input);

      const files: { path: string; content: string }[] = [
        { path: `${toKebab(name)}.interface.yaml`, content: interfaceYaml },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
