// @clef-handler style=functional concept=SwiftGen
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
import type { ConceptManifest, ResolvedType, InvariantValue, InvariantStep } from '../../../runtime/types.js';

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

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) return null;
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName}/ConformanceTests.stub.swift`, '',
    'import XCTest', '@testable import Clef', '',
    `final class ${conceptName}ConformanceTests: XCTestCase {`, '',
  ];

  let invNum = 0;
  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];
    // Skip invariants with no operational steps (e.g., 'always' universal properties)
    if (inv.setup.length === 0 && inv.assertions.length === 0) continue;
    invNum++;

    lines.push(`    /// ${inv.description}`);
    lines.push(`    func testInvariant${invNum}() async throws {`);
    lines.push(`        let storage = InMemoryStorage()`);
    lines.push(`        let handler = create${conceptName}Handler()`);
    lines.push('');

    for (const fv of inv.freeVariables) {
      lines.push(`        var ${camelCase(fv.name)} = "${fv.testValue}"`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    let stepNum = 1;
    lines.push(`        // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateSwiftStepCode(step, stepNum));
      stepNum++;
    }
    lines.push('');

    lines.push(`        // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateSwiftStepCode(step, stepNum));
      stepNum++;
    }

    lines.push(`    }`);
    lines.push('');
  }

  if (invNum === 0) return null;
  lines.push(`}`);
  return lines.join('\n');
}

function invariantValueToSwiftExpr(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal': {
      const val = v.value;
      if (typeof val === 'string') return `"${val}"`;
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      return String(val);
    }
    case 'variable':
      return camelCase(v.name);
    case 'record': {
      const fields = v.fields.map(f => `${camelCase(f.name)}: ${invariantValueToSwiftExpr(f.value)}`);
      return `/* struct(${fields.join(', ')}) */`;
    }
    case 'list': {
      const items = v.items.map(item => invariantValueToSwiftExpr(item));
      return `[${items.join(', ')}]`;
    }
  }
}

function invariantValueToComment(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal': return JSON.stringify(v.value);
    case 'variable': return v.name;
    case 'record': return `{ ${v.fields.map(f => `${f.name}: ${invariantValueToComment(f.value)}`).join(', ')} }`;
    case 'list': return `[${v.items.map(item => invariantValueToComment(item)).join(', ')}]`;
  }
}

function generateSwiftStepCode(step: InvariantStep, stepNum: number): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;
  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToComment(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToComment(a.value)}`).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  const inputFields = step.inputs.map(a => `${camelCase(a.name)}: ${invariantValueToSwiftExpr(a.value)}`).join(', ');
  lines.push(`        let ${varName} = try await handler.${camelCase(step.action)}(`);
  lines.push(`            input: ${capitalize(step.action)}Input(${inputFields}),`);
  lines.push(`            storage: storage`);
  lines.push(`        )`);

  const variantCase = camelCase(step.expectedVariant);
  if (step.expectedOutputs.length > 0) {
    const bindings = step.expectedOutputs.map(o => `let ${camelCase(o.name)}`).join(', ');
    lines.push(`        guard case .${variantCase}(${bindings}) = ${varName} else {`);
    lines.push(`            XCTFail("Expected ${step.expectedVariant}, got \\(${varName})")`);
    lines.push(`            return`);
    lines.push(`        }`);
    for (const out of step.expectedOutputs) {
      const expected = invariantValueToSwiftExpr(out.value);
      lines.push(`        XCTAssertEqual(${camelCase(out.name)}, ${expected})`);
    }
  } else {
    lines.push(`        guard case .${variantCase} = ${varName} else {`);
    lines.push(`            XCTFail("Expected ${step.expectedVariant}, got \\(${varName})")`);
    lines.push(`            return`);
    lines.push(`        }`);
  }

  return lines;
}

function generateDslRuntimeFile(): string {
  return `// generated: StorageProgramDSL.stub.swift
//
// StorageProgram DSL — Free Monad for Concept Handlers (Swift)
// Provides typed lenses/optics, effect tracking, algebraic effects,
// transport effects, and functorial mapping for render programs.

import Foundation

// MARK: - Lens Types

public enum LensSegment: Codable, Equatable {
    case relation(name: String)
    case key(value: String)
    case field(name: String)
}

public struct StateLens: Codable, Equatable {
    public var segments: [LensSegment]
    public var sourceType: String
    public var focusType: String

    public static func relation(_ name: String) -> StateLens {
        StateLens(
            segments: [.relation(name: name)],
            sourceType: "store",
            focusType: "relation<\\(name)>"
        )
    }

    public func at(_ key: String) -> StateLens {
        var copy = self
        copy.segments.append(.key(value: key))
        copy.focusType = "record"
        return copy
    }

    public func field(_ name: String) -> StateLens {
        var copy = self
        copy.segments.append(.field(name: name))
        copy.focusType = name
        return copy
    }

    public func compose(_ inner: StateLens) -> StateLens {
        var copy = self
        copy.segments.append(contentsOf: inner.segments)
        copy.focusType = inner.focusType
        return copy
    }

    public var relationName: String? {
        guard let first = segments.first, case .relation(let name) = first else { return nil }
        return name
    }
}

// MARK: - Effect Set

public struct EffectSet: Codable {
    public var reads: Set<String>
    public var writes: Set<String>
    public var completionVariants: Set<String>
    public var performs: Set<String>

    public init() {
        reads = []
        writes = []
        completionVariants = []
        performs = []
    }

    public func merged(with other: EffectSet) -> EffectSet {
        var result = EffectSet()
        result.reads = reads.union(other.reads)
        result.writes = writes.union(other.writes)
        result.completionVariants = completionVariants.union(other.completionVariants)
        result.performs = performs.union(other.performs)
        return result
    }

    public var purity: Purity {
        if !writes.isEmpty { return .readWrite }
        if !reads.isEmpty { return .readOnly }
        return .pure
    }

    public func validatePurity(declared: Purity) -> String? {
        switch declared {
        case .pure:
            if !reads.isEmpty || !writes.isEmpty {
                return "Declared pure but has storage effects"
            }
        case .readOnly:
            if !writes.isEmpty {
                return "Declared read-only but writes to: \\(writes.sorted().joined(separator: ", "))"
            }
        case .readWrite:
            break
        }
        return nil
    }
}

public enum Purity: String, Codable {
    case pure
    case readOnly
    case readWrite
}

// MARK: - Instruction Types

public enum Instruction: Codable {
    case get(relation: String, key: String, bindAs: String)
    case find(relation: String, criteria: [String: String], bindAs: String)
    case put(relation: String, key: String, value: [String: String])
    case merge(relation: String, key: String, fields: [String: String])
    case del(relation: String, key: String)
    case getLens(lens: StateLens, bindAs: String)
    case putLens(lens: StateLens, value: [String: String])
    case perform(protocol: String, operation: String, payload: [String: String], bindAs: String)
    case pure(value: [String: String])
}

// MARK: - StorageProgram

public struct StorageProgram: Codable {
    public var instructions: [Instruction]
    public var terminated: Bool
    public var effects: EffectSet

    public static func create() -> StorageProgram {
        StorageProgram(instructions: [], terminated: false, effects: EffectSet())
    }

    public mutating func get(relation: String, key: String, bindAs: String) {
        effects.reads.insert(relation)
        instructions.append(.get(relation: relation, key: key, bindAs: bindAs))
    }

    public mutating func put(relation: String, key: String, value: [String: String]) {
        effects.writes.insert(relation)
        instructions.append(.put(relation: relation, key: key, value: value))
    }

    public mutating func getLens(lens: StateLens, bindAs: String) {
        if let rel = lens.relationName { effects.reads.insert(rel) }
        instructions.append(.getLens(lens: lens, bindAs: bindAs))
    }

    public mutating func putLens(lens: StateLens, value: [String: String]) {
        if let rel = lens.relationName { effects.writes.insert(rel) }
        instructions.append(.putLens(lens: lens, value: value))
    }

    public mutating func perform(protocol proto: String, operation: String, payload: [String: String], bindAs: String) {
        effects.performs.insert("\\(proto):\\(operation)")
        instructions.append(.perform(protocol: proto, operation: operation, payload: payload, bindAs: bindAs))
    }

    public mutating func complete(variant: String, output: [String: String]) {
        effects.completionVariants.insert(variant)
        var combined = output
        combined["variant"] = variant
        instructions.append(.pure(value: combined))
        terminated = true
    }

    public func extractCompletionVariants() -> Set<String> {
        var variants = Set<String>()
        for instr in instructions {
            if case .pure(let value) = instr, let v = value["variant"] {
                variants.insert(v)
            }
        }
        return variants
    }

    public func extractPerformSet() -> Set<String> {
        var performs = Set<String>()
        for instr in instructions {
            if case .perform(let proto, let op, _, _) = instr {
                performs.insert("\\(proto):\\(op)")
            }
        }
        return performs
    }
}

// MARK: - Render Program (Functorial Mapping)

public enum RenderInstruction: Codable {
    case token(path: String, value: String)
    case aria(role: String?, label: String?, attributes: [String: String]?)
    case bind(field: String, expr: String)
    case element(name: String, attributes: [String: String]?)
    case focus(strategy: String, target: String?)
    case keyboard(key: String, action: String, modifiers: [String]?)
    case renderPure(value: String)
}

public struct RenderProgram: Codable {
    public var instructions: [RenderInstruction]
    public var terminated: Bool

    public func map(_ transform: (RenderInstruction) -> RenderInstruction) -> RenderProgram {
        RenderProgram(
            instructions: instructions.map(transform),
            terminated: terminated
        )
    }
}
`;
}

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
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${manifest.name}/ConformanceTests.stub.swift`, content: conformanceTest });
      }
      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },
};

export const swiftGenHandler = autoInterpret(_handler);
