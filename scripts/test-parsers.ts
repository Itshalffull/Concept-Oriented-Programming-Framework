import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.js';
import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser.js';
import { parseThemeFile } from '../handlers/ts/framework/theme-spec-parser.js';

function globRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) results.push(...globRecursive(full, ext));
      else if (entry.endsWith(ext)) results.push(full);
    } catch { /* skip */ }
  }
  return results;
}

function testParser<T>(label: string, files: string[], parse: (src: string) => T) {
  console.log(`\n${label}: ${files.length} files`);
  let ok = 0, fail = 0;
  for (const f of files) {
    try {
      parse(readFileSync(f, 'utf-8'));
      ok++;
    } catch (e: any) {
      fail++;
      console.log(`  FAIL: ${basename(f)} - ${e.message.slice(0, 100)}`);
    }
  }
  console.log(`  Result: ${ok} ok, ${fail} fail`);
  return { ok, fail };
}

const repDir = join(process.cwd(), 'repertoire');
const conceptsDir = join(repDir, 'concepts');
const themesDir = join(repDir, 'themes');

const results: { label: string; ok: number; fail: number }[] = [];

results.push({ label: 'Concepts', ...testParser('Concepts', globRecursive(conceptsDir, '.concept'), parseConceptFile) });
results.push({ label: 'Derived', ...testParser('Derived', globRecursive(conceptsDir, '.derived'), parseDerivedFile) });
results.push({ label: 'Syncs', ...testParser('Syncs', globRecursive(conceptsDir, '.sync'), (src) => parseSyncFile(src)) });
results.push({ label: 'Widgets', ...testParser('Widgets', globRecursive(conceptsDir, '.widget'), parseWidgetFile) });
results.push({ label: 'Themes', ...testParser('Themes', existsSync(themesDir) ? globRecursive(themesDir, '.theme') : [], parseThemeFile) });

console.log('\n=== Summary ===');
let totalOk = 0, totalFail = 0;
for (const r of results) {
  console.log(`  ${r.label}: ${r.ok} ok, ${r.fail} fail`);
  totalOk += r.ok;
  totalFail += r.fail;
}
console.log(`  TOTAL: ${totalOk} ok, ${totalFail} fail`);
