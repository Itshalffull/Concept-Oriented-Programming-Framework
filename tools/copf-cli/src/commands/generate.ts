// ============================================================
// copf generate --target <lang> [--concept <Name>]
//
// Generates schemas and code for all (or a single) concept.
//
// Pipeline per Section 7.2:
//   1. Parse .concept → AST
//   2. SchemaGen (AST → ConceptManifest)
//   3. CodeGen (Manifest → target-language files)
//
// Generated output goes to the generated/ directory.
// ============================================================

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, relative, join } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { schemaGenHandler } from '../../../../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../../../../implementations/typescript/framework/typescript-gen.impl.js';
import { rustGenHandler } from '../../../../implementations/typescript/framework/rust-gen.impl.js';
import type { ConceptAST, ConceptManifest } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

const SUPPORTED_TARGETS = ['typescript', 'rust'] as const;
type Target = (typeof SUPPORTED_TARGETS)[number];

export async function generateCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const target = flags.target as string;
  if (!target || !SUPPORTED_TARGETS.includes(target as Target)) {
    console.error(
      `Usage: copf generate --target <${SUPPORTED_TARGETS.join('|')}> [--concept <Name>]`,
    );
    process.exit(1);
  }

  const filterConcept = flags.concept as string | undefined;
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const outDir = typeof flags.out === 'string' ? flags.out : 'generated';

  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');

  if (conceptFiles.length === 0) {
    console.log('No .concept files found.');
    return;
  }

  // Parse all specs
  const asts: { file: string; ast: ConceptAST }[] = [];
  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      if (filterConcept && ast.name !== filterConcept) continue;
      asts.push({ file: relative(projectDir, file), ast });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Parse error in ${relative(projectDir, file)}: ${message}`);
      process.exit(1);
    }
  }

  if (filterConcept && asts.length === 0) {
    console.error(`Concept "${filterConcept}" not found in spec files.`);
    process.exit(1);
  }

  console.log(
    `Generating ${target} code for ${asts.length} concept(s)...\n`,
  );

  let totalFiles = 0;

  for (const { file, ast } of asts) {
    // SchemaGen — produce ConceptManifest
    const schemaStorage = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate(
      { spec: file, ast },
      schemaStorage,
    );

    if (schemaResult.variant !== 'ok') {
      console.error(`Schema generation failed for ${ast.name}: ${schemaResult.message}`);
      process.exit(1);
    }

    const manifest = schemaResult.manifest as ConceptManifest;

    // Write JSON schemas
    const jsonSchemaDir = join(projectDir, outDir, 'schemas', 'json', ast.name.toLowerCase());
    mkdirSync(jsonSchemaDir, { recursive: true });
    writeFileSync(
      join(jsonSchemaDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );

    // Write GraphQL schema fragment
    const gqlDir = join(projectDir, outDir, 'schemas', 'graphql');
    mkdirSync(gqlDir, { recursive: true });
    writeFileSync(
      join(gqlDir, `${ast.name.toLowerCase()}.graphql`),
      manifest.graphqlSchema + '\n',
    );

    // CodeGen — produce target-language files
    const codeStorage = createInMemoryStorage();
    const generator =
      target === 'typescript' ? typescriptGenHandler : rustGenHandler;

    const codeResult = await generator.generate(
      { spec: file, manifest },
      codeStorage,
    );

    if (codeResult.variant !== 'ok') {
      console.error(
        `Code generation failed for ${ast.name}: ${codeResult.message}`,
      );
      process.exit(1);
    }

    const files = codeResult.files as { path: string; content: string }[];
    const targetDir = join(projectDir, outDir, target);
    mkdirSync(targetDir, { recursive: true });

    for (const f of files) {
      const filePath = join(targetDir, f.path);
      // Ensure nested directories exist (e.g., for Rust modules)
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, f.content + '\n');
    }

    totalFiles += files.length + 2; // +2 for manifest.json and .graphql
    console.log(`  ${ast.name}: ${files.length} ${target} file(s) + schemas`);
  }

  console.log(`\n${totalFiles} file(s) written to ${outDir}/`);
}
