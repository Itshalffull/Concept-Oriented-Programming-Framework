// @clef-handler style=functional concept=SolidityGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SolidityGen Concept Implementation
//
// Generates Solidity contract skeletons from a ConceptManifest.
// Invariants become require statements + Foundry test cases.
//
// See architecture doc Section 10.1 for type mapping details.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type {
  ConceptManifest,
  ResolvedType,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

// --- All pure helper functions are kept unchanged ---

function resolvedTypeToSolidity(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive': return primitiveToSolidity(t.primitive);
    case 'param': return 'bytes32';
    case 'set': return `mapping(${resolvedTypeToSolidity(t.inner)} => bool)`;
    case 'list': return `${resolvedTypeToSolidity(t.inner)}[]`;
    case 'option': return resolvedTypeToSolidity(t.inner);
    case 'map': return `mapping(${resolvedTypeToSolidity(t.keyType)} => ${resolvedTypeToSolidity(t.inner)})`;
    case 'record': return 'bytes';
  }
}

function primitiveToSolidity(name: string): string {
  switch (name) {
    case 'String': return 'string';
    case 'Int': return 'int256';
    case 'Float': return 'uint256';
    case 'Bool': return 'bool';
    case 'Bytes': return 'bytes';
    case 'DateTime': return 'uint256';
    case 'ID': return 'bytes32';
    default: return 'bytes';
  }
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function camelCase(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }

function needsMemoryKeyword(t: ResolvedType): boolean {
  if (t.kind === 'primitive') return t.primitive === 'String' || t.primitive === 'Bytes';
  if (t.kind === 'list') return true;
  if (t.kind === 'record') return true;
  return false;
}

function generateContractFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// SPDX-License-Identifier: MIT`, `pragma solidity ^0.8.20;`, '',
    `import "@openzeppelin/contracts/access/Ownable.sol";`, '',
    `/// @title ${conceptName}`, `/// @notice Generated from ${conceptName} concept specification`,
    `/// @dev Skeleton contract — implement action bodies.`, '',
  ];
  const structs: string[] = [];
  const events: string[] = [];

  for (const action of manifest.actions) {
    if (action.params.length > 1) {
      const inputStructName = `${capitalize(action.name)}Input`;
      const structLines = [`    struct ${inputStructName} {`];
      for (const p of action.params) structLines.push(`        ${resolvedTypeToSolidity(p.type)} ${camelCase(p.name)};`);
      structLines.push(`    }`);
      structs.push(structLines.join('\n'));
    }
    for (const v of action.variants) {
      if (v.fields.length > 0) {
        const variantStructName = `${capitalize(action.name)}${capitalize(v.tag)}Result`;
        const structLines = [`    struct ${variantStructName} {`, `        bool success;`];
        for (const f of v.fields) structLines.push(`        ${resolvedTypeToSolidity(f.type)} ${camelCase(f.name)};`);
        structLines.push(`    }`);
        structs.push(structLines.join('\n'));
      }
    }
    const eventFields = ['string variant'];
    for (const v of action.variants) {
      for (const f of v.fields) {
        const solType = resolvedTypeToSolidity(f.type);
        if (!needsMemoryKeyword({ kind: 'primitive', primitive: f.type.kind === 'primitive' ? f.type.primitive : '' } as ResolvedType)) {
          eventFields.push(`${solType} ${camelCase(f.name)}`);
        }
      }
    }
    const seenFields = new Set<string>();
    const dedupedFields: string[] = [];
    for (const ef of eventFields) {
      const fieldName = ef.split(' ').pop()!;
      if (!seenFields.has(fieldName)) { seenFields.add(fieldName); dedupedFields.push(ef); }
    }
    events.push(`    event ${capitalize(action.name)}Completed(${dedupedFields.join(', ')});`);
  }

  lines.push(`contract ${conceptName} is Ownable {`, '', `    constructor() Ownable(msg.sender) {}`, '');
  if (manifest.relations && manifest.relations.length > 0) {
    lines.push(`    // --- Storage (from concept state) ---`, '');
    for (const rel of manifest.relations) {
      lines.push(`    // ${rel.name}`);
      if (rel.source === 'set-valued') { lines.push(`    mapping(bytes32 => bool) private ${camelCase(rel.name)};`); lines.push(`    bytes32[] private ${camelCase(rel.name)}Keys;`); }
      else { lines.push(`    mapping(bytes32 => bytes) private ${camelCase(rel.name)};`); }
      lines.push('');
    }
  }
  if (structs.length > 0) { lines.push(`    // --- Types ---`, ''); for (const s of structs) { lines.push(s, ''); } }
  if (events.length > 0) { lines.push(`    // --- Events ---`, ''); for (const e of events) lines.push(e); lines.push(''); }

  lines.push(`    // --- Actions ---`, '');
  for (const action of manifest.actions) {
    const params: string[] = [];
    for (const p of action.params) {
      const solType = resolvedTypeToSolidity(p.type);
      const memKeyword = needsMemoryKeyword(p.type) ? ' memory' : '';
      params.push(`${solType}${memKeyword} ${camelCase(p.name)}`);
    }
    const okVariant = action.variants.find(v => v.tag === 'ok');
    let returnType = 'bool';
    if (okVariant && okVariant.fields.length > 0) returnType = `${capitalize(action.name)}${capitalize(okVariant.tag)}Result memory`;
    lines.push(`    /// @notice ${action.name}`);
    lines.push(`    function ${camelCase(action.name)}(${params.join(', ')}) external onlyOwner returns (${returnType}) {`);
    lines.push(`        // TODO: Implement ${action.name}`, `        revert("Not implemented");`, `    }`, '');
  }
  lines.push(`}`);
  return lines.join('\n');
}

function generateFoundryTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) return null;
  const conceptName = manifest.name;
  const lines: string[] = [
    `// SPDX-License-Identifier: MIT`, `pragma solidity ^0.8.20;`, '',
    `import "forge-std/Test.sol";`, `import {${conceptName}} from "../src/${conceptName}.sol";`, '',
    `contract ${conceptName}Test is Test {`, `    ${conceptName} public target;`, '',
    `    function setUp() public {`, `        target = new ${conceptName}();`, `    }`, '',
  ];
  let invNum = 0;
  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];
    // Skip invariants with no operational steps (e.g., 'always' universal properties)
    if (inv.setup.length === 0 && inv.assertions.length === 0) continue;
    invNum++;
    lines.push(`    /// @notice ${inv.description}`, `    function test_invariant_${invNum}() public {`);
    for (const fv of inv.freeVariables) lines.push(`        bytes32 ${camelCase(fv.name)} = keccak256(abi.encodePacked("${fv.testValue}"));`);
    if (inv.freeVariables.length > 0) lines.push('');
    lines.push(`        // --- Setup ---`);
    for (const step of inv.setup) lines.push(...generateSolidityStepCode(step));
    lines.push('', `        // --- Assertions ---`);
    for (const step of inv.assertions) lines.push(...generateSolidityStepCode(step));
    lines.push(`    }`, '');
  }
  if (invNum === 0) return null;
  lines.push(`}`);
  return lines.join('\n');
}

function invariantValueToSolidity(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal': { const val = v.value; if (typeof val === 'string') return `"${val}"`; if (typeof val === 'boolean') return val ? 'true' : 'false'; return String(val); }
    case 'variable': return camelCase(v.name);
    case 'record': return `/* struct { ${v.fields.map(f => `${f.name}: ${invariantValueToSolidity(f.value)}`).join(', ')} } */`;
    case 'list': return `/* [${v.items.map(item => invariantValueToSolidity(item)).join(', ')}] */`;
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

function generateSolidityStepCode(step: InvariantStep): string[] {
  const lines: string[] = [];
  const inputStr = step.inputs.map(a => `${a.name}: ${invariantValueToComment(a.value)}`).join(', ');
  const outputStr = step.expectedOutputs.map(a => `${a.name}: ${invariantValueToComment(a.value)}`).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);
  const args = step.inputs.map(a => invariantValueToSolidity(a.value)).join(', ');

  if (step.expectedOutputs.length > 0) {
    // Generate return value capture and assertions
    const returnVars = step.expectedOutputs.map(o => `${camelCase(o.name)}`).join(', ');
    lines.push(`        (${returnVars}) = target.${camelCase(step.action)}(${args});`);
    for (const out of step.expectedOutputs) {
      if (out.value.kind === 'literal') {
        const expected = invariantValueToSolidity(out.value);
        lines.push(`        assertEq(${camelCase(out.name)}, ${expected});`);
      } else if (out.value.kind === 'variable') {
        if (out.value.name !== '_') {
          lines.push(`        assertEq(${camelCase(out.name)}, ${camelCase(out.value.name)});`);
        }
      }
    }
  } else {
    // No outputs — just call and expect no revert (success = ok variant)
    lines.push(`        target.${camelCase(step.action)}(${args});`);
  }

  return lines;
}

function generateDslRuntimeFile(): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StorageProgramDSL
/// @notice Free Monad DSL for Concept Handlers (Solidity)
/// @dev Provides typed lenses/optics, effect tracking, algebraic effects,
///      transport effects, and functorial mapping for render programs.

// ── Lens Types ──────────────────────────────────────────────

enum LensSegmentKind { Relation, Key, Field }

struct LensSegment {
    LensSegmentKind kind;
    string value;
}

struct StateLens {
    LensSegment[] segments;
    string sourceType;
    string focusType;
}

library LensLib {
    function relation(string memory name) internal pure returns (StateLens memory) {
        StateLens memory lens;
        lens.sourceType = "store";
        lens.focusType = string(abi.encodePacked("relation<", name, ">"));
        LensSegment[] memory segs = new LensSegment[](1);
        segs[0] = LensSegment(LensSegmentKind.Relation, name);
        lens.segments = segs;
        return lens;
    }

    function at(StateLens memory self, string memory key) internal pure returns (StateLens memory) {
        uint256 len = self.segments.length;
        LensSegment[] memory newSegs = new LensSegment[](len + 1);
        for (uint256 i = 0; i < len; i++) { newSegs[i] = self.segments[i]; }
        newSegs[len] = LensSegment(LensSegmentKind.Key, key);
        self.segments = newSegs;
        self.focusType = "record";
        return self;
    }

    function field(StateLens memory self, string memory name) internal pure returns (StateLens memory) {
        uint256 len = self.segments.length;
        LensSegment[] memory newSegs = new LensSegment[](len + 1);
        for (uint256 i = 0; i < len; i++) { newSegs[i] = self.segments[i]; }
        newSegs[len] = LensSegment(LensSegmentKind.Field, name);
        self.segments = newSegs;
        self.focusType = name;
        return self;
    }

    function compose(StateLens memory outer, StateLens memory inner) internal pure returns (StateLens memory) {
        uint256 outerLen = outer.segments.length;
        uint256 innerLen = inner.segments.length;
        LensSegment[] memory newSegs = new LensSegment[](outerLen + innerLen);
        for (uint256 i = 0; i < outerLen; i++) { newSegs[i] = outer.segments[i]; }
        for (uint256 i = 0; i < innerLen; i++) { newSegs[outerLen + i] = inner.segments[i]; }
        outer.segments = newSegs;
        outer.focusType = inner.focusType;
        return outer;
    }
}

// ── Effect Set ──────────────────────────────────────────────

enum PurityLevel { Pure, ReadOnly, ReadWrite }

struct EffectSet {
    string[] reads;
    string[] writes;
    string[] completionVariants;
    string[] performs;
}

library EffectLib {
    function purityOf(EffectSet memory effects) internal pure returns (PurityLevel) {
        if (effects.writes.length > 0) return PurityLevel.ReadWrite;
        if (effects.reads.length > 0) return PurityLevel.ReadOnly;
        return PurityLevel.Pure;
    }

    function validatePurity(EffectSet memory effects, PurityLevel declared) internal pure returns (bool valid, string memory reason) {
        if (declared == PurityLevel.Pure && (effects.reads.length > 0 || effects.writes.length > 0)) {
            return (false, "Declared pure but has storage effects");
        }
        if (declared == PurityLevel.ReadOnly && effects.writes.length > 0) {
            return (false, "Declared read-only but has write effects");
        }
        return (true, "");
    }

    function merge(EffectSet memory a, EffectSet memory b) internal pure returns (EffectSet memory) {
        EffectSet memory result;
        result.reads = _concatStringArrays(a.reads, b.reads);
        result.writes = _concatStringArrays(a.writes, b.writes);
        result.completionVariants = _concatStringArrays(a.completionVariants, b.completionVariants);
        result.performs = _concatStringArrays(a.performs, b.performs);
        return result;
    }

    function _concatStringArrays(string[] memory a, string[] memory b) private pure returns (string[] memory) {
        string[] memory result = new string[](a.length + b.length);
        for (uint256 i = 0; i < a.length; i++) { result[i] = a[i]; }
        for (uint256 i = 0; i < b.length; i++) { result[a.length + i] = b[i]; }
        return result;
    }
}

// ── Instruction Types ───────────────────────────────────────

enum InstructionTag { Get, Find, Put, Merge, Del, GetLens, PutLens, Perform, Pure }

struct Instruction {
    InstructionTag tag;
    string relation;
    string key;
    bytes value;
    string protocol;
    string operation;
    string bindAs;
    StateLens lens;
}

// ── StorageProgram ──────────────────────────────────────────

struct StorageProgram {
    Instruction[] instructions;
    bool terminated;
    EffectSet effects;
}

library StorageProgramLib {
    function addRead(EffectSet memory effects, string memory rel) internal pure returns (EffectSet memory) {
        string[] memory newReads = new string[](effects.reads.length + 1);
        for (uint256 i = 0; i < effects.reads.length; i++) { newReads[i] = effects.reads[i]; }
        newReads[effects.reads.length] = rel;
        effects.reads = newReads;
        return effects;
    }

    function addWrite(EffectSet memory effects, string memory rel) internal pure returns (EffectSet memory) {
        string[] memory newWrites = new string[](effects.writes.length + 1);
        for (uint256 i = 0; i < effects.writes.length; i++) { newWrites[i] = effects.writes[i]; }
        newWrites[effects.writes.length] = rel;
        effects.writes = newWrites;
        return effects;
    }

    function get(StorageProgram storage self, string memory relation, string memory key, string memory bindAs) internal {
        self.effects = addRead(self.effects, relation);
        Instruction memory instr;
        instr.tag = InstructionTag.Get;
        instr.relation = relation;
        instr.key = key;
        instr.bindAs = bindAs;
        self.instructions.push(instr);
    }

    function put(StorageProgram storage self, string memory relation, string memory key, bytes memory value) internal {
        self.effects = addWrite(self.effects, relation);
        Instruction memory instr;
        instr.tag = InstructionTag.Put;
        instr.relation = relation;
        instr.key = key;
        instr.value = value;
        self.instructions.push(instr);
    }

    function getLens(StorageProgram storage self, StateLens memory lens, string memory bindAs) internal {
        if (lens.segments.length > 0 && lens.segments[0].kind == LensSegmentKind.Relation) {
            self.effects = addRead(self.effects, lens.segments[0].value);
        }
        Instruction memory instr;
        instr.tag = InstructionTag.GetLens;
        instr.lens = lens;
        instr.bindAs = bindAs;
        self.instructions.push(instr);
    }

    function putLens(StorageProgram storage self, StateLens memory lens, bytes memory value) internal {
        if (lens.segments.length > 0 && lens.segments[0].kind == LensSegmentKind.Relation) {
            self.effects = addWrite(self.effects, lens.segments[0].value);
        }
        Instruction memory instr;
        instr.tag = InstructionTag.PutLens;
        instr.lens = lens;
        instr.value = value;
        self.instructions.push(instr);
    }

    function perform(StorageProgram storage self, string memory protocol, string memory operation, bytes memory payload, string memory bindAs) internal {
        string[] memory newPerforms = new string[](self.effects.performs.length + 1);
        for (uint256 i = 0; i < self.effects.performs.length; i++) {
            newPerforms[i] = self.effects.performs[i];
        }
        newPerforms[self.effects.performs.length] = string(abi.encodePacked(protocol, ":", operation));
        self.effects.performs = newPerforms;
        Instruction memory instr;
        instr.tag = InstructionTag.Perform;
        instr.protocol = protocol;
        instr.operation = operation;
        instr.value = payload;
        instr.bindAs = bindAs;
        self.instructions.push(instr);
    }

    function complete(StorageProgram storage self, string memory variant, bytes memory output) internal {
        string[] memory newVariants = new string[](self.effects.completionVariants.length + 1);
        for (uint256 i = 0; i < self.effects.completionVariants.length; i++) {
            newVariants[i] = self.effects.completionVariants[i];
        }
        newVariants[self.effects.completionVariants.length] = variant;
        self.effects.completionVariants = newVariants;
        Instruction memory instr;
        instr.tag = InstructionTag.Pure;
        instr.value = abi.encode(variant, output);
        self.instructions.push(instr);
        self.terminated = true;
    }

    function extractCompletionVariants(StorageProgram storage self) internal view returns (string[] memory) {
        return self.effects.completionVariants;
    }

    function extractPerformSet(StorageProgram storage self) internal view returns (string[] memory) {
        return self.effects.performs;
    }
}

// ── Render Program (Functorial Mapping) ─────────────────────

enum RenderInstructionTag { Token, Aria, Bind, Element, Focus, Keyboard, RenderPure }

struct RenderInstruction {
    RenderInstructionTag tag;
    string path;
    bytes value;
    string role;
    string label;
    string field;
    string expr;
    string name;
    string strategy;
    string target;
    string key;
    string action;
    string[] modifiers;
}

struct RenderProgram {
    RenderInstruction[] instructions;
    bool terminated;
}
`;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'SolidityGen', inputKind: 'ConceptManifest', outputKind: 'SoliditySource',
      capabilities: JSON.stringify(['contract', 'events', 'foundry-tests', 'dsl-runtime']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifest = input.manifest as ConceptManifest;
    if (!manifest || !manifest.name) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid manifest: missing concept name' }) as StorageProgram<Result>;
    }
    try {
      const files: { path: string; content: string }[] = [
        { path: `src/${manifest.name}.stub.sol`, content: generateContractFile(manifest) },
        { path: `src/StorageProgramDSL.stub.sol`, content: generateDslRuntimeFile() },
      ];
      const foundryTest = generateFoundryTestFile(manifest);
      if (foundryTest) files.push({ path: `test/${manifest.name}.t.stub.sol`, content: foundryTest });
      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const p = createProgram();
      return complete(p, 'error', { message, ...(stack ? { stack } : {}) }) as StorageProgram<Result>;
    }
  },
};

export const solidityGenHandler = autoInterpret(_handler);
