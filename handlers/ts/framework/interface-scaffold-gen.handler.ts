// @clef-handler style=functional concept=InterfaceScaffoldGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// InterfaceScaffoldGen — Interface manifest (interface.yaml) generator
//
// Generates interface.yaml scaffolds with target configs, SDK
// settings, spec output options, and per-concept overrides.
// Supports the dual-manifest Bind architecture (Section 6.1–6.2):
//   - config manifest: developer-facing admin concepts (manifest_type: config)
//   - content manifest: user-facing content concepts (manifest_type: content)
//
// See architecture doc:
//   - Section 6.1: Config manifest
//   - Section 6.2: Content manifest
//   - Section 8: Interface generation pipeline
//   - Section 8.1: Target configuration
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

interface BuildOptions {
  name: string;
  version: string;
  targets: string[];
  sdks: string[];
  concepts: string[];
  openapi: boolean;
  asyncapi: boolean;
  manifestType?: 'config' | 'content' | 'single';
  description?: string;
  authRequired?: boolean;
  authRole?: string;
  authStrategies?: string[];
  restBasePath?: string;
  restRateLimit?: string;
  graphqlPath?: string;
  mcpName?: string;
  sdkPackagePrefix?: string;
}

function buildTargets(targets: string[], opts: BuildOptions): string[] {
  const lines: string[] = [];
  lines.push('  targets:');
  for (const t of targets) {
    let template = TARGET_DEFAULTS[t];
    if (template) {
      // Apply per-type overrides for dual-manifest mode
      if (opts.restBasePath && t === 'rest') {
        template = [
          '    rest:',
          `      basePath: ${opts.restBasePath}`,
          '      framework: hono',
          '      versioning: url',
        ].join('\n');
      }
      if (opts.graphqlPath && t === 'graphql') {
        template = [
          '    graphql:',
          `      path: ${opts.graphqlPath}`,
          '      relay: true',
          '      subscriptions: true',
        ].join('\n');
      }
      if (opts.mcpName && t === 'mcp') {
        template = [
          '    mcp:',
          `      name: ${opts.mcpName}`,
          '      transport: stdio',
        ].join('\n');
      }
      lines.push(template);
    } else {
      lines.push(`    ${t}:`);
      lines.push('      # TODO: configure target');
    }
  }
  lines.push('');
  return lines;
}

function buildSdks(sdks: string[], opts: BuildOptions): string[] {
  const lines: string[] = [];
  lines.push('  sdk:');
  for (const s of sdks) {
    let template = SDK_DEFAULTS[s];
    if (template) {
      // Apply package prefix for dual-manifest mode
      if (opts.sdkPackagePrefix && (s === 'typescript' || s === 'python')) {
        if (s === 'typescript') {
          template = [
            '    typescript:',
            `      packageName: "${opts.sdkPackagePrefix}"`,
            '      moduleSystem: esm',
          ].join('\n');
        } else {
          template = [
            '    python:',
            `      packageName: ${opts.sdkPackagePrefix.replace(/^@[^/]+\//, '').replace(/\//g, '-')}`,
            '      asyncSupport: true',
          ].join('\n');
        }
      }
      lines.push(template);
    } else {
      lines.push(`    ${s}:`);
      lines.push(`      packageName: "${opts.name}-sdk-${s}"`);
    }
  }
  lines.push('');
  return lines;
}

/**
 * Build a single-manifest interface YAML from raw input options.
 * Used by the `generate` action for standalone manifests.
 */
function buildInterfaceYaml(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'my-interface';
  const version = (input.version as string) || '0.1.0';
  const targets = (input.targets as string[]) || ['rest'];
  const sdks = (input.sdks as string[]) || ['typescript'];
  const concepts = (input.concepts as string[]) || [];
  const openapi = (input.openapi as boolean) !== false;
  const asyncapi = (input.asyncapi as boolean) || false;

  const opts: BuildOptions = { name, version, targets, sdks, concepts, openapi, asyncapi };

  const lines: string[] = [
    'interface:',
    `  name: ${name}`,
    `  version: "${version}"`,
    '',
  ];

  if (targets.length > 0) lines.push(...buildTargets(targets, opts));
  if (sdks.length > 0) lines.push(...buildSdks(sdks, opts));

  lines.push('  specs:');
  lines.push(`    openapi: ${openapi}`);
  lines.push(`    asyncapi: ${asyncapi}`);
  lines.push('');

  lines.push('  output:');
  lines.push('    dir: ./bind');
  lines.push('    clean: true');
  lines.push('');

  lines.push('  grouping:');
  lines.push('    strategy: per-concept');
  lines.push('');

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

/**
 * Build the config manifest YAML (developer-facing, admin concepts).
 * manifest_type: config — see Architecture doc Section 6.1.
 */
function buildConfigManifestYaml(name: string, targets: string[], sdks: string[]): string {
  const kebabName = toKebab(name);
  const opts: BuildOptions = {
    name: `${kebabName}-config`,
    version: '0.1.0',
    targets,
    sdks,
    concepts: [],
    openapi: true,
    asyncapi: false,
    manifestType: 'config',
    authRequired: true,
    authRole: 'admin',
    authStrategies: ['cookie', 'api_key', 'oauth'],
    restBasePath: '/api/admin',
    graphqlPath: '/graphql/admin',
    mcpName: `${kebabName}-admin`,
    sdkPackagePrefix: `@${kebabName}/admin`,
  };

  const lines: string[] = [
    `# ${name} — Config Manifest (developer-facing)`,
    '#',
    '# Covers all config entities and developer-facing concepts:',
    '# schema management, view builder, workflow definitions,',
    '# automation rule management, deployment configuration,',
    '# concept registry, and bind target configuration.',
    '#',
    '# See Architecture doc Section 6.1.',
    '',
    'interface:',
    `  name: ${kebabName}-config`,
    '  version: "0.1.0"',
    '  manifest_type: config',
    `  description: "Developer-facing administration interface for ${name}"`,
    '',
    'auth:',
    '  required: true',
    '  default_role: admin',
    '  strategies:',
    '    - cookie',
    '    - api_key',
    '    - oauth',
    '',
  ];

  if (targets.length > 0) lines.push(...buildTargets(targets, opts));
  if (sdks.length > 0) lines.push(...buildSdks(sdks, opts));

  lines.push('  specs:');
  lines.push('    openapi: true');
  lines.push('    asyncapi: false');
  lines.push('');

  lines.push('  output:');
  lines.push('    dir: ./bind/config');
  lines.push('    clean: true');
  lines.push('');

  lines.push('  grouping:');
  lines.push('    strategy: per-concept');
  lines.push('');

  lines.push('# Config-manifest concepts — admin/developer facing');
  lines.push('# Add concept entries here for schema management, workflows,');
  lines.push('# automation rules, deployment config, etc.');
  lines.push('concepts: []');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build the content manifest YAML (user-facing content concepts).
 * manifest_type: content — see Architecture doc Section 6.2.
 */
function buildContentManifestYaml(name: string, targets: string[], sdks: string[]): string {
  const kebabName = toKebab(name);
  const opts: BuildOptions = {
    name: `${kebabName}-content`,
    version: '0.1.0',
    targets,
    sdks,
    concepts: [],
    openapi: true,
    asyncapi: false,
    manifestType: 'content',
    authRequired: false,
    authRole: 'anonymous',
    authStrategies: ['cookie', 'bearer_token', 'oauth', 'wallet'],
    restBasePath: '/api/content',
    graphqlPath: '/graphql',
    mcpName: `${kebabName}-content`,
    sdkPackagePrefix: `@${kebabName}/content`,
  };

  const lines: string[] = [
    `# ${name} — Content Manifest (user-facing)`,
    '#',
    '# Covers all content entities and user-facing concepts:',
    '# content CRUD, queries, views, taxonomy navigation,',
    '# comments, media management, search, and user profiles.',
    '#',
    '# See Architecture doc Section 6.2.',
    '',
    'interface:',
    `  name: ${kebabName}-content`,
    '  version: "0.1.0"',
    '  manifest_type: content',
    `  description: "User-facing content interface for ${name}"`,
    '',
    'auth:',
    '  required: false',
    '  default_role: anonymous',
    '  strategies:',
    '    - cookie',
    '    - bearer_token',
    '    - oauth',
    '    - wallet',
    '',
  ];

  if (targets.length > 0) lines.push(...buildTargets(targets, opts));
  if (sdks.length > 0) lines.push(...buildSdks(sdks, opts));

  lines.push('  specs:');
  lines.push('    openapi: true');
  lines.push('    asyncapi: false');
  lines.push('');

  lines.push('  output:');
  lines.push('    dir: ./bind/content');
  lines.push('    clean: true');
  lines.push('');

  lines.push('  grouping:');
  lines.push('    strategy: per-concept');
  lines.push('');

  lines.push('# Content-manifest concepts — user facing');
  lines.push('# Add concept entries here for content nodes, taxonomy,');
  lines.push('# comments, media, search, views, authentication, etc.');
  lines.push('concepts: []');
  lines.push('');

  return lines.join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = complete(p, 'ok', {
      name: 'InterfaceScaffoldGen',
      inputKind: 'InterfaceConfig',
      outputKind: 'InterfaceManifest',
      capabilities: JSON.stringify(['interface-yaml', 'target-config', 'sdk-config', 'dual-manifest']),
    });
    return p;
  },

  generate(input: Record<string, unknown>) {
    const rawName = input.name as string;
    if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
      let p = createProgram();
      p = complete(p, 'error', { message: 'Interface name is required' });
      return p;
    }
    const name = rawName;

    try {
      const interfaceYaml = buildInterfaceYaml(input);
      const files: { path: string; content: string }[] = [
        { path: `interfaces/${toKebab(name)}.stub.interface.yaml`, content: interfaceYaml },
      ];
      let p = createProgram();
      p = complete(p, 'ok', { files, filesGenerated: files.length });
      return p;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      let p = createProgram();
      p = complete(p, 'error', { message, ...(stack ? { stack } : {}) });
      return p;
    }
  },

  generateDual(input: Record<string, unknown>) {
    const rawName = input.name as string;
    if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
      let p = createProgram();
      p = complete(p, 'error', { message: 'Interface name is required for dual-manifest generation' });
      return p;
    }

    const name = rawName;
    const targets = (input.targets as string[]) || ['rest'];
    const sdks = (input.sdks as string[]) || ['typescript'];
    const kebabName = toKebab(name);

    try {
      const configYaml = buildConfigManifestYaml(name, targets, sdks);
      const contentYaml = buildContentManifestYaml(name, targets, sdks);

      const files: { path: string; content: string }[] = [
        {
          path: `interfaces/${kebabName}-config.interface.yaml`,
          content: configYaml,
        },
        {
          path: `interfaces/${kebabName}-content.interface.yaml`,
          content: contentYaml,
        },
      ];

      let p = createProgram();
      p = complete(p, 'ok', { files, filesGenerated: files.length });
      return p;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      let p = createProgram();
      p = complete(p, 'error', { message, ...(stack ? { stack } : {}) });
      return p;
    }
  },

  preview(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.targets || (typeof input.targets === 'string' && (input.targets as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'targets is required' }) as StorageProgram<Result>;
    }
    if (!input.sdks || (typeof input.sdks === 'string' && (input.sdks as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sdks is required' }) as StorageProgram<Result>;
    }
    return _handler.generate(input);
  },
};

export const interfaceScaffoldGenHandler = autoInterpret(_handler);
