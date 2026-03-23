#!/usr/bin/env npx tsx
/**
 * Bulk-fix domain-specific success variants to 'ok' in .concept files.
 *
 * Heuristic: if an action has exactly ONE non-error variant and it isn't 'ok',
 * rename it to 'ok'. Actions with multiple non-error variants are legitimate
 * multi-outcome branches and are left untouched.
 *
 * Respects @suppress-variant-warning annotation — skips the entire concept.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';

const ROOT = process.cwd();

// Known error variants (never count these as "success")
const ERROR_VARIANTS = new Set([
  'error', 'notfound', 'not_found', 'invalid', 'unauthorized', 'forbidden',
  'unavailable', 'unsupported', 'conflict', 'timeout', 'duplicate',
]);

function findConceptFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          files.push(...findConceptFiles(full));
        } else if (entry.endsWith('.concept')) {
          files.push(full);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return files;
}

const dirs = ['specs', 'repertoire', 'score', 'bind', 'surface',
  'clef-account', 'clef-hub', 'clef-registry', 'clef-web', 'clef-base', 'clef-cli-bootstrap'];
const conceptFiles = dirs.flatMap(d => findConceptFiles(join(ROOT, d)));

let totalFixed = 0;

for (const filePath of conceptFiles) {
  let source = readFileSync(filePath, 'utf-8');

  // Skip concepts with suppression annotation
  if (source.includes('@suppress-variant-warning')) continue;

  let modified = false;

  try {
    const ast = parseConceptFile(source);
    if (!ast?.actions) continue;

    for (const action of ast.actions) {
      if (!action.variants) continue;

      // Find non-error variants
      const nonErrorVariants = action.variants.filter((v: any) => {
        const vName = v.name || v.tag;
        return vName && !ERROR_VARIANTS.has(vName);
      });

      // Only fix if there's exactly ONE non-error variant and it's not 'ok'
      if (nonErrorVariants.length !== 1) continue;
      const vName = nonErrorVariants[0].name || nonErrorVariants[0].tag;
      if (vName === 'ok') continue;

      // Replace variant declaration: -> variantName( → -> ok(
      const declPattern = new RegExp(`->\\s+${vName}\\(`, 'g');
      const newSource = source.replace(declPattern, '-> ok(');
      if (newSource !== source) {
        source = newSource;
        modified = true;
        totalFixed++;
      }
    }
  } catch {
    // Parse error — skip file
    continue;
  }

  if (modified) {
    writeFileSync(filePath, source);
    console.log(`  Fixed: ${relative(ROOT, filePath)}`);
  }
}

console.log(`\nTotal variant fixes: ${totalFixed}`);
