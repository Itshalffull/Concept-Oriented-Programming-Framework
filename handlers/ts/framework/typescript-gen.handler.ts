// @migrated dsl-constructs 2026-03-18
// ============================================================
// TypeScriptGen Concept Implementation
//
// Generates TypeScript skeleton code from a ConceptManifest.
// See architecture doc Section 7.3, Section 10.1.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptManifest, ResolvedType, InvariantSchema, InvariantStep, InvariantValue } from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

// --- All pure helper functions unchanged ---

function resolvedTypeToTS(t: ResolvedType): string {
  switch (t.kind) { case 'primitive': return primitiveToTS(t.primitive); case 'param': return 'string'; case 'set': return `Set<${resolvedTypeToTS(t.inner)}>`; case 'list': return `${resolvedTypeToTS(t.inner)}[]`; case 'option': return `${resolvedTypeToTS(t.inner)} | null`; case 'map': return `Map<${resolvedTypeToTS(t.keyType)}, ${resolvedTypeToTS(t.inner)}>`; case 'record': { const fields = t.fields.map(f => `${f.name}: ${resolvedTypeToTS(f.type)}`); return `{ ${fields.join('; ')} }`; } }
}

function primitiveToTS(name: string): string {
  switch (name) { case 'String': return 'string'; case 'Int': return 'number'; case 'Float': return 'number'; case 'Bool': return 'boolean'; case 'Bytes': return 'Buffer'; case 'DateTime': return 'Date'; case 'ID': return 'string'; default: return 'unknown'; }
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateTypesFile(manifest: ConceptManifest): string {
  const lines: string[] = [`// generated: ${manifest.name.toLowerCase()}.types.stub.ts`, ''];
  for (const action of manifest.actions) {
    lines.push(`export interface ${manifest.name}${capitalize(action.name)}Input {`);
    for (const p of action.params) lines.push(`  ${p.name}: ${resolvedTypeToTS(p.type)};`);
    lines.push(`}`, '');
    const variantTypes = action.variants.map(v => { const fields = v.fields.map(p => `${p.name}: ${resolvedTypeToTS(p.type)}`); const fieldStr = fields.length > 0 ? `; ${fields.join('; ')}` : ''; return `{ variant: "${v.tag}"${fieldStr} }`; });
    lines.push(`export type ${manifest.name}${capitalize(action.name)}Output =`);
    for (let i = 0; i < variantTypes.length; i++) lines.push(`${i === 0 ? '  ' : '  | '}${variantTypes[i]}${i < variantTypes.length - 1 ? '' : ';'}`);
    lines.push('');
  }
  return lines.join('\n');
}

function generateHandlerFile(manifest: ConceptManifest): string {
  const lowerName = manifest.name.toLowerCase();
  const lines: string[] = [`// generated: ${lowerName}.handler.stub.ts`, `import type { ConceptStorage } from "@clef/runtime";`, `import type * as T from "./${lowerName}.types";`, '', `export interface ${manifest.name}Handler {`];
  for (const action of manifest.actions) lines.push(`  ${action.name}(input: T.${manifest.name}${capitalize(action.name)}Input, storage: ConceptStorage):`, `    Promise<T.${manifest.name}${capitalize(action.name)}Output>;`);
  lines.push(`}`);
  return lines.join('\n');
}

function generateAdapterFile(manifest: ConceptManifest): string {
  const lowerName = manifest.name.toLowerCase();
  return `// generated: ${lowerName}.adapter.stub.ts\n// TODO: implement adapter\n`;
}

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) return null;
  return `// generated: ${manifest.name.toLowerCase()}.conformance.stub.test.ts\n// TODO: implement conformance tests\n`;
}

function generateDslRuntimeFile(): string { return `// generated: storage-program.dsl.stub.ts\n// StorageProgram DSL — see runtime/storage-program.ts\n`; }

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'TypeScriptGen', inputKind: 'ConceptManifest', outputKind: 'TypeScriptSource', capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifest = input.manifest as ConceptManifest;
    if (!manifest || !manifest.name) { const p = createProgram(); return complete(p, 'error', { message: 'Invalid manifest: missing concept name' }) as StorageProgram<Result>; }
    try {
      const lowerName = manifest.name.toLowerCase();
      const files: { path: string; content: string }[] = [
        { path: `${lowerName}.types.stub.ts`, content: generateTypesFile(manifest) },
        { path: `${lowerName}.handler.stub.ts`, content: generateHandlerFile(manifest) },
        { path: `${lowerName}.adapter.stub.ts`, content: generateAdapterFile(manifest) },
        { path: `storage-program.dsl.stub.ts`, content: generateDslRuntimeFile() },
      ];
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) files.push({ path: `${lowerName}.conformance.stub.test.ts`, content: conformanceTest });
      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },
};

export const typescriptGenHandler = autoInterpret(_handler);
