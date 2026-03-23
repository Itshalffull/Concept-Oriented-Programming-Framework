// @clef-handler style=functional concept=SyncScaffoldGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyncScaffoldGen — Sync rule (.sync) scaffold generator
// See architecture doc Sections 5.1–5.3
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toKebab(name: string): string { return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(); }

interface SyncTrigger { concept: string; action: string; params?: Array<{ field: string; var: string }>; variant?: string; resultParams?: Array<{ field: string; var: string; value?: string }>; }
interface SyncCondition { type: 'bind' | 'query' | 'any' | 'not' | 'compare' | 'filter' | 'guard'; expression: string; }
interface SyncEffect { concept: string; action: string; params: Array<{ field: string; value: string }>; }

function buildThenBlock(effects: SyncEffect[], lines: string[]): void {
  lines.push('then {');
  for (const effect of effects) { const effectParams = effect.params.map(p => `    ${p.field}: ${p.value}`); lines.push(`  ${effect.concept}/${effect.action}: [`, effectParams.join(';\n'), '  ]'); }
  lines.push('}');
}

function buildSyncSpec(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MySync';
  const tier = (input.tier as string) || 'recommended';
  const purpose = (input.purpose as string) || `TODO: Describe the purpose of ${name}.`;
  const eager = (input.eager as boolean) !== false;
  const trigger = input.trigger as SyncTrigger | undefined;
  const conditions = (input.conditions as SyncCondition[]) || [];
  const effects = (input.effects as SyncEffect[]) || [];
  const thenBlocks = (input.thenBlocks as SyncEffect[][]) || [];
  const annotation = eager ? ' [eager]' : ` [${tier}]`;
  const lines: string[] = [`# ${name} — sync rule`, '#', `# ${purpose}`, '', `sync ${name}${annotation}`, `  purpose: "${purpose}"`];
  if (trigger) { lines.push('when {'); const paramParts: string[] = []; if (trigger.params) for (const p of trigger.params) paramParts.push(`    ${p.field}: ${p.var}`); const paramsBlock = paramParts.length > 0 ? `[\n${paramParts.join(';\n')}\n  ]` : '[]'; const resultParts: string[] = []; if (trigger.resultParams) for (const p of trigger.resultParams) resultParts.push(`${p.field}: ${p.value || p.var}`); const resultBlock = resultParts.length > 0 ? ` => ${trigger.variant || 'ok'}(${resultParts.join(', ')})` : trigger.variant ? ` => ${trigger.variant}()` : ''; lines.push(`  ${trigger.concept}/${trigger.action}: ${paramsBlock}${resultBlock}`, '}'); } else { lines.push('when {', '  SourceConcept/action: [', '    field: ?var', '  ] => ok(result: ?value)', '}'); }
  if (conditions.length > 0) { lines.push('where {'); for (const cond of conditions) { if (cond.type === 'filter') lines.push(`  filter(${cond.expression})`); else if (cond.type === 'guard') lines.push(`  guard(${cond.expression})`); else lines.push(`  ${cond.expression}`); } lines.push('}'); }
  if (thenBlocks.length > 0) { for (const block of thenBlocks) buildThenBlock(block, lines); } else if (effects.length > 0) { buildThenBlock(effects, lines); } else { lines.push('then {', '  TargetConcept/action: [', '    field: ?var', '  ]', '}'); }
  lines.push('');
  return lines.join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SyncScaffoldGen', inputKind: 'SyncConfig', outputKind: 'SyncSpec', capabilities: JSON.stringify(['sync-spec', 'when-clause', 'where-clause', 'then-clause', 'filter-condition', 'guard-condition', 'multi-then']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MySync';
    if (!name || typeof name !== 'string') { const p = createProgram(); return complete(p, 'error', { message: 'Sync name is required' }) as StorageProgram<Result>; }
    try {
      const syncSpec = buildSyncSpec(input);
      const files = [{ path: `syncs/${toKebab(name)}.stub.sync`, content: syncSpec }];
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },

  preview(input: Record<string, unknown>) { return _handler.generate(input); },
};

export const syncScaffoldGenHandler = autoInterpret(_handler);
