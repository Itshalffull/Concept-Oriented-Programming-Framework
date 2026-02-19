// ============================================================
// SolidityGen Concept Implementation
//
// Generates Solidity contract skeletons from a ConceptManifest.
// Invariants become require statements + Foundry test cases.
//
// Solidity constraints handled:
//   - No generics: type params become fixed bytes32
//   - Fixed-size types: String → string, Int → int256, etc.
//   - Storage layout: concept state → storage variables
//   - Events: each action completion → event emission
//
// Type mapping table:
//   String   → string       Int      → int256
//   Float    → uint256      Bool     → bool
//   Bytes    → bytes        DateTime → uint256 (unix timestamp)
//   ID       → bytes32      option T → T (with bool flag)
//   set T    → mapping      list T   → T[]
//   A -> B   → mapping(A => B)  params → bytes32 (opaque)
//
// Generated files:
//   - <Name>.sol        (contract skeleton + events)
//   - <Name>.t.sol      (Foundry test harness from invariants)
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

// --- ResolvedType → Solidity mapping ---

function resolvedTypeToSolidity(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToSolidity(t.primitive);
    case 'param':
      return 'bytes32'; // type parameters are opaque; bytes32 on-chain
    case 'set':
      // Solidity doesn't have sets; use mapping to bool for membership
      return `mapping(${resolvedTypeToSolidity(t.inner)} => bool)`;
    case 'list':
      return `${resolvedTypeToSolidity(t.inner)}[]`;
    case 'option':
      // No native option in Solidity; handled at struct level with exists flag
      return resolvedTypeToSolidity(t.inner);
    case 'map':
      return `mapping(${resolvedTypeToSolidity(t.keyType)} => ${resolvedTypeToSolidity(t.inner)})`;
    case 'record': {
      // Inline records become named structs elsewhere
      return 'bytes'; // fallback for inline
    }
  }
}

function primitiveToSolidity(name: string): string {
  switch (name) {
    case 'String': return 'string';
    case 'Int': return 'int256';
    case 'Float': return 'uint256'; // no floating point in Solidity; use fixed-point
    case 'Bool': return 'bool';
    case 'Bytes': return 'bytes';
    case 'DateTime': return 'uint256'; // unix timestamp
    case 'ID': return 'bytes32';
    default: return 'bytes';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function camelCase(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// --- Check if type can be a storage variable or needs special handling ---

function isStorageCompatible(t: ResolvedType): boolean {
  // Mappings and dynamic arrays are storage-only
  if (t.kind === 'map' || t.kind === 'set') return true;
  if (t.kind === 'list') return true;
  return false;
}

// Check if type can be used as a function parameter (memory types need 'memory')
function needsMemoryKeyword(t: ResolvedType): boolean {
  if (t.kind === 'primitive') {
    return t.primitive === 'String' || t.primitive === 'Bytes';
  }
  if (t.kind === 'list') return true;
  if (t.kind === 'record') return true;
  return false;
}

// --- Contract File (<Name>.sol) ---

function generateContractFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity ^0.8.20;`,
    '',
    `/// @title ${conceptName}`,
    `/// @notice Generated from ${conceptName} concept specification`,
    `/// @dev Skeleton contract — implement action bodies`,
    '',
  ];

  // Collect struct definitions needed for action inputs/outputs
  const structs: string[] = [];
  const events: string[] = [];

  for (const action of manifest.actions) {
    // Input struct (only if multiple params)
    if (action.params.length > 1) {
      const inputStructName = `${capitalize(action.name)}Input`;
      const structLines = [`    struct ${inputStructName} {`];
      for (const p of action.params) {
        const solType = resolvedTypeToSolidity(p.type);
        structLines.push(`        ${solType} ${camelCase(p.name)};`);
      }
      structLines.push(`    }`);
      structs.push(structLines.join('\n'));
    }

    // Output struct per variant (for return values)
    for (const v of action.variants) {
      if (v.fields.length > 0) {
        const variantStructName = `${capitalize(action.name)}${capitalize(v.tag)}Result`;
        const structLines = [`    struct ${variantStructName} {`];
        structLines.push(`        bool success;`);
        for (const f of v.fields) {
          const solType = resolvedTypeToSolidity(f.type);
          structLines.push(`        ${solType} ${camelCase(f.name)};`);
        }
        structLines.push(`    }`);
        structs.push(structLines.join('\n'));
      }
    }

    // Event for each action completion
    const eventFields = ['string variant'];
    for (const v of action.variants) {
      for (const f of v.fields) {
        const solType = resolvedTypeToSolidity(f.type);
        // Only add indexed for value types
        if (!needsMemoryKeyword({ kind: 'primitive', primitive: f.type.kind === 'primitive' ? f.type.primitive : '' } as ResolvedType)) {
          eventFields.push(`${solType} ${camelCase(f.name)}`);
        }
      }
    }
    // Deduplicate event fields by name
    const seenFields = new Set<string>();
    const dedupedFields: string[] = [];
    for (const ef of eventFields) {
      const fieldName = ef.split(' ').pop()!;
      if (!seenFields.has(fieldName)) {
        seenFields.add(fieldName);
        dedupedFields.push(ef);
      }
    }
    events.push(`    event ${capitalize(action.name)}Completed(${dedupedFields.join(', ')});`);
  }

  // Contract declaration
  lines.push(`contract ${conceptName} {`);
  lines.push('');

  // Storage variables from concept state relations
  if (manifest.relations && manifest.relations.length > 0) {
    lines.push(`    // --- Storage (from concept state) ---`);
    lines.push('');
    for (const rel of manifest.relations) {
      lines.push(`    // ${rel.name}`);
      if (rel.source === 'set-valued') {
        lines.push(`    mapping(bytes32 => bool) private ${camelCase(rel.name)};`);
        lines.push(`    bytes32[] private ${camelCase(rel.name)}Keys;`);
      } else if (rel.source === 'merged') {
        lines.push(`    mapping(bytes32 => bytes) private ${camelCase(rel.name)};`);
      } else {
        lines.push(`    mapping(bytes32 => bytes) private ${camelCase(rel.name)};`);
      }
      lines.push('');
    }
  }

  // Structs
  if (structs.length > 0) {
    lines.push(`    // --- Types ---`);
    lines.push('');
    for (const s of structs) {
      lines.push(s);
      lines.push('');
    }
  }

  // Events
  if (events.length > 0) {
    lines.push(`    // --- Events ---`);
    lines.push('');
    for (const e of events) {
      lines.push(e);
    }
    lines.push('');
  }

  // Action functions
  lines.push(`    // --- Actions ---`);
  lines.push('');

  for (const action of manifest.actions) {
    // Function signature
    const params: string[] = [];
    for (const p of action.params) {
      const solType = resolvedTypeToSolidity(p.type);
      const memKeyword = needsMemoryKeyword(p.type) ? ' memory' : '';
      params.push(`${solType}${memKeyword} ${camelCase(p.name)}`);
    }

    // Determine return type — use the ok variant's fields
    const okVariant = action.variants.find(v => v.tag === 'ok');
    let returnType = 'bool';
    if (okVariant && okVariant.fields.length > 0) {
      returnType = `${capitalize(action.name)}${capitalize(okVariant.tag)}Result memory`;
    }

    lines.push(`    /// @notice ${action.name}`);
    lines.push(`    function ${camelCase(action.name)}(${params.join(', ')}) external returns (${returnType}) {`);

    // Generate require statements from invariants that reference this action
    const relevantInvariants = manifest.invariants.filter(inv =>
      inv.setup.some(s => s.action === action.name) ||
      inv.assertions.some(s => s.action === action.name)
    );

    if (relevantInvariants.length > 0) {
      lines.push(`        // Invariant checks`);
      for (const inv of relevantInvariants) {
        lines.push(`        // ${inv.description}`);
        // Generate require() stubs for preconditions
        for (const step of inv.assertions) {
          if (step.action === action.name) {
            lines.push(`        // require(..., "${inv.description}");`);
          }
        }
      }
      lines.push('');
    }

    lines.push(`        // TODO: Implement ${action.name}`);
    lines.push(`        revert("Not implemented");`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

// --- Foundry Test File (<Name>.t.sol) ---

function generateFoundryTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) {
    return null;
  }

  const conceptName = manifest.name;
  const lines: string[] = [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity ^0.8.20;`,
    '',
    `import "forge-std/Test.sol";`,
    `import "../src/${conceptName}.sol";`,
    '',
    `/// @title ${conceptName} Conformance Tests`,
    `/// @notice Generated from concept invariants`,
    `contract ${conceptName}Test is Test {`,
    `    ${conceptName} public target;`,
    '',
    `    function setUp() public {`,
    `        target = new ${conceptName}();`,
    `    }`,
    '',
  ];

  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];
    const testName = `test_invariant_${invIdx + 1}`;

    lines.push(`    /// @notice ${inv.description}`);
    lines.push(`    function ${testName}() public {`);

    // Free variable bindings
    for (const fv of inv.freeVariables) {
      if (typeof fv.testValue === 'string') {
        // For bytes32 or string values
        lines.push(`        bytes32 ${camelCase(fv.name)} = keccak256(abi.encodePacked("${fv.testValue}"));`);
      }
    }
    if (inv.freeVariables.length > 0) lines.push('');

    // Setup steps
    lines.push(`        // --- Setup ---`);
    for (const step of inv.setup) {
      lines.push(...generateSolidityStepCode(step));
    }
    lines.push('');

    // Assertion steps
    lines.push(`        // --- Assertions ---`);
    for (const step of inv.assertions) {
      lines.push(...generateSolidityStepCode(step));
    }

    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function generateSolidityStepCode(step: InvariantStep): string[] {
  const lines: string[] = [];

  // Comment
  const inputStr = step.inputs.map(a => {
    if (a.value.kind === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}`);

  // Build function call
  const args = step.inputs.map(a => {
    if (a.value.kind === 'literal') {
      const val = a.value.value;
      if (typeof val === 'string') return `"${val}"`;
      if (typeof val === 'boolean') return val ? 'true' : 'false';
      return String(val);
    }
    return camelCase(a.value.name);
  }).join(', ');

  lines.push(`        // target.${camelCase(step.action)}(${args});`);
  lines.push(`        // TODO: Assert ${step.expectedVariant} variant`);

  return lines;
}

// --- Handler ---

export const solidityGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const files: { path: string; content: string }[] = [
        { path: `src/${manifest.name}.sol`, content: generateContractFile(manifest) },
      ];

      // Add Foundry tests if the manifest has invariants
      const foundryTest = generateFoundryTestFile(manifest);
      if (foundryTest) {
        files.push({ path: `test/${manifest.name}.t.sol`, content: foundryTest });
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
