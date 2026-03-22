#!/usr/bin/env npx tsx
/**
 * Spec-aware bulk-fix of handler variant names.
 *
 * For each handler, finds the corresponding .concept spec, parses it,
 * and determines which variants should be renamed to 'ok' using the same
 * heuristic as fix-variant-names.ts:
 *
 *   If an action has exactly ONE non-error variant and it isn't 'ok',
 *   rename it to 'ok' in the handler.
 *
 * This is safe because:
 * - Actions with multiple non-error variants (multi-outcome) are untouched
 * - Error variants are never renamed
 * - The concept spec is the source of truth
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, basename } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';

const ROOT = process.cwd();

// Known error variants — never rename
const ERROR_VARIANTS = new Set([
  'error', 'notfound', 'not_found', 'notFound', 'invalid', 'duplicate',
  'unauthorized', 'forbidden', 'conflict', 'timeout', 'unavailable',
  'unsupported', 'warning', 'exists', 'already_registered', 'already_member',
  'validationError', 'parseError', 'configError', 'imageNotFound',
  'invalidManifest', 'blocked', 'paused', 'partial', 'unreachable', 'empty',
  'noGrammar', 'noParser', 'alreadyExists', 'alreadyRunning', 'notRunning',
  'stale', 'rejected', 'cannotResolve', 'overflow', 'exhausted',
  'max_attempts_reached', 'tooManyRetries', 'rateLimited',
  'not_found', 'specerror', 'loaderror', 'alreadyRegistered',
]);

function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) files.push(...findFiles(full, ext));
        else if (entry.endsWith(ext)) files.push(full);
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return files;
}

// Build index: conceptName → conceptFilePath
const conceptIndex = new Map<string, string>();
const conceptDirs = ['specs', 'repertoire', 'score', 'bind', 'surface',
  'clef-account/concepts', 'clef-hub/concepts', 'clef-registry/concepts',
  'clef-web/concepts', 'clef-base/concepts', 'clef-cli-bootstrap/concepts'];
for (const dir of conceptDirs) {
  const fullDir = join(ROOT, dir);
  if (!existsSync(fullDir)) continue;
  for (const f of findFiles(fullDir, '.concept')) {
    try {
      const src = readFileSync(f, 'utf-8');
      const ast = parseConceptFile(src);
      if (ast?.name) {
        conceptIndex.set(ast.name, f);
      }
    } catch { /* skip unparseable */ }
  }
}
console.log(`Indexed ${conceptIndex.size} concept specs`);

// For each concept, compute the set of variant names that should become 'ok'
type RenameMap = Map<string, Set<string>>; // conceptName → set of old variant names
const renameMap: RenameMap = new Map();

for (const [conceptName, conceptPath] of conceptIndex) {
  try {
    const src = readFileSync(conceptPath, 'utf-8');
    const ast = parseConceptFile(src);
    if (!ast?.actions) continue;

    const toRename = new Set<string>();
    for (const action of ast.actions) {
      if (!action.variants) continue;
      const nonError = action.variants.filter((v: any) => {
        const vn = v.name || v.tag;
        return vn && !ERROR_VARIANTS.has(vn);
      });
      // Single non-error variant that isn't 'ok' → should be renamed
      if (nonError.length === 1) {
        const vn = nonError[0].name || nonError[0].tag;
        if (vn !== 'ok') toRename.add(vn);
      }
    }
    if (toRename.size > 0) {
      renameMap.set(conceptName, toRename);
    }
  } catch { /* skip */ }
}

console.log(`${renameMap.size} concepts have variants to rename`);

// Find handler files and apply renames
const handlerFiles = findFiles(ROOT, '.handler.ts')
  .filter(f => !f.includes('node_modules'));

let totalFixed = 0;
let filesFixed = 0;

for (const handlerPath of handlerFiles) {
  let source = readFileSync(handlerPath, 'utf-8');

  // Try to detect which concept this handler implements
  // Look for @clef-handler annotation or concept name in the file
  const handlerAnnotation = source.match(/@clef-handler\s+(\w+)/);
  const handlerBaseName = basename(handlerPath, '.handler.ts');

  // Collect all variant names to rename for this handler
  const variantsToRename = new Set<string>();

  // Strategy 1: @clef-handler annotation
  if (handlerAnnotation) {
    const conceptName = handlerAnnotation[1];
    const renames = renameMap.get(conceptName);
    if (renames) renames.forEach(v => variantsToRename.add(v));
  }

  // Strategy 2: match handler filename to concept name
  // Convert kebab-case to PascalCase: "my-concept" → "MyConcept"
  const pascalName = handlerBaseName
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  if (!handlerAnnotation) {
    const renames = renameMap.get(pascalName);
    if (renames) renames.forEach(v => variantsToRename.add(v));
  }

  if (variantsToRename.size === 0) continue;

  let modified = false;
  let newSource = source;

  for (const oldVariant of variantsToRename) {
    // Fix imperative: variant: 'oldVariant'
    const impPattern = new RegExp(`variant:\\s*'${oldVariant}'`, 'g');
    const after1 = newSource.replace(impPattern, "variant: 'ok'");

    // Fix functional: complete(p, 'oldVariant' / completeFrom(p, 'oldVariant'
    const fnPattern = new RegExp(`(complete(?:From)?)\\((\\w+),\\s*'${oldVariant}'`, 'g');
    const after2 = after1.replace(fnPattern, "$1($2, 'ok'");

    if (after2 !== newSource) {
      newSource = after2;
      modified = true;
      totalFixed++;
    }
  }

  if (modified) {
    writeFileSync(handlerPath, newSource);
    filesFixed++;
    console.log(`  Fixed: ${relative(ROOT, handlerPath)} (${[...variantsToRename].join(', ')} → ok)`);
  }
}

console.log(`\n${filesFixed} handler files fixed, ${totalFixed} variant replacements`);
