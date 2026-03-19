// @migrated dsl-constructs 2026-03-18
// ============================================================
// SuiteScaffoldGen — Suite manifest (suite.yaml) scaffold generator
// See architecture doc Section 7, Section 10.1
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toKebab(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

function buildSuiteYaml(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'my-suite';
  const version = (input.version as string) || '0.1.0';
  const description = (input.description as string) || `The ${name} suite.`;
  const concepts = (input.concepts as string[]) || [];
  const syncs = (input.syncs as Array<{ name: string; tier: string }>) || [];
  const dependencies = (input.dependencies as string[]) || [];
  const isDomain = (input.isDomain as boolean) || false;
  const lines: string[] = ['suite:', `  name: ${name}`, `  version: ${version}`, `  description: >`, `    ${description}`, ''];
  if (concepts.length > 0) { lines.push('concepts:'); for (const c of concepts) { const kebab = toKebab(c); lines.push(`  ${c}:`, `    spec: ./${kebab}.concept`, `    params:`, `      T: { as: ${kebab}-ref, description: "Reference to a ${c}" }`); } lines.push(''); }
  if (syncs.length > 0) { const grouped: Record<string, Array<{ name: string }>> = {}; for (const s of syncs) { const tier = s.tier || 'recommended'; if (!grouped[tier]) grouped[tier] = []; grouped[tier].push(s); } lines.push('syncs:'); for (const tier of ['required', 'recommended', 'integration']) { if (!grouped[tier]) continue; lines.push(`  ${tier}:`); for (const s of grouped[tier]) { const kebab = toKebab(s.name); lines.push(`    - path: ./syncs/${kebab}.sync`, `      name: ${s.name}`, `      description: >`, `        ${s.name} synchronization rule.`); } } lines.push(''); } else { lines.push('syncs:', '  required: []', '  recommended: []', ''); }
  if (dependencies.length > 0) { lines.push('dependencies:'); for (const dep of dependencies) lines.push(`  - ${dep}: ">=0.1.0"`); } else { lines.push('dependencies: []'); }
  if (isDomain) { lines.push('', 'infrastructure:', '  transports: []', '  storage: []', '  deployTemplates: []'); }
  lines.push('');
  return lines.join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SuiteScaffoldGen', inputKind: 'SuiteConfig', outputKind: 'SuiteManifest', capabilities: JSON.stringify(['suite-yaml', 'directory-structure']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'my-suite';
    if (!name || typeof name !== 'string') { const p = createProgram(); return complete(p, 'error', { message: 'Suite name is required' }) as StorageProgram<Result>; }
    try {
      const suiteYaml = buildSuiteYaml(input);
      const concepts = (input.concepts as string[]) || [];
      const files: { path: string; content: string }[] = [{ path: `suites/${name}/suite.stub.yaml`, content: suiteYaml }];
      for (const c of concepts) { const kebab = toKebab(c); files.push({ path: `suites/${name}/${kebab}.stub.concept`, content: `concept ${c} [T] {\n\n  purpose {\n    TODO: Describe the purpose of ${c}.\n  }\n\n  state {\n    items: set T\n  }\n\n  actions {\n    action create(name: String) {\n      -> ok(item: T) { Item created. }\n      -> error(message: String) { Creation failed. }\n    }\n  }\n}\n` }); }
      files.push({ path: `suites/${name}/syncs/.gitkeep`, content: '' });
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },

  preview(input: Record<string, unknown>) { return _handler.generate(input); },
};

export const suiteScaffoldGenHandler = autoInterpret(_handler);
