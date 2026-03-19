// ============================================================
// LLM RAG Suite Tests
//
// Tests:
// 1. VectorIndex concept parsing and structural validation
// 2. Retriever concept parsing and structural validation
// 3. DocumentChunk concept parsing and structural validation
// 4. All sync files parse correctly with structural checks
// 5. suite.yaml references valid files
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-rag');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// 1. VectorIndex Concept
// ============================================================

describe('VectorIndex concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('vector-index');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('VectorIndex');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter X', () => {
    expect(ast.typeParams).toEqual(['X']);
  });

  it('has a purpose block', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('embedding vectors');
  });

  it('declares 9 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'embed', 'embedBatch', 'add', 'addBatch',
      'search', 'hybridSearch', 'mmrSearch', 'delete',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const create = ast.actions.find(a => a.name === 'create')!;
    const variants = create.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('embed action has ok and error variants', () => {
    const embed = ast.actions.find(a => a.name === 'embed')!;
    const variants = embed.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('embedBatch action has ok and partial variants', () => {
    const embedBatch = ast.actions.find(a => a.name === 'embedBatch')!;
    const variants = embedBatch.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('partial');
  });

  it('add action has ok and dimension_mismatch variants', () => {
    const add = ast.actions.find(a => a.name === 'add')!;
    const variants = add.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('dimension_mismatch');
  });

  it('addBatch action has ok and partial variants', () => {
    const addBatch = ast.actions.find(a => a.name === 'addBatch')!;
    const variants = addBatch.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('partial');
  });

  it('search action has ok and empty variants', () => {
    const search = ast.actions.find(a => a.name === 'search')!;
    const variants = search.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('hybridSearch action has ok and empty variants', () => {
    const hybridSearch = ast.actions.find(a => a.name === 'hybridSearch')!;
    const variants = hybridSearch.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('mmrSearch action has ok and empty variants', () => {
    const mmrSearch = ast.actions.find(a => a.name === 'mmrSearch')!;
    const variants = mmrSearch.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('delete action has ok and notfound variants', () => {
    const del = ast.actions.find(a => a.name === 'delete')!;
    const variants = del.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has all expected state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('indexes');
    expect(stateNames).toContain('dimensions');
    expect(stateNames).toContain('distance_metric');
    expect(stateNames).toContain('index_type');
    expect(stateNames).toContain('backend');
    expect(stateNames).toContain('embedding_model');
    expect(stateNames).toContain('collections');
    expect(stateNames).toContain('document_count');
    expect(stateNames).toContain('index_config');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has 1 invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 2. Retriever Concept
// ============================================================

describe('Retriever concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('retriever');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('Retriever');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter R', () => {
    expect(ast.typeParams).toEqual(['R']);
  });

  it('has a purpose block', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('RAG orchestration');
  });

  it('declares 7 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'create', 'retrieve', 'multiQueryRetrieve', 'selfQueryRetrieve',
      'rerank', 'compress', 'setReranker',
    ]);
  });

  it('create action has ok and invalid variants', () => {
    const create = ast.actions.find(a => a.name === 'create')!;
    const variants = create.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('retrieve action has ok and empty variants', () => {
    const retrieve = ast.actions.find(a => a.name === 'retrieve')!;
    const variants = retrieve.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('multiQueryRetrieve action has ok and empty variants', () => {
    const mqr = ast.actions.find(a => a.name === 'multiQueryRetrieve')!;
    const variants = mqr.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('selfQueryRetrieve action has ok and empty variants', () => {
    const sqr = ast.actions.find(a => a.name === 'selfQueryRetrieve')!;
    const variants = sqr.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('empty');
  });

  it('rerank action has ok and error variants', () => {
    const rerank = ast.actions.find(a => a.name === 'rerank')!;
    const variants = rerank.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('compress action has ok and error variants', () => {
    const compress = ast.actions.find(a => a.name === 'compress')!;
    const variants = compress.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('setReranker action has ok and invalid variants', () => {
    const setReranker = ast.actions.find(a => a.name === 'setReranker')!;
    const variants = setReranker.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('invalid');
  });

  it('has all expected state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('retrievers');
    expect(stateNames).toContain('retriever_type');
    expect(stateNames).toContain('source_ids');
    expect(stateNames).toContain('top_k');
    expect(stateNames).toContain('reranker_config');
    expect(stateNames).toContain('filters');
    expect(stateNames).toContain('score_threshold');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has 1 invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 3. DocumentChunk Concept
// ============================================================

describe('DocumentChunk concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    const source = readConcept('document-chunk');
    ast = parseConceptFile(source);
  });

  it('parses without error', () => {
    expect(ast).toBeDefined();
    expect(ast.name).toBe('DocumentChunk');
  });

  it('has version 1', () => {
    expect(ast.version).toBe(1);
  });

  it('has type parameter D', () => {
    expect(ast.typeParams).toEqual(['D']);
  });

  it('has a purpose block', () => {
    expect(ast.purpose).toBeTruthy();
    expect(ast.purpose).toContain('chunking strategies');
  });

  it('declares 4 actions', () => {
    const actionNames = ast.actions.map(a => a.name);
    expect(actionNames).toEqual([
      'split', 'enrich', 'getContext', 'getParent',
    ]);
  });

  it('split action has ok and error variants', () => {
    const split = ast.actions.find(a => a.name === 'split')!;
    const variants = split.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
  });

  it('enrich action has ok and notfound variants', () => {
    const enrich = ast.actions.find(a => a.name === 'enrich')!;
    const variants = enrich.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('getContext action has ok and notfound variants', () => {
    const getContext = ast.actions.find(a => a.name === 'getContext')!;
    const variants = getContext.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('getParent action has ok and notfound variants', () => {
    const getParent = ast.actions.find(a => a.name === 'getParent')!;
    const variants = getParent.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('notfound');
  });

  it('has all expected state fields', () => {
    const stateNames = ast.state.map(s => s.name);
    expect(stateNames).toContain('chunks');
    expect(stateNames).toContain('text');
    expect(stateNames).toContain('metadata');
    expect(stateNames).toContain('embedding');
    expect(stateNames).toContain('relationships');
    expect(stateNames).toContain('chunk_strategy');
    expect(stateNames).toContain('token_count');
  });

  it('requires persistent-storage capability', () => {
    expect(ast.capabilities).toContain('persistent-storage');
  });

  it('has 1 invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });
});

// ============================================================
// 4. Sync File Parsing
// ============================================================

describe('llm-rag sync files', () => {
  const syncFiles = [
    'retriever-embeds-query',
    'retriever-searches-index',
    'chunk-embeds-and-indexes',
    'embedded-chunks-index',
    'retriever-reranks-results',
    'retriever-injects-into-assembly',
    'vector-store-provider',
    'knowledge-graph-provider',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  describe('RetrieverEmbedsQuery sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('retriever-embeds-query'));
      const sync = syncs[0];
      expect(sync.name).toBe('RetrieverEmbedsQuery');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RetrieverSearchesIndex sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('retriever-searches-index'));
      const sync = syncs[0];
      expect(sync.name).toBe('RetrieverSearchesIndex');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ChunkEmbedsAndIndexes sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('chunk-embeds-and-indexes'));
      const sync = syncs[0];
      expect(sync.name).toBe('ChunkEmbedsAndIndexes');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('EmbeddedChunksIndex sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('embedded-chunks-index'));
      const sync = syncs[0];
      expect(sync.name).toBe('EmbeddedChunksIndex');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RetrieverReranksResults sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('retriever-reranks-results'));
      const sync = syncs[0];
      expect(sync.name).toBe('RetrieverReranksResults');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RetrieverInjectsIntoAssembly sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('retriever-injects-into-assembly'));
      const sync = syncs[0];
      expect(sync.name).toBe('RetrieverInjectsIntoAssembly');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('VectorStoreProvider sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('vector-store-provider'));
      const sync = syncs[0];
      expect(sync.name).toBe('VectorStoreProvider');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('KnowledgeGraphProvider sync', () => {
    it('has correct name and when/then clauses', () => {
      const syncs = parseSyncFile(readSync('knowledge-graph-provider'));
      const sync = syncs[0];
      expect(sync.name).toBe('KnowledgeGraphProvider');
      expect(sync.when.length).toBeGreaterThanOrEqual(1);
      expect(sync.then.length).toBeGreaterThanOrEqual(1);
    });

    it('has a where clause for entity filtering', () => {
      const syncs = parseSyncFile(readSync('knowledge-graph-provider'));
      const sync = syncs[0];
      expect(sync.where).toBeDefined();
      expect(sync.where!.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================
// 5. Suite Manifest
// ============================================================

describe('llm-rag suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-rag');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists VectorIndex, Retriever, and DocumentChunk concepts', () => {
    expect(manifest.concepts.VectorIndex).toBeDefined();
    expect(manifest.concepts.Retriever).toBeDefined();
    expect(manifest.concepts.DocumentChunk).toBeDefined();
    expect(manifest.concepts.VectorIndex.spec).toBe('./vector-index.concept');
    expect(manifest.concepts.Retriever.spec).toBe('./retriever.concept');
    expect(manifest.concepts.DocumentChunk.spec).toBe('./document-chunk.concept');
  });

  it('VectorIndex has type param X mapped to index-id', () => {
    const params = manifest.concepts.VectorIndex.params;
    expect(params.X).toBeDefined();
    expect(params.X.as).toBe('index-id');
  });

  it('Retriever has type param R mapped to retriever-id', () => {
    const params = manifest.concepts.Retriever.params;
    expect(params.R).toBeDefined();
    expect(params.R.as).toBe('retriever-id');
  });

  it('DocumentChunk has type param D mapped to chunk-id', () => {
    const params = manifest.concepts.DocumentChunk.params;
    expect(params.D).toBeDefined();
    expect(params.D.as).toBe('chunk-id');
  });

  it('all referenced concept files exist', () => {
    for (const [, value] of Object.entries(manifest.concepts)) {
      const specPath = resolve(SUITE_DIR, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
  });

  it('all referenced sync files exist', () => {
    const allSyncs = [
      ...(manifest.syncs.required || []),
      ...(manifest.syncs.recommended || []),
      ...(manifest.syncs.integration || []),
    ];
    for (const sync of allSyncs) {
      const syncPath = resolve(SUITE_DIR, sync.path);
      expect(existsSync(syncPath)).toBe(true);
    }
  });

  it('has 3 required syncs', () => {
    expect(manifest.syncs.required).toHaveLength(3);
  });

  it('has 2 recommended syncs', () => {
    expect(manifest.syncs.recommended).toHaveLength(2);
  });

  it('has 3 integration syncs', () => {
    expect(manifest.syncs.integration).toHaveLength(3);
  });

  it('has uses declarations for external suites', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBeGreaterThanOrEqual(1);
    const suiteNames = manifest.uses.map((u: any) => u.suite);
    expect(suiteNames).toContain('llm-core');
  });

  it('references optional suites llm-prompt, foundation, and data-organization', () => {
    const optionalUses = manifest.uses.filter((u: any) => u.optional);
    const optionalNames = optionalUses.map((u: any) => u.suite);
    expect(optionalNames).toContain('llm-prompt');
    expect(optionalNames).toContain('foundation');
    expect(optionalNames).toContain('data-organization');
  });
});
