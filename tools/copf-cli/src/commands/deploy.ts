// ============================================================
// copf deploy --manifest <file>
//
// Validates and processes a deployment manifest per Section 6
// of the architecture doc.
//
// Deployment Validation:
//   - Parse the manifest
//   - Validate runtime configs
//   - Check concept placements against capabilities
//   - Verify sync assignments
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { parseConceptFile } from '../../../../implementations/typescript/framework/spec-parser.impl.js';
import {
  parseDeploymentManifest,
  validateDeploymentManifest,
} from '../../../../implementations/typescript/framework/deployment-validator.impl.js';
import type { ConceptAST } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

export async function deployCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const manifestPath = flags.manifest as string;
  if (!manifestPath) {
    console.error('Usage: copf deploy --manifest <file>');
    process.exit(1);
  }

  const projectDir = resolve(process.cwd());
  const fullPath = resolve(projectDir, manifestPath);

  if (!existsSync(fullPath)) {
    console.error(`Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }

  console.log(`Validating deployment manifest: ${manifestPath}\n`);

  const source = readFileSync(fullPath, 'utf-8');

  // Parse the deployment manifest
  let manifest;
  try {
    manifest = parseDeploymentManifest(source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Manifest parse error: ${message}`);
    process.exit(1);
  }

  // Load concept specs for capability checking
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  const conceptASTs = new Map<string, ConceptAST>();

  for (const file of conceptFiles) {
    const src = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(src);
      conceptASTs.set(ast.name, ast);
    } catch {
      // Skip unparseable
    }
  }

  // Validate the manifest
  const validation = validateDeploymentManifest(manifest, conceptASTs);

  // Print runtimes
  console.log('Runtimes:');
  if (manifest.runtimes && manifest.runtimes.length > 0) {
    for (const rt of manifest.runtimes) {
      console.log(`  - ${rt.name} (${rt.type})`);
      if (rt.capabilities) {
        console.log(`    capabilities: ${rt.capabilities.join(', ')}`);
      }
    }
  } else {
    console.log('  (none defined)');
  }

  // Print concept placements
  console.log('\nConcept Placements:');
  if (manifest.concepts && manifest.concepts.length > 0) {
    for (const c of manifest.concepts) {
      console.log(`  - ${c.name} → ${c.runtime}`);
    }
  } else {
    console.log('  (none defined)');
  }

  // Print sync assignments
  console.log('\nSync Assignments:');
  if (manifest.syncs && manifest.syncs.length > 0) {
    for (const s of manifest.syncs) {
      console.log(`  - ${s.name} → ${s.runtime}`);
    }
  } else {
    console.log('  (none defined)');
  }

  // Print validation results
  if (validation.errors.length > 0) {
    console.log('\nValidation Errors:');
    for (const err of validation.errors) {
      console.log(`  ERROR: ${err}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warn of validation.warnings) {
      console.log(`  WARN: ${warn}`);
    }
  }

  if (validation.errors.length === 0) {
    console.log('\nDeployment manifest is valid.');
  } else {
    console.log(
      `\nValidation failed: ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`,
    );
    process.exit(1);
  }
}
