import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser.js';

function glob(dir: string, ext: string): string[] {
  const r: string[] = [];
  if (!existsSync(dir)) return r;
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    try {
      const s = statSync(f);
      if (s.isDirectory()) r.push(...glob(f, ext));
      else if (e.endsWith(ext)) r.push(f);
    } catch {}
  }
  return r;
}

const files = glob(join(process.cwd(), 'repertoire', 'concepts'), '.derived');
console.log(`Found ${files.length} derived files`);
for (const f of files) {
  process.stdout.write(`  ${basename(f)}... `);
  try {
    const ast = parseDerivedFile(readFileSync(f, 'utf-8'));
    console.log(`OK: ${ast.name}`);
  } catch (e: any) {
    console.log(`FAIL: ${e.message.slice(0, 100)}`);
  }
}
console.log('Done with derived.');
