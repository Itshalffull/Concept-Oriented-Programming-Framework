import { readFileSync } from 'fs';
import YAML from 'yaml';

const raw = readFileSync('clef-web/deploy/vercel.deploy.yaml', 'utf-8');
const parsed = YAML.parse(raw);
const json = JSON.stringify(parsed, null, 2);

console.log('Parsed manifest:');
console.log(json);
console.log('\n--- Checking structure ---');
console.log('app.name:', parsed.app?.name);
console.log('runtimes keys:', Object.keys(parsed.runtimes || {}));
console.log('concepts keys:', Object.keys(parsed.concepts || {}));
console.log('First concept:', parsed.concepts?.ContentNode);
console.log('Has implementations?', Array.isArray(parsed.concepts?.ContentNode?.implementations));
