// Conduit Example App — Generate All Language Targets
// Runs all 4 code generators against all 10 app concepts.
// Produces TypeScript, Rust, Swift, and Solidity output.

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { parseConceptFile } from '../../handlers/ts/framework/spec-parser.handler.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { schemaGenHandler } from '../../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../../handlers/ts/framework/rust-gen.handler.js';
import { swiftGenHandler } from '../../handlers/ts/framework/swift-gen.handler.js';
import { solidityGenHandler } from '../../handlers/ts/framework/solidity-gen.handler.js';
import type { ConceptAST, ConceptManifest, ConceptHandler } from '../../runtime/types.js';

const PROJECT_ROOT = resolve(import.meta.dirname || __dirname, '..', '..');
const SPECS_DIR = resolve(PROJECT_ROOT, 'specs', 'app');
const OUTPUT_DIR = resolve(import.meta.dirname || __dirname, 'generated');

const CONCEPT_NAMES = [
  'echo', 'user', 'password', 'jwt', 'article',
  'profile', 'comment', 'follow', 'favorite', 'tag',
];

const GENERATORS: { name: string; target: string; handler: ConceptHandler }[] = [
  { name: 'TypeScript', target: 'typescript', handler: typescriptGenHandler },
  { name: 'Rust', target: 'rust', handler: rustGenHandler },
  { name: 'Swift', target: 'swift', handler: swiftGenHandler },
  { name: 'Solidity', target: 'solidity', handler: solidityGenHandler },
];

async function generateAll() {
  console.log('Generating code for all 10 Conduit concepts across 4 language targets...\n');

  let totalFiles = 0;
  const manifests: Record<string, ConceptManifest> = {};

  // Parse all concepts and generate manifests
  for (const name of CONCEPT_NAMES) {
    const source = readFileSync(resolve(SPECS_DIR, `${name}.concept`), 'utf-8');
    const ast = parseConceptFile(source);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate({ spec: name, ast }, storage);

    if (result.variant !== 'ok') {
      console.error(`SchemaGen failed for ${name}: ${result.message}`);
      process.exit(1);
    }

    manifests[name] = result.manifest as ConceptManifest;

    // Write JSON schema
    const jsonDir = join(OUTPUT_DIR, 'schemas', 'json', name);
    mkdirSync(jsonDir, { recursive: true });
    writeFileSync(join(jsonDir, 'manifest.json'), JSON.stringify(manifests[name], null, 2) + '\n');

    // Write GraphQL fragment
    const gqlDir = join(OUTPUT_DIR, 'schemas', 'graphql');
    mkdirSync(gqlDir, { recursive: true });
    writeFileSync(join(gqlDir, `${name}.graphql`), manifests[name].graphqlSchema + '\n');

    totalFiles += 2;
  }

  console.log(`  Schemas: ${CONCEPT_NAMES.length} JSON + ${CONCEPT_NAMES.length} GraphQL\n`);

  // Generate code for each language target
  for (const gen of GENERATORS) {
    console.log(`  ${gen.name}:`);
    const targetDir = join(OUTPUT_DIR, gen.target);
    mkdirSync(targetDir, { recursive: true });

    for (const name of CONCEPT_NAMES) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: `conduit-${name}`, manifest: manifests[name] },
        storage,
      );

      if (result.variant !== 'ok') {
        console.error(`    ${name}: FAILED - ${result.message}`);
        continue;
      }

      const files = result.files as { path: string; content: string }[];
      for (const f of files) {
        const filePath = join(targetDir, f.path);
        mkdirSync(join(filePath, '..'), { recursive: true });
        writeFileSync(filePath, f.content + '\n');
      }

      totalFiles += files.length;
      console.log(`    ${name}: ${files.length} file(s)`);
    }
    console.log('');
  }

  // Write build configs for each target

  // Rust Cargo.toml
  writeFileSync(join(OUTPUT_DIR, 'rust', 'Cargo.toml'), `[package]
name = "conduit-concepts"
version = "0.1.0"
edition = "2021"

[dependencies]
async-trait = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
chrono = "0.4"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
`);

  // Swift Package.swift
  writeFileSync(join(OUTPUT_DIR, 'swift', 'Package.swift'), `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ConduitConcepts",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "ConduitConcepts", targets: ["ConduitConcepts"]),
    ],
    targets: [
        .target(name: "ConduitConcepts", path: "."),
        .testTarget(name: "ConduitConceptsTests", dependencies: ["ConduitConcepts"]),
    ]
)
`);

  // Solidity foundry.toml
  writeFileSync(join(OUTPUT_DIR, 'solidity', 'foundry.toml'), `[profile.default]
src = "."
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
`);

  totalFiles += 3;

  console.log(`\nGeneration complete: ${totalFiles} files written to ${OUTPUT_DIR}/`);
  console.log(`  TypeScript: types + handlers + adapters + conformance tests`);
  console.log(`  Rust:       types + handlers + adapters + conformance tests + Cargo.toml`);
  console.log(`  Swift:      types + handlers + adapters + conformance tests + Package.swift`);
  console.log(`  Solidity:   contracts + foundry tests + foundry.toml`);
  console.log(`  Schemas:    10 JSON manifests + 10 GraphQL fragments`);
}

generateAll().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
