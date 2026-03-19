// ============================================================
// SwiftGen Concept Implementation
//
// Generates Swift skeleton code from a ConceptManifest.
// Scoped to native iOS platform API concepts (CoreData,
// HealthKit, ARKit, CoreML). React Native covers everything
// else.
//
// Type mapping table:
//   String   → String       Int      → Int
//   Float    → Double       Bool     → Bool
//   Bytes    → Data         DateTime → Date
//   ID       → String       option T → T?
//   set T    → Set<T>       list T   → [T]
//   A -> B   → [A: B]       params   → String (opaque)
//
// Generated files:
//   - Types.swift        (struct definitions for inputs/outputs)
//   - Handler.swift      (protocol with async methods)
//   - Adapter.swift      (transport adapter: deser/dispatch/ser)
//   - ConformanceTests.swift (XCTest cases from invariants)
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ResolvedType,
  ActionSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

// --- ResolvedType → Swift mapping ---

function resolvedTypeToSwift(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToSwift(t.primitive);
    case 'param':
      return 'String'; // type parameters are opaque string IDs on wire
    case 'set':
      return `Set<${resolvedTypeToSwift(t.inner)}>`;
    case 'list':
      return `[${resolvedTypeToSwift(t.inner)}]`;
    case 'option':
      return `${resolvedTypeToSwift(t.inner)}?`;
    case 'map':
      return `[${resolvedTypeToSwift(t.keyType)}: ${resolvedTypeToSwift(t.inner)}]`;
    case 'record': {
      // Inline records are mapped to named structs elsewhere; for inline use, tuple-like
      const fields = t.fields.map(f => `${camelCase(f.name)}: ${resolvedTypeToSwift(f.type)}`);
      return `(${fields.join(', ')})`;
    }
  }
}

function primitiveToSwift(name: string): string {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'Int';
    case 'Float': return 'Double';
    case 'Bool': return 'Bool';
    case 'Bytes': return 'Data';
    case 'DateTime': return 'Date';
    case 'ID': return 'String';
    default: return 'Any';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function camelCase(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// --- InvariantValue → Swift literal ---

function invariantValueToSwift(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal': {
      const val = v.value;
      if (typeof val === 'string') return `"${val}"`;
      return `${val}`;
    }
    case 'variable':
      return `${camelCase(v.name)}`;
    case 'record': {
      const entries = v.fields.map(f => `"${f.name}": ${invariantValueToSwift(f.value)}`);
      return `[${entries.join(', ')}]`;
    }
    case 'list': {
      const items = v.items.map(item => invariantValueToSwift(item));
      return `[${items.join(', ')}]`;
    }
  }
}

// --- Codable conformance helpers ---

function needsFoundation(manifest: ConceptManifest): boolean {
  return manifest.actions.some(a =>
    a.params.some(p => typeNeedsPrimitive(p.type, 'DateTime') || typeNeedsPrimitive(p.type, 'Bytes')) ||
    a.variants.some(v => v.fields.some(f => typeNeedsPrimitive(f.type, 'DateTime') || typeNeedsPrimitive(f.type, 'Bytes')))
  );
}

function typeNeedsPrimitive(t: ResolvedType, prim: string): boolean {
  if (t.kind === 'primitive') return t.primitive === prim;
  if (t.kind === 'list' || t.kind === 'option' || t.kind === 'set') return typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'map') return typeNeedsPrimitive(t.keyType, prim) || typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'record') return t.fields.some(f => typeNeedsPrimitive(f.type, prim));
  return false;
}

// --- Type Definitions File (Types.swift) ---

function generateTypesFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName}/Types.stub.swift`,
    '',
    'import Foundation',
    '',
  ];

  for (const action of manifest.actions) {
    // Input struct
    const inputStructName = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`struct ${inputStructName}: Codable {`);
    for (const p of action.params) {
      lines.push(`    let ${camelCase(p.name)}: ${resolvedTypeToSwift(p.type)}`);
    }
    lines.push(`}`);
    lines.push('');

    // Output enum (tagged union)
    const outputEnumName = `${conceptName}${capitalize(action.name)}Output`;
    lines.push(`enum ${outputEnumName}: Codable {`);

    for (const v of action.variants) {
      const variantName = camelCase(v.tag);
      if (v.fields.length === 0) {
        lines.push(`    case ${variantName}`);
      } else {
        const fields = v.fields.map(f => `${camelCase(f.name)}: ${resolvedTypeToSwift(f.type)}`);
        lines.push(`    case ${variantName}(${fields.join(', ')})`);
      }
    }

    lines.push('');

    // CodingKeys for tagged union
    lines.push(`    enum CodingKeys: String, CodingKey {`);
    lines.push(`        case variant`);
    for (const v of action.variants) {
      for (const f of v.fields) {
        lines.push(`        case ${camelCase(f.name)}`);
      }
    }
    lines.push(`    }`);
    lines.push('');

    // Custom decode
    lines.push(`    init(from decoder: Decoder) throws {`);
    lines.push(`        let container = try decoder.container(keyedBy: CodingKeys.self)`);
    lines.push(`        let variant = try container.decode(String.self, forKey: .variant)`);
    lines.push(`        switch variant {`);
    for (const v of action.variants) {
      const variantName = camelCase(v.tag);
      if (v.fields.length === 0) {
        lines.push(`        case "${v.tag}": self = .${variantName}`);
      } else {
        const decodeLines = v.fields.map(f =>
          `try container.decode(${resolvedTypeToSwift(f.type)}.self, forKey: .${camelCase(f.name)})`
        );
        lines.push(`        case "${v.tag}":`);
        lines.push(`            self = .${variantName}(`);
        for (let i = 0; i < v.fields.length; i++) {
          const comma = i < v.fields.length - 1 ? ',' : '';
          lines.push(`                ${camelCase(v.fields[i].name)}: ${decodeLines[i]}${comma}`);
        }
        lines.push(`            )`);
      }
    }
    lines.push(`        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown variant: \\(variant)"))`);
    lines.push(`        }`);
    lines.push(`    }`);
    lines.push('');

    // Custom encode
    lines.push(`    func encode(to encoder: Encoder) throws {`);
    lines.push(`        var container = encoder.container(keyedBy: CodingKeys.self)`);
    lines.push(`        switch self {`);
    for (const v of action.variants) {
      const variantName = camelCase(v.tag);
      if (v.fields.length === 0) {
        lines.push(`        case .${variantName}:`);
        lines.push(`            try container.encode("${v.tag}", forKey: .variant)`);
      } else {
        const bindings = v.fields.map(f => `let ${camelCase(f.name)}`).join(', ');
        lines.push(`        case .${variantName}(${bindings}):`);
        lines.push(`            try container.encode("${v.tag}", forKey: .variant)`);
        for (const f of v.fields) {
          lines.push(`            try container.encode(${camelCase(f.name)}, forKey: .${camelCase(f.name)})`);
        }
      }
    }
    lines.push(`        }`);
    lines.push(`    }`);

    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// --- Handler Protocol File (Handler.swift) ---

function generateHandlerFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName}/Handler.stub.swift`,
    '',
    'import Foundation',
    '',
    `protocol ${conceptName}Handler {`,
  ];

  for (const action of manifest.actions) {
    const inputType = `${conceptName}${capitalize(action.name)}Input`;
    const outputType = `${conceptName}${capitalize(action.name)}Output`;
    lines.push(`    func ${camelCase(action.name)}(`);
    lines.push(`        input: ${inputType},`);
    lines.push(`        storage: ConceptStorage`);
    lines.push(`    ) async throws -> ${outputType}`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

// --- Adapter File (Adapter.swift) ---

function generateAdapterFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName}/Adapter.stub.swift`,
    '',
    'import Foundation',
    '',
    `class ${conceptName}Adapter: ConceptTransport {`,
    `    private let handler: any ${conceptName}Handler`,
    `    private let storage: ConceptStorage`,
    '',
    `    init(handler: any ${conceptName}Handler, storage: ConceptStorage) {`,
    `        self.handler = handler`,
    `        self.storage = storage`,
    `    }`,
    '',
    `    func invoke(invocation: ActionInvocation) async throws -> ActionCompletion {`,
    `        let decoder = JSONDecoder()`,
    `        let encoder = JSONEncoder()`,
    '',
    `        switch invocation.action {`,
  ];

  for (const action of manifest.actions) {
    const inputType = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`        case "${action.name}":`);
    lines.push(`            let input = try decoder.decode(${inputType}.self, from: invocation.inputData)`);
    lines.push(`            let output = try await handler.${camelCase(action.name)}(input: input, storage: storage)`);
    lines.push(`            let outputData = try encoder.encode(output)`);
    lines.push(`            return ActionCompletion(`);
    lines.push(`                id: invocation.id,`);
    lines.push(`                concept: invocation.concept,`);
    lines.push(`                action: invocation.action,`);
    lines.push(`                input: invocation.inputData,`);
    lines.push(`                output: outputData,`);
    lines.push(`                flow: invocation.flow`);
    lines.push(`            )`);
  }

  lines.push(`        default:`);
  lines.push(`            throw ConceptError.unknownAction(invocation.action)`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    func query(request: ConceptQuery) async throws -> [Data] {`);
  lines.push(`        try await storage.find(relation: request.relation, args: request.args)`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    func health() async throws -> (healthy: Bool, latencyMs: UInt64) {`);
  lines.push(`        (true, 0)`);
  lines.push(`    }`);
  lines.push(`}`);

  return lines.join('\n');
}

// --- Conformance Test File (ConformanceTests.swift) ---

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) {
    return null;
  }

  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${conceptName}/ConformanceTests.stub.swift`,
    '',
    'import XCTest',
    '@testable import Clef',
    '',
    `final class ${conceptName}ConformanceTests: XCTestCase {`,
    '',
  ];

  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];
    const testName = `test${capitalize(conceptName)}Invariant${invIdx + 1}`;

    lines.push(`    func ${testName}() async throws {`);
    lines.push(`        // ${inv.description}`);
    lines.push(`        let storage = createInMemoryStorage()`);
    lines.push(`        let handler = createTestHandler() // provided by implementor`);
    lines.push('');

    // Free variable bindings
    for (const fv of inv.freeVariables) {
      lines.push(`        let ${camelCase(fv.name)} = "${fv.testValue}"`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    // Setup steps
    let stepNum = 1;
    lines.push(`        // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateSwiftStepCode(conceptName, step, stepNum));
      stepNum++;
    }
    lines.push('');

    // Assertion steps
    lines.push(`        // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateSwiftStepCode(conceptName, step, stepNum));
      stepNum++;
    }

    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function generateSwiftStepCode(
  conceptName: string,
  step: InvariantStep,
  stepNum: number,
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  // Comment
  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToSwift(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToSwift(a.value)}`).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  // Build input
  const inputType = `${conceptName}${capitalize(step.action)}Input`;
  const inputFields = step.inputs.map(a =>
    `${camelCase(a.name)}: ${invariantValueToSwift(a.value)}`
  ).join(', ');

  lines.push(`        let ${varName} = try await handler.${camelCase(step.action)}(`);
  lines.push(`            input: ${inputType}(${inputFields}),`);
  lines.push(`            storage: storage`);
  lines.push(`        )`);

  // Assert variant
  const outputType = `${conceptName}${capitalize(step.action)}Output`;
  const variantName = camelCase(step.expectedVariant);

  if (step.expectedOutputs.length > 0) {
    const bindings = step.expectedOutputs.map(o => `let ${camelCase(o.name)}`).join(', ');
    lines.push(`        if case .${variantName}(${bindings}) = ${varName} {`);

    for (const out of step.expectedOutputs) {
      lines.push(`            XCTAssertEqual(${camelCase(out.name)}, ${invariantValueToSwift(out.value)})`);
    }

    lines.push(`        } else {`);
    lines.push(`            XCTFail("Expected .${variantName}, got \\(${varName})")`);
    lines.push(`        }`);
  } else {
    lines.push(`        guard case .${variantName} = ${varName} else {`);
    lines.push(`            XCTFail("Expected .${variantName}, got \\(${varName})")`);
    lines.push(`            return`);
    lines.push(`        }`);
  }

  return lines;
}

// --- StorageProgram DSL Runtime File (Swift) ---

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
        StateLens(segments: [.relation(name: name)], sourceType: "store", focusType: "relation<\\(name)>")
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
        StateLens(segments: segments + inner.segments, sourceType: sourceType, focusType: inner.focusType)
    }

    public var relationName: String? {
        guard case .relation(let name) = segments.first else { return nil }
        return name
    }
}

// MARK: - Effect Set

public enum Purity: String, Codable {
    case pure
    case readOnly = "read-only"
    case readWrite = "read-write"
}

public struct EffectSet: Codable {
    public var reads: Set<String>
    public var writes: Set<String>
    public var completionVariants: Set<String>
    public var performs: Set<String>

    public static func empty() -> EffectSet {
        EffectSet(reads: [], writes: [], completionVariants: [], performs: [])
    }

    public func merged(with other: EffectSet) -> EffectSet {
        EffectSet(
            reads: reads.union(other.reads),
            writes: writes.union(other.writes),
            completionVariants: completionVariants.union(other.completionVariants),
            performs: performs.union(other.performs)
        )
    }

    public var purity: Purity {
        if !writes.isEmpty { return .readWrite }
        if !reads.isEmpty { return .readOnly }
        return .pure
    }

    public func validatePurity(declared: Purity) -> String? {
        switch declared {
        case .pure where !reads.isEmpty || !writes.isEmpty:
            return "Declared pure but has storage effects"
        case .readOnly where !writes.isEmpty:
            return "Declared read-only but writes to: \\(writes.sorted().joined(separator: ", "))"
        default:
            return nil
        }
    }
}

// MARK: - Instruction Types

public typealias Bindings = [String: Any]

public enum Instruction: Codable {
    case get(relation: String, key: String, bindAs: String)
    case find(relation: String, criteria: Data, bindAs: String)
    case put(relation: String, key: String, value: Data)
    case merge(relation: String, key: String, fields: Data)
    case del(relation: String, key: String)
    case getLens(lens: StateLens, bindAs: String)
    case putLens(lens: StateLens, value: Data)
    case perform(protocol: String, operation: String, payload: Data, bindAs: String)
    case pure(value: Data)
}

// MARK: - StorageProgram

public struct StorageProgram: Codable {
    public var instructions: [Instruction]
    public var terminated: Bool
    public var effects: EffectSet

    public static func create() -> StorageProgram {
        StorageProgram(instructions: [], terminated: false, effects: .empty())
    }

    public mutating func get(relation: String, key: String, bindAs: String) {
        effects.reads.insert(relation)
        instructions.append(.get(relation: relation, key: key, bindAs: bindAs))
    }

    public mutating func put(relation: String, key: String, value: Data) {
        effects.writes.insert(relation)
        instructions.append(.put(relation: relation, key: key, value: value))
    }

    public mutating func getLens(_ lens: StateLens, bindAs: String) {
        if let rel = lens.relationName { effects.reads.insert(rel) }
        instructions.append(.getLens(lens: lens, bindAs: bindAs))
    }

    public mutating func putLens(_ lens: StateLens, value: Data) {
        if let rel = lens.relationName { effects.writes.insert(rel) }
        instructions.append(.putLens(lens: lens, value: value))
    }

    public mutating func perform(protocol proto: String, operation: String, payload: Data, bindAs: String) {
        effects.performs.insert("\\(proto):\\(operation)")
        instructions.append(.perform(protocol: proto, operation: operation, payload: payload, bindAs: bindAs))
    }

    public mutating func pure(value: Data) {
        instructions.append(.pure(value: value))
        terminated = true
    }

    public mutating func complete(variant: String, output: [String: Any]) {
        effects.completionVariants.insert(variant)
        var merged = output
        merged["variant"] = variant
        let data = (try? JSONSerialization.data(withJSONObject: merged)) ?? Data()
        instructions.append(.pure(value: data))
        terminated = true
    }

    public func extractCompletionVariants() -> Set<String> {
        var variants = Set<String>()
        for instr in instructions {
            if case .pure(let data) = instr,
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let v = obj["variant"] as? String {
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
    case token(path: String, value: Data)
    case aria(role: String?, label: String?, attributes: [String: String]?)
    case bind(field: String, expr: String)
    case element(name: String, attributes: [String: String]?)
    case focus(strategy: String, target: String?)
    case keyboard(key: String, action: String, modifiers: [String]?)
    case renderPure(value: Data)
}

public struct RenderProgram: Codable {
    public var instructions: [RenderInstruction]
    public var terminated: Bool

    public func map(_ transform: (RenderInstruction) -> RenderInstruction) -> RenderProgram {
        RenderProgram(instructions: instructions.map(transform), terminated: terminated)
    }
}
`;
}

// --- Handler ---

export const swiftGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SwiftGen',
      inputKind: 'ConceptManifest',
      outputKind: 'SwiftSource',
      capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']),
    };
  },

  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const files: { path: string; content: string }[] = [
        { path: `${manifest.name}/Types.stub.swift`, content: generateTypesFile(manifest) },
        { path: `${manifest.name}/Handler.stub.swift`, content: generateHandlerFile(manifest) },
        { path: `${manifest.name}/Adapter.stub.swift`, content: generateAdapterFile(manifest) },
        { path: `StorageProgramDSL.stub.swift`, content: generateDslRuntimeFile() },
      ];

      // Add conformance tests if the manifest has invariants
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${manifest.name}/ConformanceTests.stub.swift`, content: conformanceTest });
      }

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return { variant: 'error', message, ...(stack ? { stack } : {}) };
    }
  },
};
