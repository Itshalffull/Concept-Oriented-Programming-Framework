import { readFileSync } from 'fs';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.js';

// Test first sync only
const src1 = `
sync ConfigSyncFileArtifactFromConcept [eager]
  purpose { Link file-originated concept definitions to their source files. }
when {
  ConceptEntity/register: [ name: ?name; source: ?source; ast: ?ast ]
    => ok(entity: ?entity)
}
then {
  Relation/link: [ relation: "originated_from_file"; source: ?entity; target: ?source ]
}
`;

console.log('=== Test 1: first sync only ===');
try {
  const r = parseSyncFile(src1);
  console.log('OK:', r.length, 'syncs');
} catch (e: any) {
  console.log('FAIL:', e.message);
}

// Test second sync only — with purpose containing "sync" word
const src2 = `
sync ConfigSyncFileArtifactFromSync [eager]
  purpose { Link file-originated sync definitions to their source files. }
when {
  SyncEntity/register: [ name: ?name; source: ?source; compiled: ?compiled ]
    => ok(sync: ?sync)
}
then {
  Relation/link: [ relation: "originated_from_file"; source: ?sync; target: ?source ]
}
`;

// Test second sync without purpose
const src2b = `
sync ConfigSyncFileArtifactFromSync [eager]
when {
  SyncEntity/register: [ name: ?name; source: ?source; compiled: ?compiled ]
    => ok(sync: ?sync)
}
then {
  Relation/link: [ relation: "originated_from_file"; source: ?sync; target: ?source ]
}
`;

console.log('\n=== Test 2b: second sync without purpose ===');
try {
  const r = parseSyncFile(src2b);
  console.log('OK:', r.length, 'syncs');
} catch (e: any) {
  console.log('FAIL:', e.message);
}

console.log('\n=== Test 2: second sync only ===');
try {
  const r = parseSyncFile(src2);
  console.log('OK:', r.length, 'syncs');
} catch (e: any) {
  console.log('FAIL:', e.message);
}

// Test minimal: ok(sync: ?sync)
const src3 = `
sync Test [eager]
when {
  SyncEntity/register: [ name: ?name; source: ?source; compiled: ?compiled ]
    => ok(sync: ?sync)
}
then {
  Relation/link: [ relation: "originated_from_file"; source: ?sync; target: ?source ]
}
`;

console.log('\n=== Test 3: minimal ok(sync: ?s) ===');
try {
  const r = parseSyncFile(src3);
  console.log('OK:', r.length, 'syncs');
} catch (e: any) {
  console.log('FAIL:', e.message);
}
