// NextjsGen — Next.js code generator: transforms concept AST into Next.js App Router
// route handlers, server actions, and API endpoints with fp-ts integration.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NextjsGenStorage,
  NextjsGenGenerateInput,
  NextjsGenGenerateOutput,
} from './types.js';

import {
  generateOk,
  generateError,
} from './types.js';

export interface NextjsGenError {
  readonly code: string;
  readonly message: string;
}

export interface NextjsGenHandler {
  readonly generate: (
    input: NextjsGenGenerateInput,
    storage: NextjsGenStorage,
  ) => TE.TaskEither<NextjsGenError, NextjsGenGenerateOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): NextjsGenError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const toPascalCase = (s: string): string =>
  s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const toCamelCase = (s: string): string => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const toKebabCase = (s: string): string =>
  s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/_/g, '-');

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

export const nextjsGenHandler: NextjsGenHandler = {
  generate: (input, storage) =>
    pipe(
      TE.of(extractManifest(input.manifest)),
      TE.chain((parsed) => {
        if (parsed === null) {
          return TE.right(generateError(
            'Invalid manifest: must be an object with "name" and "operations" fields',
          ) as NextjsGenGenerateOutput);
        }

        const conceptName = toPascalCase(parsed.name);
        const kebabName = toKebabCase(parsed.name);
        const files: { readonly path: string; readonly content: string }[] = [];

        // Generate types.ts (shared between server and client)
        const typesLines: string[] = [
          `// ${conceptName} — Next.js types`,
          `// Types generated from concept spec '${input.spec}' for Next.js App Router.`,
          ``,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);
          typesLines.push(`export interface ${conceptName}${opPascal}Input {`);
          for (const field of op.input) {
            typesLines.push(`  readonly ${field.name}: ${field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string'};`);
          }
          typesLines.push(`}`, ``);

          for (const variant of op.output) {
            const variantPascal = toPascalCase(variant.variant);
            typesLines.push(`export interface ${conceptName}${opPascal}Output${variantPascal} {`);
            typesLines.push(`  readonly variant: '${variant.variant}';`);
            for (const field of variant.fields) {
              typesLines.push(`  readonly ${field.name}: ${field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string'};`);
            }
            typesLines.push(`}`, ``);
          }

          if (op.output.length > 0) {
            typesLines.push(
              `export type ${conceptName}${opPascal}Output = ${op.output.map((v) => `${conceptName}${opPascal}Output${toPascalCase(v.variant)}`).join(' | ')};`,
              ``,
            );
          }
        }

        files.push({
          path: `app/api/${kebabName}/types.ts`,
          content: typesLines.join('\n'),
        });

        // Generate route handler for each operation
        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);
          const opKebab = toKebabCase(op.name);

          const routeLines: string[] = [
            `// ${conceptName} ${opPascal} — Next.js Route Handler`,
            `// API route generated from concept spec '${input.spec}'.`,
            ``,
            `import { NextRequest, NextResponse } from 'next/server';`,
            `import type { ${conceptName}${opPascal}Input } from '../types';`,
            ``,
            `export async function POST(request: NextRequest) {`,
            `  try {`,
            `    const body: ${conceptName}${opPascal}Input = await request.json();`,
            ``,
          ];

          // Validate required fields
          for (const field of op.input) {
            routeLines.push(
              `    if (body.${field.name} === undefined) {`,
              `      return NextResponse.json(`,
              `        { variant: 'error', message: 'Missing required field: ${field.name}' },`,
              `        { status: 400 },`,
              `      );`,
              `    }`,
            );
          }

          routeLines.push(
            ``,
            `    // Delegate to handler implementation`,
            `    const result = { variant: 'ok' as const };`,
            `    return NextResponse.json(result);`,
            `  } catch (error) {`,
            `    return NextResponse.json(`,
            `      { variant: 'error', message: error instanceof Error ? error.message : 'Internal server error' },`,
            `      { status: 500 },`,
            `    );`,
            `  }`,
            `}`,
            ``,
          );

          files.push({
            path: `app/api/${kebabName}/${opKebab}/route.ts`,
            content: routeLines.join('\n'),
          });
        }

        // Generate server action for each operation
        const actionLines: string[] = [
          `// ${conceptName} — Server Actions`,
          `// Next.js server actions generated from concept spec '${input.spec}'.`,
          ``,
          `'use server';`,
          ``,
        ];

        for (const op of parsed.operations) {
          const opPascal = toPascalCase(op.name);
          const opCamel = toCamelCase(op.name);

          actionLines.push(
            `export async function ${opCamel}(input: Record<string, unknown>) {`,
            `  const response = await fetch(\`/api/${kebabName}/${toKebabCase(op.name)}\`, {`,
            `    method: 'POST',`,
            `    headers: { 'Content-Type': 'application/json' },`,
            `    body: JSON.stringify(input),`,
            `  });`,
            `  return response.json();`,
            `}`,
            ``,
          );
        }

        files.push({
          path: `app/api/${kebabName}/actions.ts`,
          content: actionLines.join('\n'),
        });

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('generated', input.spec, {
                spec: input.spec,
                conceptName: parsed.name,
                language: 'nextjs',
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
};
