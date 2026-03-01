// RustGen — Rust code generator: transforms concept AST into Rust source files
// including structs, enums, trait definitions, and impl blocks.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RustGenStorage,
  RustGenGenerateInput,
  RustGenGenerateOutput,
  RustGenRegisterInput,
  RustGenRegisterOutput,
} from './types.js';

import {
  generateOk,
  generateError,
  registerOk,
} from './types.js';

export interface RustGenError {
  readonly code: string;
  readonly message: string;
}

export interface RustGenHandler {
  readonly generate: (
    input: RustGenGenerateInput,
    storage: RustGenStorage,
  ) => TE.TaskEither<RustGenError, RustGenGenerateOutput>;
  readonly register: (
    input: RustGenRegisterInput,
    storage: RustGenStorage,
  ) => TE.TaskEither<RustGenError, RustGenRegisterOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): RustGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const RUST_GEN_CAPABILITIES: readonly string[] = [
  'structs',
  'enums',
  'traits',
  'impl-blocks',
  'serde-derive',
  'result-types',
] as const;

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const toSnakeCase = (s: string): string =>
  s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/-/g, '_');

const mapTypeToRust = (t: string): string => {
  switch (t) {
    case 'string': return 'String';
    case 'number': case 'integer': return 'i64';
    case 'float': return 'f64';
    case 'boolean': return 'bool';
    case 'date': return 'String'; // ISO 8601 string representation
    case 'array': return 'Vec<serde_json::Value>';
    case 'object': return 'std::collections::HashMap<String, serde_json::Value>';
    default: return 'serde_json::Value';
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

export const rustGenHandler: RustGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractManifest(input.manifest)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid manifest: must be an object with "name" and "operations" fields',
          ) as RustGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const moduleName = toSnakeCase(parsed.name);
        const files: { readonly path: string; readonly content: string }[] = [];

        // Generate types.rs
        const typesLines: string[] = [
          `//! ${conceptName} — types`,
          `//! Rust types generated from concept spec '${input.spec}'.`,
          ``,
          `use serde::{Deserialize, Serialize};`,
          ``,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);

          // Input struct
          typesLines.push(
            `#[derive(Debug, Clone, Serialize, Deserialize)]`,
            `pub struct ${opPascal}Input {`,
          );
          for (const field of op.input) {
            typesLines.push(`    pub ${toSnakeCase(field.name)}: ${mapTypeToRust(field.type)},`);
          }
          typesLines.push(`}`, ``);

          // Output enum
          if (op.output.length > 0) {
            typesLines.push(
              `#[derive(Debug, Clone, Serialize, Deserialize)]`,
              `#[serde(tag = "variant")]`,
              `pub enum ${opPascal}Output {`,
            );
            for (const variant of op.output) {
              const variantPascal = toPascalCase(variant.variant);
              if (variant.fields.length > 0) {
                typesLines.push(`    ${variantPascal} {`);
                for (const field of variant.fields) {
                  typesLines.push(`        ${toSnakeCase(field.name)}: ${mapTypeToRust(field.type)},`);
                }
                typesLines.push(`    },`);
              } else {
                typesLines.push(`    ${variantPascal},`);
              }
            }
            typesLines.push(`}`, ``);
          }
        }

        files.push({ path: `${moduleName}/types.rs`, content: typesLines.join('\n') });

        // Generate handler.rs with trait definition
        const handlerLines: string[] = [
          `//! ${conceptName} — handler`,
          `//! Rust handler trait generated from concept spec '${input.spec}'.`,
          ``,
          `use super::types::*;`,
          `use async_trait::async_trait;`,
          ``,
          `#[derive(Debug)]`,
          `pub struct ${conceptName}Error {`,
          `    pub code: String,`,
          `    pub message: String,`,
          `}`,
          ``,
          `#[async_trait]`,
          `pub trait ${conceptName}Handler {`,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);
          const fnName = toSnakeCase(op.name);
          handlerLines.push(
            `    async fn ${fnName}(&self, input: ${opPascal}Input) -> Result<${opPascal}Output, ${conceptName}Error>;`,
          );
        }

        handlerLines.push(`}`, ``);
        files.push({ path: `${moduleName}/handler.rs`, content: handlerLines.join('\n') });

        // Generate mod.rs
        const modLines: string[] = [
          `//! ${conceptName} module`,
          ``,
          `pub mod types;`,
          `pub mod handler;`,
          ``,
        ];
        files.push({ path: `${moduleName}/mod.rs`, content: modLines.join('\n') });

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('generated', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
                language: 'rust',
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
    TE.right(registerOk('rust-gen', 'concept-ast', 'rust', RUST_GEN_CAPABILITIES)),
};
