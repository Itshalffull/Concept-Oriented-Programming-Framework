// @migrated dsl-constructs 2026-03-18
// ============================================================
// SwiftGen Concept Implementation
//
// Generates Swift skeleton code from a ConceptManifest.
// See architecture doc Section 10.1 for type mapping details.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptManifest, ResolvedType, InvariantValue } from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

// --- All pure helper functions unchanged ---

function resolvedTypeToSwift(t: ResolvedType): string {
  switch (t.kind) { case 'primitive': return primitiveToSwift(t.primitive); case 'param': return 'String'; case 'set': return `Set<${resolvedTypeToSwift(t.inner)}>`; case 'list': return `[${resolvedTypeToSwift(t.inner)}]`; case 'option': return `${resolvedTypeToSwift(t.inner)}?`; case 'map': return `[${resolvedTypeToSwift(t.keyType)}: ${resolvedTypeToSwift(t.inner)}]`; case 'record': { const fields = t.fields.map(f => `${camelCase(f.name)}: ${resolvedTypeToSwift(f.type)}`); return `(${fields.join(', ')})`; } }
}

function primitiveToSwift(name: string): string {
  switch (name) { case 'String': return 'String'; case 'Int': return 'Int'; case 'Float': return 'Double'; case 'Bool': return 'Bool'; case 'Bytes': return 'Data'; case 'DateTime': return 'Date'; case 'ID': return 'String'; default: return 'Any'; }
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function camelCase(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }

function generateTypesFile(manifest: ConceptManifest): string {
  const lines: string[] = [`// generated: ${manifest.name}/Types.stub.swift`, '', 'import Foundation', ''];
  for (const action of manifest.actions) {
    lines.push(`struct ${manifest.name}${capitalize(action.name)}Input: Codable {`);
    for (const p of action.params) lines.push(`    let ${camelCase(p.name)}: ${resolvedTypeToSwift(p.type)}`);
    lines.push(`}`, '');
    lines.push(`enum ${manifest.name}${capitalize(action.name)}Output: Codable {`);
    for (const v of action.variants) { if (v.fields.length === 0) lines.push(`    case ${camelCase(v.tag)}`); else lines.push(`    case ${camelCase(v.tag)}(${v.fields.map(f => `${camelCase(f.name)}: ${resolvedTypeToSwift(f.type)}`).join(', ')})`); }
    lines.push(`}`, '');
  }
  return lines.join('\n');
}

function generateHandlerFile(manifest: ConceptManifest): string {
  const lines: string[] = [`// generated: ${manifest.name}/Handler.stub.swift`, '', 'import Foundation', '', `protocol ${manifest.name}Handler {`];
  for (const action of manifest.actions) lines.push(`    func ${camelCase(action.name)}(input: ${manifest.name}${capitalize(action.name)}Input, storage: ConceptStorage) async throws -> ${manifest.name}${capitalize(action.name)}Output`, '');
  lines.push(`}`);
  return lines.join('\n');
}

function generateAdapterFile(manifest: ConceptManifest): string {
  return `// generated: ${manifest.name}/Adapter.stub.swift\n\nimport Foundation\n\nclass ${manifest.name}Adapter: ConceptTransport {\n    // TODO: implement\n}\n`;
}

function generateDslRuntimeFile(): string { return `// generated: StorageProgramDSL.stub.swift\nimport Foundation\n// StorageProgram DSL for Swift\n`; }

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'SwiftGen', inputKind: 'ConceptManifest', outputKind: 'SwiftSource', capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifest = input.manifest as ConceptManifest;
    if (!manifest || !manifest.name) { const p = createProgram(); return complete(p, 'error', { message: 'Invalid manifest: missing concept name' }) as StorageProgram<Result>; }
    try {
      const files = [
        { path: `${manifest.name}/Types.stub.swift`, content: generateTypesFile(manifest) },
        { path: `${manifest.name}/Handler.stub.swift`, content: generateHandlerFile(manifest) },
        { path: `${manifest.name}/Adapter.stub.swift`, content: generateAdapterFile(manifest) },
        { path: `StorageProgramDSL.stub.swift`, content: generateDslRuntimeFile() },
      ];
      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },
};

export const swiftGenHandler = autoInterpret(_handler);
