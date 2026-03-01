// SolidityGen — Solidity code generator: transforms concept AST into Solidity contracts
// including struct definitions, event declarations, function signatures, and ABI-compatible interfaces.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SolidityGenStorage,
  SolidityGenGenerateInput,
  SolidityGenGenerateOutput,
  SolidityGenRegisterInput,
  SolidityGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  registerOk,
} from './types.js';

export interface SolidityGenError {
  readonly code: string;
  readonly message: string;
}

export interface SolidityGenHandler {
  readonly generate: (
    input: SolidityGenGenerateInput,
    storage: SolidityGenStorage,
  ) => TE.TaskEither<SolidityGenError, SolidityGenGenerateOutput>;
  readonly register: (
    input: SolidityGenRegisterInput,
    storage: SolidityGenStorage,
  ) => TE.TaskEither<SolidityGenError, SolidityGenRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SolidityGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SOLIDITY_GEN_CAPABILITIES: readonly string[] = [
  'contracts',
  'interfaces',
  'structs',
  'events',
  'modifiers',
  'erc-standards',
] as const;

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const toCamelCase = (s: string): string => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const mapTypeToSolidity = (t: string): string => {
  switch (t) {
    case 'string': return 'string';
    case 'number': case 'integer': return 'uint256';
    case 'float': return 'uint256'; // Solidity has no floats; use fixed-point or uint256
    case 'boolean': return 'bool';
    case 'date': return 'uint256'; // Unix timestamp
    case 'address': return 'address';
    case 'bytes': return 'bytes';
    default: return 'bytes';
  }
};

const extractManifest = (manifest: unknown): {
  readonly name: string;
  readonly operations: readonly { readonly name: string; readonly input: readonly { readonly name: string; readonly type: string }[]; readonly output: readonly { readonly variant: string; readonly fields: readonly { readonly name: string; readonly type: string }[] }[] }[];
} | null => {
  if (typeof manifest !== 'object' || manifest === null) return null;
  const m = manifest as Record<string, unknown>;
  const name = String(m.name ?? '');
  if (!name) return null;

  const ops = Array.isArray(m.operations) ? m.operations : [];
  const operations = ops.map((op) => {
    const o = op as Record<string, unknown>;
    const inputs = Array.isArray(o.input) ? o.input.map((i: unknown) => {
      const inp = i as Record<string, unknown>;
      return { name: String(inp.name ?? ''), type: String(inp.type ?? 'unknown') };
    }) : [];
    const outputs = Array.isArray(o.output) ? o.output.map((out: unknown) => {
      const ou = out as Record<string, unknown>;
      const fields = Array.isArray(ou.fields) ? ou.fields.map((f: unknown) => {
        const fi = f as Record<string, unknown>;
        return { name: String(fi.name ?? ''), type: String(fi.type ?? 'unknown') };
      }) : [];
      return { variant: String(ou.variant ?? 'ok'), fields };
    }) : [];
    return { name: String(o.name ?? ''), input: inputs, output: outputs };
  });

  return { name, operations };
};

// --- Implementation ---

export const solidityGenHandler: SolidityGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractManifest(input.manifest)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid manifest: must be an object with "name" and "operations" fields',
          ) as SolidityGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const files: { readonly path: string; readonly content: string }[] = [];

        // Generate interface contract
        const interfaceLines: string[] = [
          `// SPDX-License-Identifier: MIT`,
          `pragma solidity ^0.8.0;`,
          ``,
          `/// @title I${conceptName}`,
          `/// @notice Interface generated from concept spec '${input.spec}'`,
          `interface I${conceptName} {`,
          ``,
        ];

        // Generate structs for inputs/outputs and events
        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);

          // Input struct
          if (op.input.length > 0) {
            interfaceLines.push(`    struct ${opPascal}Input {`);
            for (const field of op.input) {
              interfaceLines.push(`        ${mapTypeToSolidity(field.type)} ${toCamelCase(field.name)};`);
            }
            interfaceLines.push(`    }`, ``);
          }

          // Output struct for each variant
          for (const variant of op.output) {
            const variantPascal = toPascalCase(variant.variant);
            if (variant.fields.length > 0) {
              interfaceLines.push(`    struct ${opPascal}${variantPascal}Result {`);
              for (const field of variant.fields) {
                interfaceLines.push(`        ${mapTypeToSolidity(field.type)} ${toCamelCase(field.name)};`);
              }
              interfaceLines.push(`    }`, ``);
            }
          }

          // Event for the operation
          const eventParams = op.input
            .map((f) => `${mapTypeToSolidity(f.type)} ${toCamelCase(f.name)}`)
            .join(', ');
          interfaceLines.push(`    event ${opPascal}Executed(${eventParams});`, ``);

          // Function signature
          const fnParams = op.input
            .map((f) => `${mapTypeToSolidity(f.type)} calldata ${toCamelCase(f.name)}`)
            .join(', ');
          interfaceLines.push(`    function ${toCamelCase(op.name)}(${fnParams}) external returns (bool);`, ``);
        }

        interfaceLines.push(`}`);
        files.push({ path: `${conceptName}/I${conceptName}.sol`, content: interfaceLines.join('\n') });

        // Generate implementation contract
        const implLines: string[] = [
          `// SPDX-License-Identifier: MIT`,
          `pragma solidity ^0.8.0;`,
          ``,
          `import "./I${conceptName}.sol";`,
          ``,
          `/// @title ${conceptName}`,
          `/// @notice Implementation generated from concept spec '${input.spec}'`,
          `contract ${conceptName} is I${conceptName} {`,
          ``,
          `    address public owner;`,
          ``,
          `    constructor() {`,
          `        owner = msg.sender;`,
          `    }`,
          ``,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);
          const fnParams = op.input
            .map((f) => `${mapTypeToSolidity(f.type)} calldata ${toCamelCase(f.name)}`)
            .join(', ');
          implLines.push(
            `    function ${toCamelCase(op.name)}(${fnParams}) external override returns (bool) {`,
            `        emit ${opPascal}Executed(${op.input.map((f) => toCamelCase(f.name)).join(', ')});`,
            `        return true;`,
            `    }`,
            ``,
          );
        }

        implLines.push(`}`);
        files.push({ path: `${conceptName}/${conceptName}.sol`, content: implLines.join('\n') });

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('generated', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
                language: 'solidity',
                fileCount: files.length,
                generatedAt: new Date().toISOString(),
              });
              return generateOk(files);
            },
            toStorageError,
          ),
        );
      }),
    ),

  register: (_input, _storage) =>
    TE.right(registerOk('solidity-gen', 'concept-ast', 'solidity', SOLIDITY_GEN_CAPABILITIES)),
};
