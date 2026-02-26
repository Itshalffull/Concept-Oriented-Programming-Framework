// ============================================================
// HandlerScaffoldGen — Concept handler (.handler.ts) scaffold generator
//
// Generates TypeScript concept handler implementations from
// provided inputs: concept name, actions, and their signatures.
//
// See architecture doc:
//   - Section 6: Concept implementations
//   - Section 6.1: ConceptHandler interface
//   - Section 6.2: Storage patterns
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

interface ActionDef {
  name: string;
  params: Array<{ name: string; type: string }>;
  variants: Array<{
    name: string;
    params: Array<{ name: string; type: string }>;
  }>;
}

function mapTsType(conceptType: string): string {
  switch (conceptType.toLowerCase()) {
    case 'string': return 'string';
    case 'int':
    case 'integer':
    case 'number':
    case 'float': return 'number';
    case 'bool':
    case 'boolean': return 'boolean';
    default:
      if (conceptType.startsWith('list ')) return `${mapTsType(conceptType.slice(5))}[]`;
      if (conceptType.startsWith('set ')) return `Set<${mapTsType(conceptType.slice(4))}>`;
      if (conceptType.startsWith('map ')) return `Map<string, unknown>`;
      return 'unknown';
  }
}

function buildHandlerImpl(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [
    {
      name: 'create',
      params: [{ name: 'name', type: 'String' }],
      variants: [
        { name: 'ok', params: [{ name: 'item', type: 'String' }] },
        { name: 'error', params: [{ name: 'message', type: 'String' }] },
      ],
    },
  ];
  const inputKind = (input.inputKind as string) || conceptName;
  const outputKind = (input.outputKind as string) || `${conceptName}Result`;
  const capabilities = (input.capabilities as string[]) || [];
  const relation = (input.relation as string) || toCamel(conceptName) + 's';

  const lines: string[] = [
    '// ============================================================',
    `// ${conceptName} Concept Implementation`,
    '//',
    `// Handler for the ${conceptName} concept.`,
    '// ============================================================',
    '',
    "import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';",
    '',
    `export const ${toCamel(conceptName)}Handler: ConceptHandler = {`,
    '  async register() {',
    '    return {',
    "      variant: 'ok',",
    `      name: '${conceptName}',`,
    `      inputKind: '${inputKind}',`,
    `      outputKind: '${outputKind}',`,
    `      capabilities: JSON.stringify(${JSON.stringify(capabilities)}),`,
    '    };',
    '  },',
    '',
  ];

  for (const action of actions) {
    const paramExtractions = action.params.map(p => {
      const tsType = mapTsType(p.type);
      return `    const ${p.name} = input.${p.name} as ${tsType};`;
    });

    lines.push(`  async ${action.name}(input: Record<string, unknown>, storage: ConceptStorage) {`);
    lines.push(...paramExtractions);
    lines.push('');

    // Validation
    const requiredParams = action.params.filter(p => p.type === 'String' || p.type === 'string');
    if (requiredParams.length > 0) {
      for (const p of requiredParams) {
        lines.push(`    if (!${p.name}) {`);
        lines.push(`      return { variant: 'error', message: '${p.name} is required' };`);
        lines.push('    }');
      }
      lines.push('');
    }

    lines.push('    try {');
    lines.push(`      // TODO: Implement ${action.name} logic`);

    // Find ok variant for return type
    const okVariant = action.variants.find(v => v.name === 'ok');
    if (okVariant) {
      const okParams = okVariant.params
        .map(p => `${p.name}: ${p.name === 'message' ? "'Success'" : 'undefined /* TODO */'}`)
        .join(', ');
      lines.push(`      return { variant: 'ok', ${okParams} };`);
    } else {
      lines.push("      return { variant: 'ok' };");
    }

    lines.push('    } catch (err: unknown) {');
    lines.push("      const message = err instanceof Error ? err.message : String(err);");
    lines.push("      return { variant: 'error', message };");
    lines.push('    }');
    lines.push('  },');
    lines.push('');
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function buildConformanceTest(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [];
  const kebab = toKebab(conceptName);

  const lines: string[] = [
    "import { describe, it, expect } from 'vitest';",
    `import { ${toCamel(conceptName)}Handler } from '../handlers/ts/${kebab}.handler.js';`,
    "import { createInMemoryStorage } from '../kernel/src/storage.js';",
    '',
    `describe('${conceptName} handler', () => {`,
    '  it(\'should register with correct metadata\', async () => {',
    '    const storage = createInMemoryStorage();',
    '    const result = await ' + toCamel(conceptName) + 'Handler.register!({}, storage);',
    "    expect(result.variant).toBe('ok');",
    `    expect(result.name).toBe('${conceptName}');`,
    '  });',
    '',
  ];

  for (const action of actions) {
    lines.push(`  it('should handle ${action.name}', async () => {`);
    lines.push('    const storage = createInMemoryStorage();');
    const inputObj = action.params.map(p => {
      if (p.type === 'String' || p.type === 'string') return `${p.name}: 'test'`;
      if (p.type === 'Int' || p.type === 'number') return `${p.name}: 1`;
      if (p.type === 'Bool' || p.type === 'boolean') return `${p.name}: true`;
      return `${p.name}: undefined`;
    }).join(', ');
    lines.push(`    const result = await ${toCamel(conceptName)}Handler.${action.name}({ ${inputObj} }, storage);`);
    lines.push("    expect(result.variant).toBeDefined();");
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

export const handlerScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'HandlerScaffoldGen',
      inputKind: 'HandlerConfig',
      outputKind: 'HandlerImpl',
      capabilities: JSON.stringify(['impl-ts', 'conformance-test', 'storage-patterns']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const conceptName = (input.conceptName as string) || 'MyConcept';

    if (!conceptName || typeof conceptName !== 'string') {
      return { variant: 'error', message: 'Concept name is required' };
    }

    try {
      const kebab = toKebab(conceptName);
      const handlerCode = buildHandlerImpl(input);

      const files: { path: string; content: string }[] = [
        {
          path: `handlers/ts/${kebab}.handler.ts`,
          content: handlerCode,
        },
      ];

      // Generate conformance test if actions are provided
      if (input.actions) {
        const testCode = buildConformanceTest(input);
        files.push({
          path: `tests/conformance/${kebab}.conformance.test.ts`,
          content: testCode,
        });
      }

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await handlerScaffoldGenHandler.generate!(input, storage);
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
