#!/usr/bin/env npx tsx
// Add concept=ConceptName to @clef-handler annotations by calling register()
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const dryRun = process.argv.includes('--dry-run');

function findHandlerFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...findHandlerFiles(full));
    else if (entry.endsWith('.handler.ts')) results.push(full);
  }
  return results;
}

async function main() {
  const files = findHandlerFiles(join(ROOT, 'handlers', 'ts'));
  console.log(`Found ${files.length} handler files`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const fullPath of files) {
    const relPath = relative(ROOT, fullPath);
    const source = readFileSync(fullPath, 'utf-8');

    // Skip if already has concept=
    if (source.includes('concept=')) { skipped++; continue; }

    // Must have @clef-handler annotation
    const match = source.match(/^(\/\/\s*@clef-handler\s+style=\w+)(.*)/m);
    if (!match) { skipped++; continue; }

    // Try to get concept name from register()
    let conceptName: string | undefined;
    try {
      const mod = await import(fullPath);
      const handler = Object.values(mod).find(
        (v: any) => v && typeof v === 'object' && typeof v.register === 'function'
      ) as any;

      if (handler?.register) {
        let result: any;
        try {
          result = handler.register({});
          if (result instanceof Promise) result = await result.catch(() => null);
        } catch {
          try {
            const { createInMemoryStorage } = await import('../runtime/adapters/storage.js');
            result = await handler.register({}, createInMemoryStorage());
          } catch { result = null; }
        }

        if (result && typeof result === 'object') {
          if ('variant' in result && result.variant === 'ok' && result.name) {
            conceptName = result.name as string;
          } else if ('instructions' in result) {
            for (const instr of (result as any).instructions || []) {
              if (instr.tag === 'pure' && instr.value?.name) {
                conceptName = instr.value.name as string;
                break;
              }
            }
          }
        }
      }
    } catch {
      // Import failed
    }

    if (!conceptName) { failed++; continue; }

    // Add concept=ConceptName to annotation
    const newAnnotation = `${match[1]} concept=${conceptName}`;
    const newSource = source.replace(match[0], newAnnotation + (match[2] || ''));

    if (dryRun) {
      console.log(`  ${relPath}: concept=${conceptName}`);
    } else {
      writeFileSync(fullPath, newSource);
    }
    updated++;
  }

  console.log(`\nResults:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped} (already has concept= or no annotation)`);
  console.log(`  Failed:  ${failed} (no register() or import error)`);
}

main().catch(console.error);
