import { readFileSync } from 'fs';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.js';

const file = process.argv[2] || 'repertoire/concepts/entity-reflection/syncs/config-sync/config-sync-file-artifact-link.sync';
console.log('Parsing:', file);
const src = readFileSync(file, 'utf-8');
try {
  const result = parseSyncFile(src);
  console.log('OK:', result.length, 'syncs');
  for (const s of result) {
    console.log(`  - ${s.name}: when=${s.when.length} then=${s.then.length}`);
  }
} catch (e: any) {
  console.log('FAIL:', e.message);
}
