import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { createInMemoryStorage } from '../kernel/src/storage.js';

describe('SyncParser invariant debug', () => {
  it('traces the full pipeline', async () => {
    const source = readFileSync(resolve(__dirname, '../specs/framework/sync-parser.concept'), 'utf-8');
    const ast = parseConceptFile(source);
    console.log('Parsed OK, invariants:', ast.invariants.length);
    
    // Check the invariant's source arg
    const inv = ast.invariants[0];
    const afterArgs = inv.afterPatterns[0].inputArgs;
    console.log('After action:', inv.afterPatterns[0].actionName);
    console.log('Source arg value:', JSON.stringify(afterArgs[0].value));
    console.log('Manifests arg value:', JSON.stringify(afterArgs[1].value));
    
    // Generate manifest via SchemaGen
    const s1 = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate({ spec: 'test', ast }, s1);
    expect(schemaResult.variant).toBe('ok');
    
    const manifest = schemaResult.manifest;
    console.log('Invariant steps:', JSON.stringify(manifest.invariants[0], null, 2));
    
    // Now run the first step (parse with valid source)
    const step = manifest.invariants[0].setup[0];
    const input: Record<string, unknown> = {};
    for (const { name, value } of step.inputs) {
      if (value.kind === 'literal') input[name] = value.value;
      else if (value.kind === 'list') input[name] = value.items.map((i: any) => i.kind === 'literal' ? i.value : undefined);
      else input[name] = undefined;
    }
    console.log('Input to handler:', JSON.stringify(input));
    console.log('Source string repr:', JSON.stringify(input.source));
    
    const s2 = createInMemoryStorage();
    const result = await syncParserHandler.parse(input, s2);
    console.log('Result:', result.variant, result.message || '');
  });
});
