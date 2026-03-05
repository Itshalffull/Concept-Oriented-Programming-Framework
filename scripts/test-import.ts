console.log('A');
import { readFileSync } from 'fs';
console.log('B');
const src = readFileSync('repertoire/concepts/formal-verification/derived/verified-concept.derived', 'utf-8');
console.log('C:', src.length);
