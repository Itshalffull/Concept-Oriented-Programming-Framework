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

import type { ConceptHandler, ConceptStorage } from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

const BACKEND_IMPORTS: Record<string, string> = {
  sqlite: "import Database from 'better-sqlite3';",
  postgresql: "import { Pool } from 'pg';",
  redis: "import { createClient, type RedisClientType } from 'redis';",
  dynamodb: "import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';",
  memory: '// In-memory storage — no external dependencies',
};

const BACKEND_INIT: Record<string, string> = {
  sqlite: [
    '  private db: ReturnType<typeof Database>;',
    '',
    '  constructor(dbPath: string) {',
    '    this.db = new Database(dbPath);',
    '    this.db.exec(`',
    '      CREATE TABLE IF NOT EXISTS concept_store (',
    '        relation TEXT NOT NULL,',
    '        key TEXT NOT NULL,',
    '        value TEXT NOT NULL,',
    '        PRIMARY KEY (relation, key)',
    '      )',
    '    `);',
    '  }',
  ].join('\n'),
  postgresql: [
    '  private pool: Pool;',
    '',
    '  constructor(connectionString: string) {',
    '    this.pool = new Pool({ connectionString });',
    '  }',
    '',
    '  async init(): Promise<void> {',
    '    await this.pool.query(`',
    '      CREATE TABLE IF NOT EXISTS concept_store (',
    '        relation TEXT NOT NULL,',
    '        key TEXT NOT NULL,',
    '        value JSONB NOT NULL,',
    '        PRIMARY KEY (relation, key)',
    '      )',
    '    `);',
    '  }',
  ].join('\n'),
  redis: [
    '  private client: RedisClientType;',
    '',
    '  constructor(url: string) {',
    '    this.client = createClient({ url });',
    '  }',
    '',
    '  async connect(): Promise<void> {',
    '    await this.client.connect();',
    '  }',
  ].join('\n'),
  dynamodb: [
    '  private client: DynamoDBClient;',
    '  private tableName: string;',
    '',
    '  constructor(region: string, tableName: string) {',
    '    this.client = new DynamoDBClient({ region });',
    '    this.tableName = tableName;',
    '  }',
  ].join('\n'),
  memory: [
    '  private store: Map<string, Map<string, Record<string, unknown>>> = new Map();',
    '',
    '  private getRelation(relation: string): Map<string, Record<string, unknown>> {',
    '    if (!this.store.has(relation)) this.store.set(relation, new Map());',
    '    return this.store.get(relation)!;',
    '  }',
  ].join('\n'),
};

function buildPutMethod(backend: string): string {
  switch (backend) {
    case 'sqlite':
      return [
        '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
        "    this.db.prepare('INSERT OR REPLACE INTO concept_store (relation, key, value) VALUES (?, ?, ?)')",
        '      .run(relation, key, JSON.stringify(value));',
        '  }',
      ].join('\n');
    case 'postgresql':
      return [
        '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
        '    await this.pool.query(',
        '      `INSERT INTO concept_store (relation, key, value) VALUES ($1, $2, $3)',
        '       ON CONFLICT (relation, key) DO UPDATE SET value = $3`,',
        '      [relation, key, JSON.stringify(value)]',
        '    );',
        '  }',
      ].join('\n');
    case 'redis':
      return [
        '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
        '    await this.client.hSet(`${relation}`, key, JSON.stringify(value));',
        '  }',
      ].join('\n');
    case 'dynamodb':
      return [
        '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
        '    await this.client.send(new PutItemCommand({',
        '      TableName: this.tableName,',
        "      Item: { pk: { S: relation }, sk: { S: key }, data: { S: JSON.stringify(value) } },",
        '    }));',
        '  }',
      ].join('\n');
    default: // memory
      return [
        '  async put(relation: string, key: string, value: Record<string, unknown>): Promise<void> {',
        '    this.getRelation(relation).set(key, { ...value });',
        '  }',
      ].join('\n');
  }
}

function buildGetMethod(backend: string): string {
  switch (backend) {
    case 'sqlite':
      return [
        '  async get(relation: string, key: string): Promise<Record<string, unknown> | null> {',
        "    const row = this.db.prepare('SELECT value FROM concept_store WHERE relation = ? AND key = ?').get(relation, key) as { value: string } | undefined;",
        '    return row ? JSON.parse(row.value) : null;',
        '  }',
      ].join('\n');
    case 'postgresql':
      return [
        '  async get(relation: string, key: string): Promise<Record<string, unknown> | null> {',
        '    const result = await this.pool.query(',
        "      'SELECT value FROM concept_store WHERE relation = $1 AND key = $2',",
        '      [relation, key]',
        '    );',
        '    return result.rows[0] ? result.rows[0].value : null;',
        '  }',
      ].join('\n');
    case 'redis':
      return [
        '  async get(relation: string, key: string): Promise<Record<string, unknown> | null> {',
        '    const data = await this.client.hGet(`${relation}`, key);',
        '    return data ? JSON.parse(data) : null;',
        '  }',
      ].join('\n');
    case 'dynamodb':
      return [
        '  async get(relation: string, key: string): Promise<Record<string, unknown> | null> {',
        '    const result = await this.client.send(new GetItemCommand({',
        '      TableName: this.tableName,',
        '      Key: { pk: { S: relation }, sk: { S: key } },',
        '    }));',
        '    return result.Item?.data?.S ? JSON.parse(result.Item.data.S) : null;',
        '  }',
      ].join('\n');
    default:
      return [
        '  async get(relation: string, key: string): Promise<Record<string, unknown> | null> {',
        '    return this.getRelation(relation).get(key) ?? null;',
        '  }',
      ].join('\n');
  }
}

function buildFindMethod(backend: string): string {
  switch (backend) {
    case 'sqlite':
      return [
        '  async find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        "    const rows = this.db.prepare('SELECT value FROM concept_store WHERE relation = ?').all(relation) as { value: string }[];",
        '    let results = rows.map(r => JSON.parse(r.value));',
        '    if (criteria) {',
        '      results = results.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v));',
        '    }',
        '    return results;',
        '  }',
      ].join('\n');
    case 'postgresql':
      return [
        '  async find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        "    const result = await this.pool.query('SELECT value FROM concept_store WHERE relation = $1', [relation]);",
        '    let results = result.rows.map(r => r.value);',
        '    if (criteria) {',
        '      results = results.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v));',
        '    }',
        '    return results;',
        '  }',
      ].join('\n');
    case 'redis':
      return [
        '  async find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        '    const all = await this.client.hGetAll(`${relation}`);',
        '    let results = Object.values(all).map(v => JSON.parse(v));',
        '    if (criteria) {',
        '      results = results.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v));',
        '    }',
        '    return results;',
        '  }',
      ].join('\n');
    case 'dynamodb':
      return [
        '  async find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        '    const result = await this.client.send(new QueryCommand({',
        '      TableName: this.tableName,',
        "      KeyConditionExpression: 'pk = :pk',",
        "      ExpressionAttributeValues: { ':pk': { S: relation } },",
        '    }));',
        '    let results = (result.Items ?? []).map(item => item.data?.S ? JSON.parse(item.data.S) : {});',
        '    if (criteria) {',
        '      results = results.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v));',
        '    }',
        '    return results;',
        '  }',
      ].join('\n');
    default:
      return [
        '  async find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]> {',
        '    const rel = this.getRelation(relation);',
        '    let results = [...rel.values()];',
        '    if (criteria) {',
        '      results = results.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v));',
        '    }',
        '    return results;',
        '  }',
      ].join('\n');
  }
}

function buildStorageAdapter(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyStorage';
  const backend = (input.backend as string) || 'memory';

  const importLine = BACKEND_IMPORTS[backend] || BACKEND_IMPORTS.memory;
  const initBlock = BACKEND_INIT[backend] || BACKEND_INIT.memory;

  const lines: string[] = [
    '// ============================================================',
    `// ${name} — ${backend} storage adapter`,
    '//',
    `// ConceptStorage implementation backed by ${backend}.`,
    '// ============================================================',
    '',
    "import type { ConceptStorage } from '../../../kernel/src/types.js';",
    importLine!,
    '',
    `export class ${name} implements ConceptStorage {`,
    initBlock!,
    '',
    buildPutMethod(backend),
    '',
    buildGetMethod(backend),
    '',
    buildFindMethod(backend),
    '',
    '  async del(relation: string, key: string): Promise<void> {',
    backend === 'sqlite' ? "    this.db.prepare('DELETE FROM concept_store WHERE relation = ? AND key = ?').run(relation, key);" :
    backend === 'postgresql' ? "    await this.pool.query('DELETE FROM concept_store WHERE relation = $1 AND key = $2', [relation, key]);" :
    backend === 'redis' ? '    await this.client.hDel(`${relation}`, key);' :
    backend === 'dynamodb' ? [
      '    await this.client.send(new DeleteItemCommand({',
      '      TableName: this.tableName,',
      '      Key: { pk: { S: relation }, sk: { S: key } },',
      '    }));',
    ].join('\n') :
    '    this.getRelation(relation).delete(key);',
    '  }',
    '',
    '  async delMany(relation: string, criteria: Record<string, unknown>): Promise<number> {',
    '    const items = await this.find(relation, criteria);',
    '    for (const item of items) {',
    "      const key = (item.key ?? item.id ?? '') as string;",
    '      if (key) await this.del(relation, key);',
    '    }',
    '    return items.length;',
    '  }',
    '}',
    '',
  ];

  return lines.join('\n');
}

export const storageAdapterScaffoldGenHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'StorageAdapterScaffoldGen',
      inputKind: 'StorageConfig',
      outputKind: 'StorageAdapter',
      capabilities: JSON.stringify(['sqlite', 'postgresql', 'redis', 'dynamodb', 'memory']),
    };
  },

  async generate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const name = (input.name as string) || 'MyStorage';
    const backend = (input.backend as string) || 'memory';

    if (!name || typeof name !== 'string') {
      return { variant: 'error', message: 'Adapter name is required' };
    }

    const validBackends = ['sqlite', 'postgresql', 'redis', 'dynamodb', 'memory'];
    if (!validBackends.includes(backend)) {
      return { variant: 'error', message: `Invalid backend: ${backend}. Valid: ${validBackends.join(', ')}` };
    }

    try {
      const kebab = toKebab(name);
      const adapterCode = buildStorageAdapter(input);

      const files: { path: string; content: string }[] = [
        { path: `${kebab}-storage.ts`, content: adapterCode },
      ];

      return { variant: 'ok', files, filesGenerated: files.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async plan() {
    return {
      variant: 'ok',
      inputKind: 'StorageConfig',
      outputKind: 'StorageAdapter',
      description: 'Generate ConceptStorage adapter implementations for various persistence backends.',
      pipeline: JSON.stringify([
        'Resource/upsert', 'BuildCache/check',
        'StorageAdapterScaffoldGen/generate', 'Emitter/writeBatch',
        'GenerationPlan/recordStep',
      ]),
    };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const result = await storageAdapterScaffoldGenHandler.generate!(input, storage);
    if (result.variant === 'error') return result;
    const files = result.files as Array<{ path: string; content: string }>;
    return {
      variant: 'ok',
      files,
      wouldWrite: files.length,
      wouldSkip: 0,
    };
  },
};
