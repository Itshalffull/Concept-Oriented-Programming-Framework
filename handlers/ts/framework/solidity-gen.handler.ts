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
    `import "forge-std/Test.sol";`, `import "../src/${conceptName}.sol";`, '',
    `contract ${conceptName}Test is Test {`, `    ${conceptName} public target;`, `    address owner = address(this);`, '',
    `    function setUp() public {`, `        target = new ${conceptName}();`, `    }`, '',
  ];
  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];
    lines.push(`    /// @notice ${inv.description}`, `    function test_invariant_${invIdx + 1}() public {`);
    for (const fv of inv.freeVariables) lines.push(`        bytes32 ${camelCase(fv.name)} = keccak256(abi.encodePacked("${fv.testValue}"));`);
    if (inv.freeVariables.length > 0) lines.push('');
    lines.push(`        // --- Setup ---`);
    for (const step of inv.setup) lines.push(...generateSolidityStepCode(step));
    lines.push('', `        // --- Assertions ---`);
    for (const step of inv.assertions) lines.push(...generateSolidityStepCode(step));
    lines.push(`    }`, '');
  }
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
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}`);
  const args = step.inputs.map(a => invariantValueToSolidity(a.value)).join(', ');
  lines.push(`        // target.${camelCase(step.action)}(${args});`, `        // TODO: Assert ${step.expectedVariant} variant`);
  return lines;
}

function generateDslRuntimeFile(): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StorageProgramDSL
/// @notice Free Monad DSL for Concept Handlers (Solidity)

enum LensSegmentKind { Relation, Key, Field }
struct LensSegment { LensSegmentKind kind; string value; }
struct StateLens { LensSegment[] segments; string sourceType; string focusType; }
enum PurityLevel { Pure, ReadOnly, ReadWrite }
struct EffectSet { string[] reads; string[] writes; string[] completionVariants; string[] performs; }
enum InstructionTag { Get, Put, Del, GetLens, PutLens, Perform, Pure }
struct Instruction { InstructionTag tag; string relation; string key; bytes value; string protocol; string operation; string bindAs; }
struct StorageProgram { Instruction[] instructions; bool terminated; EffectSet effects; }
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
