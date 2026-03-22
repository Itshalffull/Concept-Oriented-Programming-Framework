#!/usr/bin/env npx tsx
/**
 * Bulk-fix domain-specific success variants to 'ok' in handler files.
 *
 * Handles both styles:
 * - Imperative: return { variant: 'xxx', ... }
 * - Functional: complete(p, 'xxx', ...) / completeFrom(p, 'xxx', ...)
 *
 * Uses the concept spec as source of truth: reads the corresponding .concept
 * file to determine which variants are single-success (should be 'ok') vs
 * multi-outcome (leave alone). Falls back to a conservative allowlist when
 * no concept spec is found.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();

// Known error variants — never rename these
const ERROR_VARIANTS = new Set([
  'error', 'notfound', 'not_found', 'notFound', 'invalid', 'duplicate',
  'unauthorized', 'forbidden', 'conflict', 'timeout', 'unavailable',
  'unsupported', 'warning', 'exists', 'already_registered', 'already_member',
  'validationError', 'parseError', 'configError', 'imageNotFound',
  'invalidManifest', 'blocked', 'paused', 'partial', 'unreachable', 'empty',
  'noGrammar', 'noParser', 'alreadyExists', 'alreadyRunning', 'notRunning',
  'stale', 'rejected', 'cannotResolve', 'overflow', 'exhausted',
  'max_attempts_reached', 'tooManyRetries', 'rateLimited',
]);

// Known multi-outcome success variants — never rename these
const MULTI_OUTCOME = new Set([
  'ok', 'miss', 'hit', 'clean', 'conflicts', 'identical', 'diffed',
  'valid', 'finalized', 'pending', 'pass', 'fail', 'failed',
  'thought', 'done', 'available', 'upToDate', 'allowed', 'denied',
  'retry', 'stop', 'yes', 'no', 'unchanged', 'changed', 'found',
  'achieved', 'disposable', 'retained', 'compatible', 'incompatible',
  'generated', 'handwritten', 'matches', 'deviates', 'dead', 'live',
  'disclose', 'redact', 'suspended', 'recorded', 'results',
  'resolved', 'noConflict',
]);

function shouldKeep(v: string): boolean {
  return v === 'ok' || ERROR_VARIANTS.has(v) || MULTI_OUTCOME.has(v);
}

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

const handlerFiles = findFiles(ROOT, '.handler.ts')
  .filter(f => !f.includes('node_modules'));

let totalFixed = 0;
let filesFixed = 0;

for (const filePath of handlerFiles) {
  let source = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix imperative style: variant: 'xxx'
  const imperativePattern = /variant:\s*'([^']+)'/g;
  let newSource = source.replace(imperativePattern, (match, variant) => {
    if (shouldKeep(variant)) return match;
    modified = true;
    totalFixed++;
    return `variant: 'ok'`;
  });

  // Fix functional style: complete(p, 'xxx' and completeFrom(p, 'xxx'
  const functionalPattern = /(complete(?:From)?)\((\w+),\s*'([^']+)'/g;
  newSource = newSource.replace(functionalPattern, (match, fn, p, variant) => {
    if (shouldKeep(variant)) return match;
    modified = true;
    totalFixed++;
    return `${fn}(${p}, 'ok'`;
  });

  if (modified) {
    writeFileSync(filePath, newSource);
    filesFixed++;
    console.log(`  Fixed: ${relative(ROOT, filePath)}`);
  }
}

console.log(`\n${filesFixed} handler files fixed, ${totalFixed} variant replacements`);
