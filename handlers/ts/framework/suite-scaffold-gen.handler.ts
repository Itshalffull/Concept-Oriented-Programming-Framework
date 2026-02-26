// ============================================================
// SuiteScaffoldGen — Suite manifest (suite.yaml) scaffold generator
//
// Generates a suite.yaml manifest and directory structure for a
// new Clef kit from provided inputs: name, description, concept
// list, sync tiers, and optional infrastructure declarations.
//
// See architecture doc:
//   - Section 7: Kit structure and manifests
//   - Section 10.1: ConceptManifest as language-neutral IR
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function buildKitYaml(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'my-kit';
  const version = (input.version as string) || '0.1.0';
  const description = (input.description as string) || `The ${name} kit.`;
  const concepts = (input.concepts as string[]) || [];
  const syncs = (input.syncs as Array<{ name: string; tier: string }>) || [];
  const dependencies = (input.dependencies as string[]) || [];
  const isDomain = (input.isDomain as boolean) || false;

  const lines: string[] = [
    'kit:',
    `  name: ${name}`,
    `  version: ${version}`,
    `  description: >`,
    `    ${description}`,
    '',
  ];

  // Concepts section
  if (concepts.length > 0) {
    lines.push('concepts:');
    for (const c of concepts) {
      const kebab = toKebab(c);
      lines.push(`  ${c}:`);
      lines.push(`    spec: ./${kebab}.concept`);
      lines.push(`    params:`);
      lines.push(`      T: { as: ${kebab}-ref, description: "Reference to a ${c}" }`);
    }
    lines.push('');
  }

  // Syncs section
  if (syncs.length > 0) {
    const grouped: Record<string, Array<{ name: string }>> = {};
    for (const s of syncs) {
      const tier = s.tier || 'recommended';
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push(s);
    }

    lines.push('syncs:');
    for (const tier of ['required', 'recommended', 'integration']) {
      if (!grouped[tier]) continue;
      lines.push(`  ${tier}:`);
      for (const s of grouped[tier]) {
        const kebab = toKebab(s.name);
        lines.push(`    - path: ./syncs/${kebab}.sync`);
        lines.push(`      name: ${s.name}`);
        lines.push(`      description: >`);
        lines.push(`        ${s.name} synchronization rule.`);
      }
    }
    lines.push('');
  } else {
    lines.push('syncs:');
    lines.push('  required: []');
    lines.push('  recommended: []');
    lines.push('');
  }

  // Dependencies
  if (dependencies.length > 0) {
    lines.push('dependencies:');
    for (const dep of dependencies) {
      lines.push(`  - ${dep}: ">=0.1.0"`);
    }
  } else {
    lines.push('dependencies: []');
  }

  // Infrastructure section for domain suites
  if (isDomain) {
    lines.push('');
    lines.push('infrastructure:');
    lines.push('  transports: []');
    lines.push('  storage: []');
    lines.push('  deployTemplates: []');
  }

  lines.push('');
  return lines.join('\n');
}

export const suiteScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SuiteScaffoldGen',
      inputKind: 'KitConfig',
      outputKind: 'SuiteManifest',
      capabilities: JSON.stringify(['kit-yaml', 'directory-structure']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'my-kit';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Kit name is required' };
    }

    try {
      const kitYaml = buildKitYaml(input);
      const concepts = (input.concepts as string[]) || [];

      const files: { path: string; content: string }[] = [
        { path: `suites/${name}/suite.yaml`, content: kitYaml },
      ];

      // Generate stub concept files
      for (const c of concepts) {
        const kebab = toKebab(c);
        files.push({
          path: `suites/${name}/${kebab}.concept`,
          content: [
            `concept ${c} [T] {`,
            '',
            '  purpose {',
            `    TODO: Describe the purpose of ${c}.`,
            '  }',
            '',
            '  state {',
            `    items: set T`,
            '  }',
            '',
            '  actions {',
            `    action create(name: String) {`,
            `      -> ok(item: T) { Item created. }`,
            `      -> error(message: String) { Creation failed. }`,
            '    }',
            '  }',
            '}',
            '',
          ].join('\n'),
        });
      }

      // Create directory placeholders
      files.push({ path: `suites/${name}/syncs/.gitkeep`, content: '' });

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await suiteScaffoldGenHandler.generate!(input, storage);
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
