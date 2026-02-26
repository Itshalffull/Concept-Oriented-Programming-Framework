// ============================================================
// TypeScriptGen Handler
//
// Generate TypeScript skeleton code from a ConceptManifest.
// Produces type definitions, handler interface, transport
// adapter, lite query implementation, and conformance tests.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-gen-${++idCounter}`;
}

/**
 * Map a Clef type name to a TypeScript type string.
 */
function mapType(clefType: string): string {
  switch (clefType) {
    case 'String': return 'string';
    case 'Int': return 'number';
    case 'Float': return 'number';
    case 'Bool': return 'boolean';
    case 'DateTime': return 'string';
    case 'Bytes': return 'Uint8Array';
    default:
      if (clefType.startsWith('list')) return `Array<${mapType(clefType.replace(/^list\s*/, ''))}>`;
      if (clefType.startsWith('option')) return `${mapType(clefType.replace(/^option\s*/, ''))} | null`;
      return 'unknown';
  }
}

/**
 * Convert a concept name to PascalCase for type names.
 */
function toPascalCase(name: string): string {
  return name.replace(/(^|[-_ ])(\w)/g, (_m, _sep, char) => char.toUpperCase());
}

/**
 * Convert a concept name to camelCase for identifiers.
 */
function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export const typeScriptGenHandler: ConceptHandler = {
  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const spec = input.spec as string;
    const manifest = input.manifest as Record<string, unknown>;

    // Validate manifest
    if (!manifest || !manifest.name || (manifest.name as string).trim() === '') {
      return { variant: 'error', message: 'Manifest name is required and cannot be empty' };
    }

    const conceptName = manifest.name as string;
    const pascal = toPascalCase(conceptName);
    const camel = toCamelCase(conceptName);
    const actions = (manifest.actions as Array<Record<string, unknown>>) || [];
    const purpose = (manifest.purpose as string) || '';

    const files: Array<{ path: string; content: string }> = [];

    // 1. Generate type definitions
    const typeLines: string[] = [
      `// Auto-generated types for ${conceptName}`,
      `// ${purpose}`,
      '',
    ];

    for (const action of actions) {
      const actionName = action.name as string;
      const params = (action.params as Array<Record<string, unknown>>) || [];
      const variants = (action.variants as Array<Record<string, unknown>>) || [];

      // Input type
      typeLines.push(`export interface ${pascal}${toPascalCase(actionName)}Input {`);
      for (const param of params) {
        const paramName = param.name as string;
        const paramType = mapType((param.type as string) || 'String');
        typeLines.push(`  ${paramName}: ${paramType};`);
      }
      typeLines.push('}');
      typeLines.push('');

      // Output types for each variant
      for (const variant of variants) {
        const tag = variant.tag as string;
        const fields = (variant.fields as Array<Record<string, unknown>>) || [];
        typeLines.push(`export interface ${pascal}${toPascalCase(actionName)}${toPascalCase(tag)}Output {`);
        typeLines.push(`  variant: '${tag}';`);
        for (const field of fields) {
          const fieldName = field.name as string;
          const fieldType = mapType((field.type as string) || 'String');
          typeLines.push(`  ${fieldName}: ${fieldType};`);
        }
        typeLines.push('}');
        typeLines.push('');
      }
    }

    files.push({
      path: `generated/${camel}/types.ts`,
      content: typeLines.join('\n'),
    });

    // 2. Generate handler interface
    const handlerLines: string[] = [
      `// Auto-generated handler interface for ${conceptName}`,
      `import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';`,
      '',
      `export interface ${pascal}Handler extends ConceptHandler {`,
    ];

    for (const action of actions) {
      const actionName = action.name as string;
      handlerLines.push(`  ${actionName}(input: Record<string, unknown>, storage: ConceptStorage): Promise<{ variant: string; [key: string]: unknown }>;`);
    }

    handlerLines.push('}');
    handlerLines.push('');

    files.push({
      path: `generated/${camel}/handler.ts`,
      content: handlerLines.join('\n'),
    });

    // 3. Generate transport adapter
    const adapterLines: string[] = [
      `// Auto-generated transport adapter for ${conceptName}`,
      `import type { ConceptHandler, ConceptStorage, ActionInvocation, ActionCompletion } from '../../kernel/src/types.js';`,
      '',
      `export function create${pascal}Adapter(handler: ConceptHandler, storage: ConceptStorage) {`,
      `  return {`,
      `    async dispatch(invocation: ActionInvocation): Promise<ActionCompletion> {`,
      `      const actionFn = handler[invocation.action];`,
      `      if (!actionFn) {`,
      `        return {`,
      `          id: invocation.id,`,
      `          concept: '${conceptName}',`,
      `          action: invocation.action,`,
      `          input: invocation.input,`,
      `          variant: 'error',`,
      `          output: { message: \`Unknown action: \${invocation.action}\` },`,
      `          flow: invocation.flow,`,
      `          timestamp: new Date().toISOString(),`,
      `        };`,
      `      }`,
      `      const result = await actionFn(invocation.input, storage);`,
      `      const { variant, ...output } = result;`,
      `      return {`,
      `        id: invocation.id,`,
      `        concept: '${conceptName}',`,
      `        action: invocation.action,`,
      `        input: invocation.input,`,
      `        variant,`,
      `        output,`,
      `        flow: invocation.flow,`,
      `        timestamp: new Date().toISOString(),`,
      `      };`,
      `    },`,
      `  };`,
      `}`,
      '',
    ];

    files.push({
      path: `generated/${camel}/adapter.ts`,
      content: adapterLines.join('\n'),
    });

    // 4. Generate lite query implementation
    const queryLines: string[] = [
      `// Auto-generated lite query protocol for ${conceptName}`,
      `import type { ConceptStorage } from '../../kernel/src/types.js';`,
      '',
      `export function create${pascal}Query(storage: ConceptStorage) {`,
      `  return {`,
      `    async find(relation: string, criteria?: Record<string, unknown>) {`,
      `      return storage.find(relation, criteria);`,
      `    },`,
      `    async get(relation: string, key: string) {`,
      `      return storage.get(relation, key);`,
      `    },`,
      `  };`,
      `}`,
      '',
    ];

    files.push({
      path: `generated/${camel}/query.ts`,
      content: queryLines.join('\n'),
    });

    // 5. Generate conformance tests from invariants
    const invariants = (manifest.invariants as Array<Record<string, unknown>>) || [];
    const testLines: string[] = [
      `// Auto-generated conformance tests for ${conceptName}`,
      `import { describe, it, expect } from 'vitest';`,
      '',
      `describe('${conceptName} conformance', () => {`,
    ];

    if (invariants.length === 0) {
      testLines.push(`  it('has no invariants to test', () => {`);
      testLines.push(`    expect(true).toBe(true);`);
      testLines.push(`  });`);
    } else {
      for (let i = 0; i < invariants.length; i++) {
        testLines.push(`  it('satisfies invariant ${i + 1}', () => {`);
        testLines.push(`    // TODO: implement invariant check`);
        testLines.push(`    expect(true).toBe(true);`);
        testLines.push(`  });`);
      }
    }

    testLines.push('});');
    testLines.push('');

    files.push({
      path: `generated/${camel}/conformance.test.ts`,
      content: testLines.join('\n'),
    });

    // Store the generated output
    const id = nextId();
    await storage.put('type-script-gen', id, {
      id,
      spec,
      conceptName,
      fileCount: files.length,
      filePaths: JSON.stringify(files.map(f => f.path)),
      generatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', files };
  },

  async register(_input: Record<string, unknown>, _storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'TypeScriptGen',
      inputKind: 'ConceptManifest',
      outputKind: 'TypeScriptSource',
      capabilities: ['types', 'handler', 'adapter', 'conformance-tests'],
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptGenCounter(): void {
  idCounter = 0;
}
