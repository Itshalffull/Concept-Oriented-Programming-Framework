// Generate all language target output for formal verification suite concepts
// Run with: npx tsx scripts/generate-fv-suite.ts

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { nextjsGenHandler } from '../handlers/ts/framework/nextjs-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import { solidityGenHandler } from '../handlers/ts/framework/solidity-gen.handler.js';
import { swiftGenHandler } from '../handlers/ts/framework/swift-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import type { ConceptAST, ConceptManifest, ConceptHandler } from '../runtime/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const GENERATED_DIR = resolve(ROOT, 'generated');

const CONCEPTS: Array<{ path: string; name: string }> = [
  // Test suite addition
  { path: 'repertoire/concepts/testing/quality-signal.concept', name: 'QualitySignal' },
  // Formal verification suite
  { path: 'suites/formal-verification/formal-property.concept', name: 'FormalProperty' },
  { path: 'suites/formal-verification/contract.concept', name: 'Contract' },
  { path: 'suites/formal-verification/evidence.concept', name: 'Evidence' },
  { path: 'suites/formal-verification/verification-run.concept', name: 'VerificationRun' },
  { path: 'suites/formal-verification/solver-provider.concept', name: 'SolverProvider' },
  { path: 'suites/formal-verification/specification-schema.concept', name: 'SpecificationSchema' },
];

interface GeneratorDef {
  name: string;
  handler: ConceptHandler;
  outputDir: string;
}

const GENERATORS: GeneratorDef[] = [
  { name: 'nextjs', handler: nextjsGenHandler, outputDir: resolve(GENERATED_DIR, 'nextjs') },
  { name: 'rust', handler: rustGenHandler, outputDir: resolve(GENERATED_DIR, 'rust') },
  { name: 'solidity', handler: solidityGenHandler, outputDir: resolve(GENERATED_DIR, 'solidity') },
  { name: 'swift', handler: swiftGenHandler, outputDir: resolve(GENERATED_DIR, 'swift') },
  { name: 'typescript', handler: typescriptGenHandler, outputDir: resolve(GENERATED_DIR, 'typescript') },
];

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'gen', ast }, storage);
  if (result.variant !== 'ok') {
    throw new Error(`Schema generation failed: ${JSON.stringify(result)}`);
  }
  return result.manifest as ConceptManifest;
}

function toKebabCase(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

async function main() {
  console.log('Generating all language targets for formal verification suite...\n');
  let totalFiles = 0;

  for (const concept of CONCEPTS) {
    const specPath = resolve(ROOT, concept.path);
    console.log(`\n=== ${concept.name} ===`);

    try {
      const source = readFileSync(specPath, 'utf-8');
      const ast = parseConceptFile(source);
      const manifest = await generateManifest(ast);

      // Run all code generators
      for (const gen of GENERATORS) {
        const storage = createInMemoryStorage();
        const result = await gen.handler.generate({ spec: concept.name, manifest }, storage);

        if (result.variant !== 'ok') {
          console.error(`  [${gen.name}] ERROR: ${(result as any).message || JSON.stringify(result)}`);
          continue;
        }

        const files = result.files as Array<{ path: string; content: string }>;
        for (const file of files) {
          const outputPath = resolve(gen.outputDir, file.path);
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, file.content, 'utf-8');
          totalFiles++;
        }
        console.log(`  [${gen.name}] ${files.length} files`);
      }

      // Write GraphQL schema (embedded in manifest)
      if (manifest.graphqlSchema) {
        const kebab = toKebabCase(manifest.name);
        const graphqlPath = resolve(GENERATED_DIR, 'graphql', `${kebab}.graphql`);
        mkdirSync(dirname(graphqlPath), { recursive: true });
        writeFileSync(graphqlPath, manifest.graphqlSchema, 'utf-8');
        totalFiles++;
        console.log(`  [graphql] 1 file`);
      }

      // Write OpenAPI manifest (JSON schemas embedded in manifest)
      if (manifest.jsonSchemas) {
        const kebab = toKebabCase(manifest.name);
        const openapiDir = resolve(GENERATED_DIR, 'openapi', kebab);
        mkdirSync(openapiDir, { recursive: true });
        const manifestJson = {
          uri: manifest.uri,
          name: manifest.name,
          typeParams: manifest.typeParams,
          relations: manifest.relations,
          actions: manifest.actions,
          invariants: manifest.invariants,
          graphqlSchema: manifest.graphqlSchema,
          jsonSchemas: manifest.jsonSchemas,
          capabilities: manifest.capabilities,
          purpose: manifest.purpose,
          gate: manifest.gate,
        };
        writeFileSync(
          resolve(openapiDir, 'manifest.json'),
          JSON.stringify(manifestJson, null, 2),
          'utf-8',
        );
        totalFiles++;
        console.log(`  [openapi] 1 file`);
      }
    } catch (err) {
      console.error(`  ERROR processing ${concept.name}: ${err}`);
    }
  }

  console.log(`\nDone! Generated ${totalFiles} files total.`);
}

main().catch(console.error);
