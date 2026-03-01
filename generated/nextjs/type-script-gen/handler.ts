// TypeScriptGen — TypeScript code generator: transforms concept AST into TypeScript source
// files including types, handlers, storage interfaces, and variant constructors.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TypeScriptGenStorage,
  TypeScriptGenGenerateInput,
  TypeScriptGenGenerateOutput,
  TypeScriptGenRegisterInput,
  TypeScriptGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  registerOk,
} from './types.js';

export interface TypeScriptGenError {
  readonly code: string;
  readonly message: string;
}

export interface TypeScriptGenHandler {
  readonly generate: (
    input: TypeScriptGenGenerateInput,
    storage: TypeScriptGenStorage,
  ) => TE.TaskEither<TypeScriptGenError, TypeScriptGenGenerateOutput>;
  readonly register: (
    input: TypeScriptGenRegisterInput,
    storage: TypeScriptGenStorage,
  ) => TE.TaskEither<TypeScriptGenError, TypeScriptGenRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): TypeScriptGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const TS_GEN_CAPABILITIES: readonly string[] = [
  'types',
  'handler-interface',
  'storage-interface',
  'variant-constructors',
  'fp-ts-integration',
] as const;

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const toCamelCase = (s: string): string => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
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

const mapTypeToTs = (t: string): string => {
  switch (t) {
    case 'string': return 'string';
    case 'number': case 'integer': case 'float': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'Date';
    case 'array': return 'readonly unknown[]';
    case 'object': return 'Record<string, unknown>';
    default: return 'unknown';
  }
};

// --- Implementation ---

export const typeScriptGenHandler: TypeScriptGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractManifest(input.manifest)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid manifest: must be an object with a "name" field and "operations" array',
          ) as TypeScriptGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const files: { readonly path: string; readonly content: string }[] = [];

        // Generate types.ts
        const typeLines: string[] = [
          `// ${conceptName} — types.ts`,
          `// TypeScript types generated from concept spec '${input.spec}'.`,
          ``,
          `import * as O from 'fp-ts/Option';`,
          ``,
          `// Storage interface for ${conceptName}`,
          `export interface ${conceptName}Storage {`,
          `  readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;`,
          `  readonly put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;`,
          `  readonly delete: (relation: string, key: string) => Promise<boolean>;`,
          `  readonly find: (relation: string, filter?: Record<string, unknown>) => Promise<readonly Record<string, unknown>[]>;`,
          `}`,
          ``,
        ];

        // Generate input/output types for each operation
        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);

          // Input type
          typeLines.push(`export interface ${conceptName}${opPascal}Input {`);
          for (const field of op.input) {
            typeLines.push(`  readonly ${field.name}: ${mapTypeToTs(field.type)};`);
          }
          typeLines.push(`}`, ``);

          // Output variant types
          for (const variant of op.output) {
            const variantPascal = toPascalCase(variant.variant);
            typeLines.push(`export interface ${conceptName}${opPascal}Output${variantPascal} {`);
            typeLines.push(`  readonly variant: '${variant.variant}';`);
            for (const field of variant.fields) {
              typeLines.push(`  readonly ${field.name}: ${mapTypeToTs(field.type)};`);
            }
            typeLines.push(`}`, ``);
          }

          // Union type
          if (op.output.length > 0) {
            const variants = op.output
              .map((v) => `${conceptName}${opPascal}Output${toPascalCase(v.variant)}`)
              .join(' | ');
            typeLines.push(`export type ${conceptName}${opPascal}Output = ${variants};`, ``);
          }
        }

        // Generate variant constructors
        typeLines.push(`// --- Variant constructors ---`, ``);
        for (const op of parsed.operations) {
          const opCamel = toCamelCase(op.name);
          for (const variant of op.output) {
            const params = variant.fields.map((f) => `${f.name}: ${mapTypeToTs(f.type)}`).join(', ');
            const spreadFields = variant.fields.map((f) => f.name).join(', ');
            const opPascal = toPascalCase(op.name);
            typeLines.push(
              `export const ${opCamel}${toPascalCase(variant.variant)} = (${params}): ${conceptName}${opPascal}Output => ({ variant: '${variant.variant}', ${spreadFields} } as ${conceptName}${opPascal}Output);`,
            );
          }
        }
        typeLines.push(``);

        files.push({ path: `${parsed.name}/types.ts`, content: typeLines.join('\n') });

        // Generate handler.ts skeleton
        const handlerLines: string[] = [
          `// ${conceptName} — handler.ts`,
          `// TypeScript handler generated from concept spec '${input.spec}'.`,
          ``,
          `import * as TE from 'fp-ts/TaskEither';`,
          `import * as O from 'fp-ts/Option';`,
          `import { pipe } from 'fp-ts/function';`,
          ``,
          `import type { ${conceptName}Storage } from './types.js';`,
          ``,
          `export interface ${conceptName}Error {`,
          `  readonly code: string;`,
          `  readonly message: string;`,
          `}`,
          ``,
        ];

        files.push({ path: `${parsed.name}/handler.ts`, content: handlerLines.join('\n') });

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('generated', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
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
    TE.right(registerOk('typescript-gen', 'concept-ast', 'typescript', TS_GEN_CAPABILITIES)),
};
