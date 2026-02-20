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
} from '../../../kernel/src/types.js';

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
    `// generated: ${conceptName}/Types.swift`,
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
    `// generated: ${conceptName}/Handler.swift`,
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
    `// generated: ${conceptName}/Adapter.swift`,
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
    `// generated: ${conceptName}/ConformanceTests.swift`,
    '',
    'import XCTest',
    '@testable import COPF',
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

// --- Handler ---

export const swiftGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const files: { path: string; content: string }[] = [
        { path: `${manifest.name}/Types.swift`, content: generateTypesFile(manifest) },
        { path: `${manifest.name}/Handler.swift`, content: generateHandlerFile(manifest) },
        { path: `${manifest.name}/Adapter.swift`, content: generateAdapterFile(manifest) },
      ];

      // Add conformance tests if the manifest has invariants
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${manifest.name}/ConformanceTests.swift`, content: conformanceTest });
      }

      // Store the output keyed by spec reference
      await storage.put('outputs', spec, { spec, files });

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
