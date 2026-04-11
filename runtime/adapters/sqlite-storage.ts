// ============================================================
// Clef Kernel - SQLite Storage Adapter
//
// Implements ConceptStorage on top of a SQLite database.
// Stores one row per (namespace, relation, key) and keeps
// relation-scoped secondary indexes via SQLite expression indexes
// over json_extract(data, '$.field').
// ============================================================

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

import type {
  ConceptStorage,
  EntryMeta,
  FindOptions,
  ConflictInfo,
} from '../types.js';

export interface SQLiteStorageConfig {
  dbPath: string;
  namespace?: string;
}

const dbCache = new Map<string, Promise<Database>>();

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function sanitizeIndexName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

async function getDb(dbPath: string): Promise<Database> {
  const existing = dbCache.get(dbPath);
  if (existing) {
    return existing;
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const dbPromise = open({
    filename: dbPath,
    driver: sqlite3.Database,
  }).then(async (db) => {
    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS clef_entries (
        namespace TEXT NOT NULL,
        relation TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        last_written_at TEXT NOT NULL,
        PRIMARY KEY (namespace, relation, key)
      );
      CREATE INDEX IF NOT EXISTS idx_clef_entries_namespace_relation
        ON clef_entries(namespace, relation);
    `);
    return db;
  });

  dbCache.set(dbPath, dbPromise);
  return dbPromise;
}

function parseRowData(raw: string): Record<string, unknown> {
  return JSON.parse(raw) as Record<string, unknown>;
}

function buildCriteriaSql(
  criteria: Record<string, unknown> | undefined,
  params: unknown[],
): string {
  if (!criteria || Object.keys(criteria).length === 0) {
    return '';
  }

  const clauses: string[] = [];
  for (const [field, value] of Object.entries(criteria)) {
    clauses.push(`json_extract(data, ?) = ?`);
    params.push(`$.${field}`, value);
  }
  return ` AND ${clauses.join(' AND ')}`;
}

export function createSQLiteStorage(config: SQLiteStorageConfig): ConceptStorage {
  const namespace = config.namespace ?? '';
  const ensuredIndexes = new Set<string>();

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const db = await getDb(config.dbPath);
      const now = new Date().toISOString();
      const existingRow = await db.get<{ data: string; last_written_at: string }>(
        `
          SELECT data, last_written_at
          FROM clef_entries
          WHERE namespace = ? AND relation = ? AND key = ?
        `,
        [namespace, relation, key],
      );

      let nextValue = value;
      if (existingRow && storage.onConflict) {
        const info: ConflictInfo = {
          relation,
          key,
          existing: {
            fields: parseRowData(existingRow.data),
            writtenAt: existingRow.last_written_at,
          },
          incoming: {
            fields: { ...value },
            writtenAt: now,
          },
        };

        const resolution = storage.onConflict(info);
        switch (resolution.action) {
          case 'keep-existing':
            return;
          case 'accept-incoming':
            break;
          case 'merge':
            nextValue = { ...resolution.merged };
            break;
          case 'escalate':
            break;
        }
      }

      await db.run(
        `
          INSERT INTO clef_entries(namespace, relation, key, data, last_written_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(namespace, relation, key)
          DO UPDATE SET
            data = excluded.data,
            last_written_at = excluded.last_written_at
        `,
        [namespace, relation, key, JSON.stringify(nextValue), now],
      );
    },

    async get(relation, key) {
      const db = await getDb(config.dbPath);
      const row = await db.get<{ data: string }>(
        `
          SELECT data
          FROM clef_entries
          WHERE namespace = ? AND relation = ? AND key = ?
        `,
        [namespace, relation, key],
      );
      return row ? parseRowData(row.data) : null;
    },

    async find(relation, criteria, options?: FindOptions) {
      const db = await getDb(config.dbPath);
      const params: unknown[] = [namespace, relation];
      let sql = `
        SELECT key, data
        FROM clef_entries
        WHERE namespace = ? AND relation = ?
      `;

      sql += buildCriteriaSql(criteria, params);

      if (options?.sort) {
        const direction = options.sort.order === 'desc' ? 'DESC' : 'ASC';
        sql += ` ORDER BY json_extract(data, ?) ${direction}`;
        params.push(`$.${options.sort.field}`);
      }

      if (options?.limit != null) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset != null) {
        if (options.limit == null) {
          sql += ' LIMIT -1';
        }
        sql += ' OFFSET ?';
        params.push(options.offset);
      }

      const rows = await db.all<Array<{ key: string; data: string }>>(sql, params);
      return rows.map((row) => ({
        ...parseRowData(row.data),
        _key: row.key,
      }));
    },

    async del(relation, key) {
      const db = await getDb(config.dbPath);
      await db.run(
        `
          DELETE FROM clef_entries
          WHERE namespace = ? AND relation = ? AND key = ?
        `,
        [namespace, relation, key],
      );
    },

    async delMany(relation, criteria) {
      const db = await getDb(config.dbPath);
      const params: unknown[] = [namespace, relation];
      let sql = `
        DELETE FROM clef_entries
        WHERE namespace = ? AND relation = ?
      `;
      sql += buildCriteriaSql(criteria, params);

      const result = await db.run(sql, params);
      return result.changes ?? 0;
    },

    async getMeta(relation, key) {
      const db = await getDb(config.dbPath);
      const row = await db.get<{ last_written_at: string }>(
        `
          SELECT last_written_at
          FROM clef_entries
          WHERE namespace = ? AND relation = ? AND key = ?
        `,
        [namespace, relation, key],
      );
      return row ? { lastWrittenAt: row.last_written_at } satisfies EntryMeta : null;
    },

    ensureIndex(relation: string, field: string): void {
      const indexKey = `${namespace}:${relation}:${field}`;
      if (ensuredIndexes.has(indexKey)) {
        return;
      }
      ensuredIndexes.add(indexKey);

      const indexName = sanitizeIndexName(`idx_clef_entries_${namespace}_${relation}_${field}`);
      void getDb(config.dbPath).then((db) =>
        db.exec(
          `
            CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)}
            ON clef_entries(
              namespace,
              relation,
              json_extract(data, '$.${field}')
            )
          `,
        ),
      );
    },
  };

  return storage;
}
