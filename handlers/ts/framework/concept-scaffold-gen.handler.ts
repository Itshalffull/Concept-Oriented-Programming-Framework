// ============================================================
// ConceptScaffoldGen — Concept spec (.concept) scaffold generator
//
// Generates well-formed .concept files from provided inputs:
// name, type parameters, purpose, state fields, and actions.
//
// See architecture doc:
//   - Section 2: Concept specifications
//   - Section 2.1: State declarations
//   - Section 2.2: Action signatures and variants
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface StateField {
  name: string;
  type: string;
  mapping?: boolean; // T -> Type (mapping) vs set T
}

interface ActionDef {
  name: string;
  params: Array<{ name: string; type: string }>;
  variants?: Array<{
    name: string;
    params: Array<{ name: string; type: string }>;
    description?: string;
  }>;
  description?: string;
}

function buildConceptSpec(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyConcept';
  const typeParam = (input.typeParam as string) || 'T';
  const purpose = (input.purpose as string) || `TODO: Describe the purpose of ${name}.`;
  const category = input.category as string;
  const visibility = (input.visibility as string) || 'public';
  const stateFields = (input.stateFields as StateField[]) || [
    { name: 'items', type: `set ${typeParam}` },
  ];
  const actions = (input.actions as ActionDef[]) || [
    {
      name: 'create',
      params: [{ name: 'name', type: 'String' }],
      variants: [
        { name: 'ok', params: [{ name: 'item', type: typeParam }], description: 'Item created.' },
        { name: 'error', params: [{ name: 'message', type: 'String' }], description: 'Creation failed.' },
      ],
    },
  ];
  const invariants = (input.invariants as string[]) || [];

  const lines: string[] = [];

  // Annotations
  if (category) {
    lines.push(`@category("${category}")`);
  }
  lines.push(`@visibility("${visibility}")`);

  // Concept declaration
  lines.push(`concept ${name} [${typeParam}] {`);
  lines.push('');

  // Purpose
  lines.push('  purpose {');
  for (const line of purpose.split('\n')) {
    lines.push(`    ${line.trim()}`);
  }
  lines.push('  }');
  lines.push('');

  // State
  lines.push('  state {');
  for (const field of stateFields) {
    if (field.mapping) {
      lines.push(`    ${field.name}: ${typeParam} -> ${field.type}`);
    } else {
      lines.push(`    ${field.name}: ${field.type}`);
    }
  }
  lines.push('  }');
  lines.push('');

  // Actions
  lines.push('  actions {');
  for (const action of actions) {
    const paramStr = action.params.map(p => `${p.name}: ${p.type}`).join(', ');
    lines.push(`    action ${action.name}(${paramStr}) {`);
    if (action.description) {
      lines.push('      description {');
      lines.push(`        ${action.description}`);
      lines.push('      }');
    }
    const variants = action.variants || [
      { name: 'ok', params: [], description: 'Success.' },
      { name: 'error', params: [{ name: 'message', type: 'String' }], description: 'Failure.' },
    ];
    for (const v of variants) {
      const vParamStr = v.params.map(p => `${p.name}: ${p.type}`).join(', ');
      lines.push(`      -> ${v.name}(${vParamStr}) {`);
      lines.push(`        ${v.description || `${v.name} variant.`}`);
      lines.push('      }');
    }
    lines.push('    }');
    lines.push('');
  }

  // register() action
  lines.push('    action register() {');
  lines.push(`      -> ok(name: String, inputKind: String, outputKind: String, capabilities: list String) {`);
  lines.push('        Return static metadata for discovery.');
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');

  // Invariants
  if (invariants.length > 0) {
    lines.push('');
    lines.push('  invariant {');
    for (const inv of invariants) {
      lines.push(`    ${inv}`);
    }
    lines.push('  }');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

export const conceptScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'ConceptScaffoldGen',
      inputKind: 'ConceptConfig',
      outputKind: 'ConceptSpec',
      capabilities: JSON.stringify(['concept-spec', 'state-fields', 'actions', 'invariants']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'MyConcept';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Concept name is required' };
    }

    try {
      const conceptSpec = buildConceptSpec(input);
      const kebab = toKebab(name);

      const files: { path: string; content: string }[] = [
        { path: `concepts/${kebab}.concept`, content: conceptSpec },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await conceptScaffoldGenHandler.generate!(input, storage);
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
