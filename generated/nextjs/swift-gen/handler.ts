// SwiftGen — Swift code generator: transforms concept AST into Swift source files
// including protocols, implementations, storage conformances, and enum-based variants.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SwiftGenStorage,
  SwiftGenGenerateInput,
  SwiftGenGenerateOutput,
  SwiftGenRegisterInput,
  SwiftGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  registerOk,
} from './types.js';

export interface SwiftGenError {
  readonly code: string;
  readonly message: string;
}

export interface SwiftGenHandler {
  readonly generate: (
    input: SwiftGenGenerateInput,
    storage: SwiftGenStorage,
  ) => TE.TaskEither<SwiftGenError, SwiftGenGenerateOutput>;
  readonly register: (
    input: SwiftGenRegisterInput,
    storage: SwiftGenStorage,
  ) => TE.TaskEither<SwiftGenError, SwiftGenRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): SwiftGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const SWIFT_GEN_CAPABILITIES: readonly string[] = [
  'protocols',
  'implementations',
  'enums',
  'codable-conformance',
  'async-await',
] as const;

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const toCamelCase = (s: string): string => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const mapTypeToSwift = (t: string): string => {
  switch (t) {
    case 'string': return 'String';
    case 'number': case 'integer': return 'Int';
    case 'float': return 'Double';
    case 'boolean': return 'Bool';
    case 'date': return 'Date';
    case 'array': return '[Any]';
    case 'object': return '[String: Any]';
    default: return 'Any';
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

export const swiftGenHandler: SwiftGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractManifest(input.manifest)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid manifest: must be an object with "name" and "operations" fields',
          ) as SwiftGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const files: { readonly path: string; readonly content: string }[] = [];

        // Generate Protocol file
        const protocolLines: string[] = [
          `// ${conceptName} — Protocol`,
          `// Swift protocol generated from concept spec '${input.spec}'.`,
          ``,
          `import Foundation`,
          ``,
          `protocol ${conceptName}Handler {`,
        ];

        for (const op of parsed.operations) {
          const opName = toCamelCase(op.name);
          const inputType = `${conceptName}${toPascalCase(op.name)}Input`;
          const outputType = `${conceptName}${toPascalCase(op.name)}Output`;
          protocolLines.push(`    func ${opName}(input: ${inputType}) async throws -> ${outputType}`);
        }

        protocolLines.push(`}`, ``);
        files.push({ path: `${conceptName}/Handler.swift`, content: protocolLines.join('\n') });

        // Generate Types file with enums for output variants
        const typesLines: string[] = [
          `// ${conceptName} — Types`,
          `// Swift types generated from concept spec '${input.spec}'.`,
          ``,
          `import Foundation`,
          ``,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);

          // Input struct
          typesLines.push(`struct ${conceptName}${opPascal}Input: Codable {`);
          for (const field of op.input) {
            typesLines.push(`    let ${toCamelCase(field.name)}: ${mapTypeToSwift(field.type)}`);
          }
          typesLines.push(`}`, ``);

          // Output enum with associated values
          typesLines.push(`enum ${conceptName}${opPascal}Output {`);
          for (const variant of op.output) {
            const fields = variant.fields
              .map((f) => `${toCamelCase(f.name)}: ${mapTypeToSwift(f.type)}`)
              .join(', ');
            typesLines.push(`    case ${toCamelCase(variant.variant)}(${fields})`);
          }
          typesLines.push(`}`, ``);
        }

        files.push({ path: `${conceptName}/Types.swift`, content: typesLines.join('\n') });

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('generated', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
                language: 'swift',
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
    TE.right(registerOk('swift-gen', 'concept-ast', 'swift', SWIFT_GEN_CAPABILITIES)),
};
