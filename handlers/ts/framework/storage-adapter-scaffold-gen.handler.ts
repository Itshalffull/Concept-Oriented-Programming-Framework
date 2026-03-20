// @clef-handler style=functional concept=StorageAdapterScaffoldGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// StorageAdapterScaffoldGen — Storage adapter scaffold generator
//
// Generates ConceptStorage adapter implementations for various
// persistence backends: SQLite, PostgreSQL, Redis, memory, etc.
//
// See architecture doc:
//   - Section 9: Storage adapters
//   - Section 9.1: ConceptStorage interface
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toKebab(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

// All the build* helper functions remain unchanged as pure helpers
const BACKEND_IMPORTS: Record<string, string> = {
  sqlite: "import Database from 'better-sqlite3';",
  postgresql: "import { Pool } from 'pg';",
  redis: "import { createClient, type RedisClientType } from 'redis';",
  dynamodb: "import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';",
  memory: '// In-memory storage — no external dependencies',
};

const BACKEND_INIT: Record<string, string> = {
  sqlite: ['  private db: ReturnType<typeof Database>;', '', '  constructor(dbPath: string) {', '    this.db = new Database(dbPath);', '    this.db.exec(`', '      CREATE TABLE IF NOT EXISTS concept_store (', '        relation TEXT NOT NULL,', '        key TEXT NOT NULL,', '        value TEXT NOT NULL,', '        PRIMARY KEY (relation, key)', '      )', '    `);', '  }'].join('\n'),
  postgresql: ['  private pool: Pool;', '', '  constructor(connectionString: string) {', '    this.pool = new Pool({ connectionString });', '  }', '', '  async init(): Promise<void> {', '    await this.pool.query(`', '      CREATE TABLE IF NOT EXISTS concept_store (', '        relation TEXT NOT NULL,', '        key TEXT NOT NULL,', '        value JSONB NOT NULL,', '        PRIMARY KEY (relation, key)', '      )', '    `);', '  }'].join('\n'),
  redis: ['  private client: RedisClientType;', '', '  constructor(url: string) {', '    this.client = createClient({ url });', '  }', '', '  async connect(): Promise<void> {', '    await this.client.connect();', '  }'].join('\n'),
  dynamodb: ['  private client: DynamoDBClient;', '  private tableName: string;', '', '  constructor(region: string, tableName: string) {', '    this.client = new DynamoDBClient({ region });', '    this.tableName = tableName;', '  }'].join('\n'),
  memory: ['  private store: Map<string, Map<string, Record<string, unknown>>> = new Map();', '', '  private getRelation(relation: string): Map<string, Record<string, unknown>> {', '    if (!this.store.has(relation)) this.store.set(relation, new Map());', '    return this.store.get(relation)!;', '  }'].join('\n'),
};

function buildStorageAdapter(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyStorage';
  const backend = (input.backend as string) || 'memory';
  const importLine = BACKEND_IMPORTS[backend] || BACKEND_IMPORTS.memory;
  const initBlock = BACKEND_INIT[backend] || BACKEND_INIT.memory;

  return [
    '// ============================================================',
    `// ${name} — ${backend} storage adapter`,
    '//', `// ConceptStorage implementation backed by ${backend}.`,
    '// ============================================================', '',
    "import type { ConceptStorage } from '../../../runtime/types.js';",
    importLine!, '', `export class ${name} implements ConceptStorage {`,
    initBlock!, '',
    '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
    `    // TODO: Implement ${backend} put`,
    '  }', '',
    '  async get(relation: string, key: string): Promise<Record<string, unknown> | undefined> {',
    `    // TODO: Implement ${backend} get`,
    '    return undefined;',
    '  }', '',
    '  async find(relation: string, filter?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
    `    // TODO: Implement ${backend} find`,
    '    return [];',
    '  }', '',
    '  async del(relation: string, key: string): Promise<void> {',
    `    // TODO: Implement ${backend} del`,
    '  }', '',
    '  async delMany(relation: string, keys: string[]): Promise<void> {',
    `    // TODO: Implement ${backend} delMany`,
    '    for (const key of keys) await this.del(relation, key);',
    '  }',
    '}', '',
  ].join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'StorageAdapterScaffoldGen', inputKind: 'StorageConfig', outputKind: 'StorageAdapter',
      capabilities: JSON.stringify(['sqlite', 'postgresql', 'redis', 'dynamodb', 'memory']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MyStorage';
    const backend = (input.backend as string) || 'memory';
    if (!name || typeof name !== 'string') {
      const p = createProgram();
      return complete(p, 'error', { message: 'Adapter name is required' }) as StorageProgram<Result>;
    }
    const validBackends = ['sqlite', 'postgresql', 'redis', 'dynamodb', 'memory'];
    if (!validBackends.includes(backend)) {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid backend: ${backend}. Valid: ${validBackends.join(', ')}` }) as StorageProgram<Result>;
    }
    try {
      const kebab = toKebab(name);
      const adapterCode = buildStorageAdapter(input);
      const files = [{ path: `${kebab}-storage.stub.ts`, content: adapterCode }];
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const p = createProgram();
      return complete(p, 'error', { message }) as StorageProgram<Result>;
    }
  },

  preview(input: Record<string, unknown>) {
    // Reuse generate logic
    const result = _handler.generate(input);
    return result;
  },
};

export const storageAdapterScaffoldGenHandler = autoInterpret(_handler);
