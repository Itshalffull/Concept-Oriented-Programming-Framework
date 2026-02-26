// SQL — connector_protocol provider
// SQL database connector supporting Postgres, MySQL, SQLite via connection strings with parameterized queries

export interface ConnectorConfig {
  baseUrl?: string;
  connectionString?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface QuerySpec {
  path?: string;
  query?: string;
  params?: Record<string, unknown>;
  cursor?: string;
  limit?: number;
}

export interface WriteResult { created: number; updated: number; skipped: number; errors: number; }
export interface TestResult { connected: boolean; message: string; latencyMs?: number; }
export interface StreamDef { name: string; schema: Record<string, unknown>; supportedSyncModes: string[]; }
export interface DiscoveryResult { streams: StreamDef[]; }

export const PROVIDER_ID = 'sql';
export const PLUGIN_TYPE = 'connector_protocol';

type DbType = 'postgres' | 'mysql' | 'sqlite' | 'unknown';

interface ParsedConnection {
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  options: Record<string, string>;
}

function detectDbType(connectionString: string): DbType {
  const lower = connectionString.toLowerCase();
  if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) return 'postgres';
  if (lower.startsWith('mysql://') || lower.startsWith('mariadb://')) return 'mysql';
  if (lower.startsWith('sqlite://') || lower.startsWith('sqlite3://') || lower.endsWith('.db') || lower.endsWith('.sqlite')) return 'sqlite';
  return 'unknown';
}

function parseConnectionString(cs: string): ParsedConnection {
  const dbType = detectDbType(cs);
  const defaults: ParsedConnection = {
    dbType,
    host: 'localhost',
    port: dbType === 'postgres' ? 5432 : dbType === 'mysql' ? 3306 : 0,
    database: '',
    username: '',
    password: '',
    options: {},
  };

  try {
    if (dbType === 'sqlite') {
      defaults.database = cs.replace(/^sqlite3?:\/\//, '');
      return defaults;
    }
    const url = new URL(cs);
    defaults.host = url.hostname || 'localhost';
    defaults.port = parseInt(url.port, 10) || defaults.port;
    defaults.database = url.pathname.replace(/^\//, '');
    defaults.username = decodeURIComponent(url.username || '');
    defaults.password = decodeURIComponent(url.password || '');
    for (const [k, v] of url.searchParams) defaults.options[k] = v;
  } catch {
    // Keep defaults if parsing fails
  }
  return defaults;
}

function buildParameterizedQuery(query: string, params: Record<string, unknown>, dbType: DbType): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  let idx = 0;
  const sql = query.replace(/:(\w+)/g, (_, name) => {
    if (name in params) {
      values.push(params[name]);
      idx++;
      return dbType === 'postgres' ? `$${idx}` : '?';
    }
    return `:${name}`;
  });
  return { sql, values };
}

function inferSqlType(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isInteger(value) ? 'INTEGER' : 'REAL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (value instanceof Date) return 'TIMESTAMP';
  return 'TEXT';
}

function buildInsertSql(table: string, record: Record<string, unknown>, dbType: DbType): { sql: string; values: unknown[] } {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = columns.map((_, i) => dbType === 'postgres' ? `$${i + 1}` : '?');
  const quotedColumns = columns.map(c => dbType === 'mysql' ? `\`${c}\`` : `"${c}"`);
  return {
    sql: `INSERT INTO ${table} (${quotedColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  };
}

function buildUpsertSql(table: string, record: Record<string, unknown>, dbType: DbType, idField: string): { sql: string; values: unknown[] } {
  const { sql: insertSql, values } = buildInsertSql(table, record, dbType);
  const columns = Object.keys(record).filter(c => c !== idField);
  if (dbType === 'postgres') {
    const updates = columns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
    return { sql: `${insertSql} ON CONFLICT ("${idField}") DO UPDATE SET ${updates}`, values };
  }
  if (dbType === 'mysql') {
    const updates = columns.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    return { sql: `${insertSql} ON DUPLICATE KEY UPDATE ${updates}`, values };
  }
  const updates = columns.map(c => `"${c}" = excluded."${c}"`).join(', ');
  return { sql: `${insertSql} ON CONFLICT ("${idField}") DO UPDATE SET ${updates}`, values };
}

// Abstract database client interface for real implementations
interface DbClient {
  query(sql: string, values: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, values: unknown[]): Promise<{ rowsAffected: number }>;
  close(): Promise<void>;
}

async function createClient(parsed: ParsedConnection): Promise<DbClient> {
  // In a real deployment, this would use pg, mysql2, or better-sqlite3
  // This provides the structural pattern for actual driver integration
  throw new Error(`Database driver for ${parsed.dbType} not loaded. Install the appropriate driver package.`);
}

export class SqlConnectorProvider {
  private client: DbClient | null = null;

  private async getClient(config: ConnectorConfig): Promise<DbClient> {
    if (this.client) return this.client;
    const cs = config.connectionString ?? '';
    const parsed = parseConnectionString(cs);
    this.client = await createClient(parsed);
    return this.client;
  }

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const cs = config.connectionString ?? '';
    const parsed = parseConnectionString(cs);
    const client = await this.getClient(config);
    const rawQuery = query.query ?? `SELECT * FROM ${query.path ?? 'unknown'}`;
    const limit = query.limit ?? 1000;
    const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

    let sql = rawQuery;
    let values: unknown[] = [];

    if (query.params && Object.keys(query.params).length > 0) {
      const result = buildParameterizedQuery(rawQuery, query.params, parsed.dbType);
      sql = result.sql;
      values = result.values;
    }

    if (!sql.toLowerCase().includes('limit')) {
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = await client.query(sql, values);
    for (const row of rows) {
      yield row;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const cs = config.connectionString ?? '';
    const parsed = parseConnectionString(cs);
    const client = await this.getClient(config);
    const table = (config.options?.table as string) ?? 'records';
    const idField = (config.options?.idField as string) ?? 'id';
    const mode = (config.options?.writeMode as string) ?? 'upsert';
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      try {
        let stmt: { sql: string; values: unknown[] };
        if (mode === 'insert') {
          stmt = buildInsertSql(table, record, parsed.dbType);
        } else {
          stmt = buildUpsertSql(table, record, parsed.dbType, idField);
        }
        const res = await client.execute(stmt.sql, stmt.values);
        if (res.rowsAffected > 0) {
          result.created++;
        } else {
          result.skipped++;
        }
      } catch {
        result.errors++;
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const start = Date.now();
    const cs = config.connectionString ?? '';
    const parsed = parseConnectionString(cs);
    try {
      const client = await this.getClient(config);
      const testQuery = parsed.dbType === 'mysql' ? 'SELECT 1 AS ok' : 'SELECT 1 AS ok';
      await client.query(testQuery, []);
      return {
        connected: true,
        message: `Connected to ${parsed.dbType} at ${parsed.host}:${parsed.port}/${parsed.database}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const cs = config.connectionString ?? '';
    const parsed = parseConnectionString(cs);
    try {
      const client = await this.getClient(config);
      let tablesQuery: string;
      switch (parsed.dbType) {
        case 'postgres':
          tablesQuery = `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
          break;
        case 'mysql':
          tablesQuery = `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position`;
          break;
        case 'sqlite':
          tablesQuery = `SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
          break;
        default:
          return { streams: [] };
      }
      const rows = await client.query(tablesQuery, []);
      const tableMap = new Map<string, Record<string, string>>();
      for (const row of rows) {
        const tableName = String(row.table_name ?? row.TABLE_NAME ?? '');
        if (!tableName) continue;
        if (!tableMap.has(tableName)) tableMap.set(tableName, {});
        const colName = String(row.column_name ?? row.COLUMN_NAME ?? '');
        const dataType = String(row.data_type ?? row.DATA_TYPE ?? 'text');
        if (colName) tableMap.get(tableName)![colName] = dataType;
      }
      return {
        streams: Array.from(tableMap.entries()).map(([name, columns]) => ({
          name,
          schema: { type: 'object', properties: columns },
          supportedSyncModes: ['full_refresh', 'incremental'],
        })),
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default SqlConnectorProvider;
