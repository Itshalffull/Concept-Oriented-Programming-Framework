// @clef-handler style=functional concept=ConceptScaffoldGen
// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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
  group?: string;    // State group name (e.g., "credentials")
}

interface ActionDef {
  name: string;
  params: Array<{ name: string; type: string }>;
  variants?: Array<{
    name: string;
    params: Array<{ name: string; type: string }>;
    description?: string;
  }>;
  fixtures?: Array<{
    name: string;
    input: Record<string, unknown>;
    expectedVariant?: string;
  }>;
  description?: string;
}

function buildConceptSpec(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyConcept';
  const typeParam = (input.typeParam as string) || 'T';
  const purpose = (input.purpose as string) || `TODO: Describe the purpose of ${name}.`;
  const category = input.category as string;
  const visibility = (input.visibility as string) || 'public';
  const version = input.version as number | undefined;
  const gate = input.gate as boolean | undefined;
  const capabilities = (input.capabilities as string[]) || [];
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
  if (version != null) {
    lines.push(`@version(${version})`);
  }
  if (gate) {
    lines.push('@gate');
  }
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

  // Capabilities
  if (capabilities.length > 0) {
    lines.push('  capabilities {');
    for (const cap of capabilities) {
      lines.push(`    "${cap}"`);
    }
    lines.push('  }');
    lines.push('');
  }

  // State — collect grouped and ungrouped fields
  const ungrouped = stateFields.filter(f => !f.group);
  const grouped = new Map<string, StateField[]>();
  for (const field of stateFields) {
    if (field.group) {
      if (!grouped.has(field.group)) grouped.set(field.group, []);
      grouped.get(field.group)!.push(field);
    }
  }

  lines.push('  state {');
  for (const field of ungrouped) {
    if (field.mapping) {
      lines.push(`    ${field.name}: ${typeParam} -> ${field.type}`);
    } else {
      lines.push(`    ${field.name}: ${field.type}`);
    }
  }
  for (const [groupName, fields] of grouped) {
    lines.push(`    group ${groupName} {`);
    for (const field of fields) {
      if (field.mapping) {
        lines.push(`      ${field.name}: ${typeParam} -> ${field.type}`);
      } else {
        lines.push(`      ${field.name}: ${field.type}`);
      }
    }
    lines.push('    }');
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
    // Fixtures
    const fixtures = action.fixtures || [];
    for (const f of fixtures) {
      const inputStr = Object.entries(f.input)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      const arrow = f.expectedVariant && f.expectedVariant !== 'ok' ? ` -> ${f.expectedVariant}` : '';
      lines.push(`      fixture ${f.name} { ${inputStr} }${arrow}`);
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

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    { let p = createProgram(); p = complete(p, 'ok', { name: 'ConceptScaffoldGen',
      inputKind: 'ConceptConfig',
      outputKind: 'ConceptSpec',
      capabilities: JSON.stringify([
        'concept-spec', 'state-fields', 'state-groups', 'actions', 'invariants',
        'version-annotation', 'gate-annotation', 'capabilities-block',
        'enum-types', 'record-types', 'list-option-wrappers', 'all-primitives',
      ]) }); return p; }
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MyConcept';

    if (!name || typeof name !== 'string') {
      { let p = createProgram(); p = complete(p, 'error', { message: 'Concept name is required' }); return p; }
    }

    try {
      const conceptSpec = buildConceptSpec(input);
      const kebab = toKebab(name);

      const files: { path: string; content: string }[] = [
        { path: `concepts/${kebab}.stub.concept`, content: conceptSpec },
      ];

      { let p = createProgram(); p = complete(p, 'ok', { files, filesGenerated: files.length }); return p; }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      { let p = createProgram(); p = complete(p, 'error', { message, ...(stack ? { stack } : {}) }); return p; }
    }
  },

  preview(input: Record<string, unknown>) {
    // Preview delegates to generate — same logic, just returns what would be written
    const program = _handler.generate(input);
    return program;
  },
};

export const conceptScaffoldGenHandler = autoInterpret(_handler);
