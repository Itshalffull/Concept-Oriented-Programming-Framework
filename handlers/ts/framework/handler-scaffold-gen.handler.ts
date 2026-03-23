// @clef-handler style=functional
// ============================================================
// HandlerScaffoldGen — Concept handler (.handler.ts) scaffold generator
//
// Generates TypeScript concept handler implementations from
// provided inputs: concept name, actions, and their signatures.
// Defaults to functional (StorageProgram) style; falls back to
// imperative style only when explicitly requested.
//
// See architecture doc:
//   - Section 6: Concept implementations
//   - Section 6.1: ConceptHandler interface
//   - Section 6.2: Storage patterns
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { buildTestPlan } from './test/test-gen.handler.js';
import { renderTypeScriptTests } from './test/typescript-test-renderer.js';

type Result = { variant: string; [key: string]: unknown };

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

// ── Handler Implementation Builders ───────────────────────────

function buildFunctionalHandlerImpl(input: Record<string, unknown>): string {
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
  const relation = (input.relation as string) || toCamel(conceptName) + 's';

  const lines: string[] = [
    '// @clef-handler style=functional',
    '// ============================================================',
    `// ${conceptName} Concept Implementation (Functional)`,
    '//',
    `// Functional handler for the ${conceptName} concept.`,
    '// Returns StorageProgram descriptions instead of executing effects directly.',
    '// ============================================================',
    '',
    "import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';",
    "import { createProgram, get, find, put, merge, del, branch, complete, pure, traverse, completeFrom, mapBindings, putFrom } from '../../../runtime/storage-program.js';",
    '',
    `export const ${toCamel(conceptName)}Handler: FunctionalConceptHandler = {`,
  ];

  for (const action of actions) {
    const paramExtractions = action.params.map(p => {
      const tsType = mapTsType(p.type);
      return `    const ${p.name} = input.${p.name} as ${tsType};`;
    });

    lines.push(`  ${action.name}(input: Record<string, unknown>) {`);
    lines.push(...paramExtractions);
    lines.push('');
    lines.push('    let p = createProgram();');
    lines.push(`    // TODO: Implement ${action.name} logic using StorageProgram DSL`);
    lines.push(`    // Example: p = get(p, '${relation}', id, 'existing');`);
    lines.push('');

    const okVariant = action.variants.find(v => v.name === 'ok');
    if (okVariant) {
      const okParams = okVariant.params
        .map(p => `${p.name}: ${p.name === 'message' ? "'Success'" : 'undefined /* TODO */'}`)
        .join(', ');
      lines.push(`    return complete(p, 'ok', { ${okParams} });`);
    } else {
      lines.push("    return complete(p, 'ok', {});");
    }

    lines.push('  },');
    lines.push('');
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function buildImperativeHandlerImpl(input: Record<string, unknown>): string {
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
    '// @clef-handler style=functional',
    '// ============================================================',
    `// ${conceptName} Concept Implementation (Imperative)`,
    '//',
    `// Imperative handler for the ${conceptName} concept.`,
    '// Use functional style (StorageProgram) for new concepts unless',
    '// the target language or concept constraints prevent it.',
    '// ============================================================',
    '',
    "import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';",
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

// ── Conformance Test Builder (delegates to TestGen) ───────────

function buildConformanceTest(input: Record<string, unknown>): string {
  const conceptName = (input.conceptName as string) || 'MyConcept';
  const actions = (input.actions as ActionDef[]) || [];
  const invariants = (input.invariants as Array<Record<string, unknown>>) || [];
  const style = (input.style as string) || 'functional';
  const kebab = toKebab(conceptName);

  if (style === 'imperative') {
    return buildImperativeConformanceTest(conceptName, actions, kebab);
  }

  const conceptData = {
    name: conceptName,
    actions: actions.map(a => ({
      name: a.name,
      params: a.params,
      variants: a.variants.map(v => ({ name: v.name, params: v.params })),
    })),
    invariants,
  };

  const plan = buildTestPlan(`clef/concept/${conceptName}`, conceptData);
  plan.handlerPath = `handlers/ts/${kebab}.handler.js`;
  return renderTypeScriptTests(plan);
}

function buildImperativeConformanceTest(conceptName: string, actions: ActionDef[], kebab: string): string {
  const lines: string[] = [
    "import { describe, it, expect } from 'vitest';",
    `import { ${toCamel(conceptName)}Handler } from '../handlers/ts/${kebab}.handler.js';`,
    "import { createInMemoryStorage } from '../runtime/adapters/storage.js';",
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

// ── Functional Handler Implementation ────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: 'HandlerScaffoldGen',
      inputKind: 'HandlerConfig',
      outputKind: 'HandlerImpl',
      capabilities: JSON.stringify(['impl-ts', 'conformance-test', 'storage-patterns']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const conceptName = (input.conceptName as string) || '';
    const style = (input.style as string) || 'functional';

    if (!conceptName || typeof conceptName !== 'string' || conceptName.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'conceptName is required and must not be empty',
      }) as StorageProgram<Result>;
    }

    try {
      // Normalize actions: accept both array and {type:"list",items:[...]} forms
      const rawActions = input.actions;
      const normalizedInput = {
        ...input,
        actions: Array.isArray(rawActions)
          ? rawActions
          : (rawActions && typeof rawActions === 'object' && (rawActions as any).items)
            ? (rawActions as any).items
            : [],
      };

      const kebab = toKebab(conceptName);
      const handlerCode = style === 'imperative'
        ? buildImperativeHandlerImpl(normalizedInput)
        : buildFunctionalHandlerImpl(normalizedInput);

      const files: { path: string; content: string }[] = [
        {
          path: `handlers/ts/${kebab}.stub.handler.ts`,
          content: handlerCode,
        },
      ];

      if (normalizedInput.actions) {
        const testCode = buildConformanceTest(normalizedInput);
        files.push({
          path: `tests/conformance/${kebab}.stub.conformance.test.ts`,
          content: testCode,
        });
      }

      return complete(createProgram(), 'ok', {
        files,
        filesGenerated: files.length,
      }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
    }
  },

  preview(input: Record<string, unknown>) {
    const conceptName = (input.conceptName as string) || '';

    if (!conceptName || typeof conceptName !== 'string' || conceptName.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'conceptName is required and must not be empty',
      }) as StorageProgram<Result>;
    }

    try {
      const kebab = toKebab(conceptName);
      const handlerCode = buildFunctionalHandlerImpl(input);

      const files: { path: string; content: string }[] = [
        {
          path: `handlers/ts/${kebab}.stub.handler.ts`,
          content: handlerCode,
        },
      ];

      if (input.actions) {
        const testCode = buildConformanceTest(input);
        files.push({
          path: `tests/conformance/${kebab}.stub.conformance.test.ts`,
          content: testCode,
        });
      }

      return complete(createProgram(), 'ok', {
        files,
        wouldWrite: files.length,
        wouldSkip: 0,
      }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
    }
  },
};

export const handlerScaffoldGenHandler = autoInterpret(_handler);
