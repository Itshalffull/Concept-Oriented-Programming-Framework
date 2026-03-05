import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
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

const repDir = join(process.cwd(), 'repertoire');
const conceptsDir = join(repDir, 'concepts');
const themesDir = join(repDir, 'themes');

// Test derived files
const derivedFiles = globRecursive(conceptsDir, '.derived');
console.log(`\nDerived: ${derivedFiles.length} files`);
let dOk = 0, dFail = 0;
for (const f of derivedFiles) {
  try { parseDerivedFile(readFileSync(f, 'utf-8')); dOk++; }
  catch (e: any) { dFail++; console.log(`  FAIL: ${basename(f)} - ${e.message.slice(0, 100)}`); }
}
console.log(`  Result: ${dOk} ok, ${dFail} fail`);

// Test sync files
const syncFiles = globRecursive(conceptsDir, '.sync');
console.log(`\nSyncs: ${syncFiles.length} files`);
let sOk = 0, sFail = 0;
for (const f of syncFiles) {
  try { parseSyncFile(readFileSync(f, 'utf-8')); sOk++; }
  catch (e: any) { sFail++; console.log(`  FAIL: ${basename(f)} - ${e.message.slice(0, 100)}`); }
}
console.log(`  Result: ${sOk} ok, ${sFail} fail`);

// Test widget files
const widgetFiles = globRecursive(conceptsDir, '.widget');
console.log(`\nWidgets: ${widgetFiles.length} files`);
let wOk = 0, wFail = 0;
for (const f of widgetFiles) {
  try { parseWidgetFile(readFileSync(f, 'utf-8')); wOk++; }
  catch (e: any) { wFail++; console.log(`  FAIL: ${basename(f)} - ${e.message.slice(0, 100)}`); }
}
console.log(`  Result: ${wOk} ok, ${wFail} fail`);

// Test theme files
const themeFiles = existsSync(themesDir) ? globRecursive(themesDir, '.theme') : [];
console.log(`\nThemes: ${themeFiles.length} files`);
let tOk = 0, tFail = 0;
for (const f of themeFiles) {
  try { parseThemeFile(readFileSync(f, 'utf-8')); tOk++; }
  catch (e: any) { tFail++; console.log(`  FAIL: ${basename(f)} - ${e.message.slice(0, 100)}`); }
}
console.log(`  Result: ${tOk} ok, ${tFail} fail`);

console.log(`\n=== TOTAL: ${dOk + sOk + wOk + tOk} ok, ${dFail + sFail + wFail + tFail} fail ===`);
