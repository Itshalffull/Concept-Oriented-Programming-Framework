#!/usr/bin/env npx tsx
/**
 * Migrate pure(p, { variant: '...', ...fields }) to complete(p, '...', { ...fields })
 * in all handler files. This ensures variants are properly registered in effects
 * for static analysis and sync coverage checking.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const dryRun = process.argv.includes('--dry-run');

// Find all handler files with pure() + variant pattern
const files = execSync(
  "grep -rl 'pure(.*variant:' handlers/ts/ --include='*.handler.ts'",
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;
let filesModified = 0;

for (const file of files) {
  let source = readFileSync(file, 'utf-8');
  let modified = false;

  // Pattern 1: p = pure(p, { variant: 'xxx', key1, key2, ... });
  // → p = complete(p, 'xxx', { key1, key2, ... });
  //
  // Pattern 2: return pure(createProgram(), { variant: 'xxx', ... }) as ...;
  // → return complete(createProgram(), 'xxx', { ... }) as ...;
  //
  // Pattern 3: pure(p, { variant: 'xxx' })  (no other fields)
  // → complete(p, 'xxx', {})

  // Match pure(..., { variant: '...', ...rest })
  // This regex handles the common cases
  const pureWithVariantRegex = /pure\(([^,]+),\s*\{\s*variant:\s*(['"])([^'"]+)\2\s*(?:,\s*([\s\S]*?))?\}\s*\)/g;

  const newSource = source.replace(pureWithVariantRegex, (_match, prog, _q, variant, rest) => {
    totalReplacements++;
    const trimmedRest = rest?.trim();
    if (trimmedRest) {
      // Remove trailing whitespace/comma from rest
      const cleanRest = trimmedRest.replace(/,\s*$/, '');
      return `complete(${prog}, '${variant}', { ${cleanRest} })`;
    } else {
      return `complete(${prog}, '${variant}', {})`;
    }
  });

  if (newSource !== source) {
    modified = true;

    // Ensure 'complete' is imported if not already
    if (!newSource.includes("import") ||
        (newSource.includes("from '") && newSource.includes("storage-program"))) {
      // Check if complete is already imported
      const importMatch = newSource.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*storage-program[^'"]*['"]/);
      if (importMatch && !importMatch[1].includes('complete')) {
        // Add 'complete' to the import
        const oldImport = importMatch[0];
        const imports = importMatch[1];
        // Add complete after the last import item
        const newImport = oldImport.replace(imports, imports.trimEnd() + ', complete');
        source = newSource.replace(oldImport, newImport);
      } else {
        source = newSource;
      }
    } else {
      source = newSource;
    }

    if (!dryRun) {
      writeFileSync(file, source);
    }
    filesModified++;
    console.log(`  ${dryRun ? '[dry-run] ' : ''}${file}: ${source === newSource ? 0 : 'updated'}`);
  }
}

console.log(`\nResults:`);
console.log(`  Files scanned: ${files.length}`);
console.log(`  Files modified: ${filesModified}`);
console.log(`  Total replacements: ${totalReplacements}`);
if (dryRun) console.log(`  (dry-run mode — no files written)`);
