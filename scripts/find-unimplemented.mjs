import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

function walk(dir, ext) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) results.push(...walk(full, ext));
        else if (entry.endsWith(ext)) results.push(full.replaceAll('\\', '/'));
      } catch {}
    }
  } catch {}
  return results;
}

// All concept files (excluding concept-interface/ which has old generated stubs)
const concepts = walk('.', '.concept')
  .filter(p => !p.includes('concept-interface/'))
  .map(p => ({
    path: p.replace(/^\.\//, ''),
    stem: basename(p, '.concept'),
  }));

// All impl file stems
const implStems = new Set(
  walk('.', '.impl.ts').map(p => basename(p, '.impl.ts'))
);

const missing = concepts.filter(c => !implStems.has(c.stem));
const hasImpl = concepts.filter(c => implStems.has(c.stem));

console.log(`WITH impl: ${hasImpl.length}`);
console.log(`WITHOUT impl: ${missing.length}`);
console.log('');
console.log('=== MISSING IMPLEMENTATIONS ===');
missing.forEach(c => console.log(c.path));

// Also show which are already in the devtools manifest
console.log('');
console.log('=== ALREADY IN MANIFEST ===');
const manifestConcepts = [
  'specs/framework/spec-parser.concept',
  'specs/framework/schema-gen.concept',
  'specs/framework/sync-parser.concept',
  'specs/framework/sync-compiler.concept',
  'specs/framework/flow-trace.concept',
  'specs/framework/deployment-validator.concept',
  'specs/framework/project-scaffold.concept',
  'specs/framework/dev-server.concept',
  'specs/framework/suite-manager.concept',
  'suites/generation/emitter.concept',
  'suites/generation/build-cache.concept',
  'suites/generation/resource.concept',
  'suites/generation/kind-system.concept',
  'suites/generation/generation-plan.concept',
  'suites/deploy/concepts/builder.concept',
  'suites/deploy/concepts/toolchain.concept',
  'specs/framework/suite-scaffold-gen.concept',
  'specs/framework/deploy-scaffold-gen.concept',
  'specs/framework/interface-scaffold-gen.concept',
  'specs/framework/concept-scaffold-gen.concept',
  'specs/framework/sync-scaffold-gen.concept',
  'specs/framework/handler-scaffold-gen.concept',
  'specs/framework/storage-adapter-scaffold-gen.concept',
  'specs/framework/transport-adapter-scaffold-gen.concept',
  'specs/framework/surface-component-scaffold-gen.concept',
  'specs/framework/surface-theme-scaffold-gen.concept',
  'suites/interface/concepts/generator.concept',
  'suites/interface/concepts/projection.concept',
  'suites/interface/concepts/api-surface.concept',
  'suites/test/conformance.concept',
  'suites/test/test-selection.concept',
  'suites/test/flaky-test.concept',
  'suites/test/contract-test.concept',
  'suites/test/snapshot.concept',
];
const manifestSet = new Set(manifestConcepts);

const notInManifest = missing.filter(c => !manifestSet.has(c.path));
console.log('');
console.log(`=== NEED TO ADD TO MANIFEST (${notInManifest.length}) ===`);
notInManifest.forEach(c => console.log(`  - ${c.path}`));
