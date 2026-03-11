import { readFileSync } from 'fs';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser.js';

const file = 'repertoire/concepts/formal-verification/derived/verified-concept.derived';
console.log('Reading:', file);
const src = readFileSync(file, 'utf-8');
console.log('Parsing...');
try {
  const ast = parseDerivedFile(src);
  console.log('OK:', ast.name);
} catch (e: any) {
  console.log('FAIL:', e.message);
}
console.log('Done');
