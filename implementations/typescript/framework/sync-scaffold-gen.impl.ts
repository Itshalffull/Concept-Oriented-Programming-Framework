// ============================================================
// SyncScaffoldGen — Sync rule (.sync) scaffold generator
//
// Generates well-formed .sync files from provided inputs:
// name, trigger (when clause), conditions (where clause),
// and effect (then clause).
//
// See architecture doc:
//   - Section 5: Synchronization rules
//   - Section 5.1: Trigger patterns (when clause)
//   - Section 5.2: Guard conditions (where clause)
//   - Section 5.3: Effect actions (then clause)
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface SyncTrigger {
  concept: string;
  action: string;
  params?: Array<{ field: string; var: string }>;
  variant?: string;
  resultParams?: Array<{ field: string; var: string }>;
}

interface SyncCondition {
  type: 'bind' | 'query' | 'any' | 'not' | 'compare';
  expression: string;
}

interface SyncEffect {
  concept: string;
  action: string;
  params: Array<{ field: string; value: string }>;
}

function buildSyncSpec(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MySync';
  const tier = (input.tier as string) || 'recommended';
  const purpose = (input.purpose as string) || `TODO: Describe the purpose of ${name}.`;
  const eager = (input.eager as boolean) !== false;
  const trigger = input.trigger as SyncTrigger | undefined;
  const conditions = (input.conditions as SyncCondition[]) || [];
  const effects = (input.effects as SyncEffect[]) || [];

  const annotation = eager ? ' [eager]' : ` [${tier}]`;

  const lines: string[] = [
    `# ${name} — sync rule`,
    `#`,
    `# ${purpose}`,
    '',
    `sync ${name}${annotation}`,
    `  purpose { ${purpose} }`,
  ];

  // When clause
  if (trigger) {
    lines.push('when {');
    const paramParts: string[] = [];
    if (trigger.params) {
      for (const p of trigger.params) {
        paramParts.push(`    ${p.field}: ${p.var}`);
      }
    }
    const paramsBlock = paramParts.length > 0
      ? `[\n${paramParts.join(';\n')}\n  ]`
      : '[]';

    const resultParts: string[] = [];
    if (trigger.resultParams) {
      for (const p of trigger.resultParams) {
        resultParts.push(`${p.field}: ${p.value || p.var}`);
      }
    }
    const resultBlock = resultParts.length > 0
      ? ` => ${trigger.variant || 'ok'}(${resultParts.join(', ')})`
      : trigger.variant
        ? ` => ${trigger.variant}()`
        : '';

    lines.push(`  ${trigger.concept}/${trigger.action}: ${paramsBlock}${resultBlock}`);
    lines.push('}');
  } else {
    // Default trigger template
    lines.push('when {');
    lines.push('  SourceConcept/action: [');
    lines.push('    field: ?var');
    lines.push('  ] => ok(result: ?value)');
    lines.push('}');
  }

  // Where clause
  if (conditions.length > 0) {
    lines.push('where {');
    for (const cond of conditions) {
      lines.push(`  ${cond.expression}`);
    }
    lines.push('}');
  }

  // Then clause
  if (effects.length > 0) {
    lines.push('then {');
    for (const effect of effects) {
      const effectParams = effect.params.map(p => `    ${p.field}: ${p.value}`);
      lines.push(`  ${effect.concept}/${effect.action}: [`);
      lines.push(effectParams.join(';\n'));
      lines.push('  ]');
    }
    lines.push('}');
  } else {
    lines.push('then {');
    lines.push('  TargetConcept/action: [');
    lines.push('    field: ?var');
    lines.push('  ]');
    lines.push('}');
  }

  lines.push('');
  return lines.join('\n');
}

export const syncScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SyncScaffoldGen',
      inputKind: 'SyncConfig',
      outputKind: 'SyncSpec',
      capabilities: JSON.stringify(['sync-spec', 'when-clause', 'where-clause', 'then-clause']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'MySync';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Sync name is required' };
    }

    try {
      const syncSpec = buildSyncSpec(input);
      const kebab = toKebab(name);

      const files: { path: string; content: string }[] = [
        { path: `${kebab}.sync`, content: syncSpec },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
