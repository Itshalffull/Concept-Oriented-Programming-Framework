// ============================================================
// Clef Kernel - JSONL File Storage Implementation
//
// Append-only JSONL files under a data directory, one file per
// relation. Provides persistent local storage with zero external
// dependencies. Designed for CLI-scale data (hundreds to low
// thousands of records per relation).
//
// Storage format:
//   .clef/data/<relation>.jsonl
//   Each line: {"_op":"put"|"del","_key":"...","_ts":"...","...fields"}
//
// On read, the log is replayed to build the current state.
// Compaction rewrites the file with only live entries.
// ============================================================

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../types.js';

/** A single log entry in the JSONL file. */
interface LogEntry {
  _op: 'put' | 'del';
  _key: string;
  _ts: string;
  [field: string]: unknown;
}

/** Materialized entry after replaying the log. */
interface MaterializedEntry {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

/** Configuration for file storage. */
export interface FileStorageOptions {
  /** Directory to store JSONL files. Default: '.clef/data' */
  dataDir: string;
  /** Auto-compact when tombstone ratio exceeds this threshold (0-1). Default: 0.5 */
  compactionThreshold?: number;
  /** Namespace prefix for relation files (e.g., concept name). */
  namespace?: string;
}

/**
 * Create a persistent file-backed ConceptStorage using append-only JSONL logs.
 *
 * Each relation maps to a `.jsonl` file. Writes append a log entry.
 * Reads replay the log to build current state (cached in memory after
 * first access). Compaction rewrites the file to remove tombstones.
 *
 * Thread-safe for single-process use (Node.js single-threaded).
 * For multi-process, use SQLite or a database adapter instead.
 */
export function createFileStorage(options: FileStorageOptions): ConceptStorage {
  const {
    dataDir,
    compactionThreshold = 0.5,
    namespace,
  } = options;

  // Ensure data directory exists
  mkdirSync(dataDir, { recursive: true });

  // In-memory cache of materialized state per relation.
  // Lazily populated on first access, invalidated on write.
  const cache = new Map<string, Map<string, MaterializedEntry>>();

  // Track append count vs live count per relation for compaction decisions.
  const appendCounts = new Map<string, number>();

  function relationPath(relation: string): string {
    const safeName = sanitizeRelationName(relation);
    const fileName = namespace ? `${namespace}--${safeName}.jsonl` : `${safeName}.jsonl`;
    return join(dataDir, fileName);
  }

  function sanitizeRelationName(name: string): string {
    // Replace characters that are problematic in filenames
    return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
  }

  /** Replay the JSONL log file to build current state. */
  function loadRelation(relation: string): Map<string, MaterializedEntry> {
    const existing = cache.get(relation);
    if (existing) return existing;

    const entries = new Map<string, MaterializedEntry>();
    const filePath = relationPath(relation);

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      let totalLines = 0;

      for (const line of lines) {
        totalLines++;
        try {
          const entry = JSON.parse(line) as LogEntry;
          if (entry._op === 'put') {
            const { _op, _key, _ts, ...fields } = entry;
            entries.set(_key, {
              fields,
              meta: { lastWrittenAt: _ts },
            });
          } else if (entry._op === 'del') {
            entries.delete(entry._key);
          }
        } catch {
          // Skip malformed lines — append-only logs may have partial writes
          // from crashes. The data before the bad line is still valid.
        }
      }

      // Track tombstone ratio for compaction
      appendCounts.set(relation, totalLines);
    }

    cache.set(relation, entries);
    return entries;
  }

  /** Append a log entry to the relation's JSONL file. */
  function appendEntry(relation: string, entry: LogEntry): void {
    const filePath = relationPath(relation);
    appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');

    // Track appends for compaction
    const count = (appendCounts.get(relation) ?? 0) + 1;
    appendCounts.set(relation, count);
  }

  /** Compact a relation's log file — rewrite with only live entries. */
  function maybeCompact(relation: string): void {
    const entries = cache.get(relation);
    if (!entries) return;

    const liveCount = entries.size;
    const totalAppends = appendCounts.get(relation) ?? 0;

    // Only compact if tombstone ratio exceeds threshold
    if (liveCount === 0 && totalAppends === 0) return;
    if (totalAppends <= 0) return;

    const tombstoneRatio = liveCount > 0
      ? 1 - (liveCount / totalAppends)
      : (totalAppends > 0 ? 1 : 0);

    if (tombstoneRatio < compactionThreshold) return;

    // Rewrite the file with only live entries
    const filePath = relationPath(relation);
    const lines: string[] = [];
    for (const [key, entry] of entries) {
      const logEntry: LogEntry = {
        _op: 'put',
        _key: key,
        _ts: entry.meta.lastWrittenAt,
        ...entry.fields,
      };
      lines.push(JSON.stringify(logEntry));
    }

    writeFileSync(filePath, lines.length > 0 ? lines.join('\n') + '\n' : '', 'utf-8');
    appendCounts.set(relation, lines.length);
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const entries = loadRelation(relation);
      const now = new Date().toISOString();
      const existing = entries.get(key);

      if (existing && storage.onConflict) {
        const info: ConflictInfo = {
          relation,
          key,
          existing: {
            fields: { ...existing.fields },
            writtenAt: existing.meta.lastWrittenAt,
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
          case 'merge': {
            const merged = { ...resolution.merged };
            entries.set(key, { fields: merged, meta: { lastWrittenAt: now } });
            appendEntry(relation, { _op: 'put', _key: key, _ts: now, ...merged });
            return;
          }
          case 'escalate':
            break;
        }
      }

      entries.set(key, {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      });

      appendEntry(relation, { _op: 'put', _key: key, _ts: now, ...value });
      maybeCompact(relation);
    },

    async get(relation, key) {
      const entries = loadRelation(relation);
      const entry = entries.get(key);
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const entries = loadRelation(relation);
      const all = Array.from(entries.entries()).map(([key, e]) => ({
        ...e.fields,
        _key: key,
      }));

      if (!criteria || Object.keys(criteria).length === 0) {
        return all.map(e => ({ ...e }));
      }

      return all
        .filter(entry =>
          Object.entries(criteria).every(([k, v]) => entry[k] === v),
        )
        .map(e => ({ ...e }));
    },

    async del(relation, key) {
      const entries = loadRelation(relation);
      if (!entries.has(key)) return;

      entries.delete(key);
      appendEntry(relation, { _op: 'del', _key: key, _ts: new Date().toISOString() });
      maybeCompact(relation);
    },

    async delMany(relation, criteria) {
      const entries = loadRelation(relation);
      let count = 0;
      const now = new Date().toISOString();

      for (const [key, entry] of entries) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          entries.delete(key);
          appendEntry(relation, { _op: 'del', _key: key, _ts: now });
          count++;
        }
      }

      if (count > 0) {
        maybeCompact(relation);
      }

      return count;
    },

    async getMeta(relation, key) {
      const entries = loadRelation(relation);
      const entry = entries.get(key);
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}

/**
 * Force compaction of all relation files in a data directory.
 * Useful as a maintenance command: `clef storage compact`.
 */
export function compactAll(dataDir: string): { relation: string; before: number; after: number }[] {
  if (!existsSync(dataDir)) return [];

  const results: { relation: string; before: number; after: number }[] = [];
  const files = readdirSync(dataDir).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = join(dataDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const beforeCount = lines.length;

    // Replay to get live entries
    const entries = new Map<string, { fields: Record<string, unknown>; ts: string }>();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        if (entry._op === 'put') {
          const { _op, _key, _ts, ...fields } = entry;
          entries.set(_key, { fields, ts: _ts });
        } else if (entry._op === 'del') {
          entries.delete(entry._key);
        }
      } catch {
        // Skip malformed
      }
    }

    // Rewrite
    const compacted: string[] = [];
    for (const [key, entry] of entries) {
      compacted.push(JSON.stringify({ _op: 'put', _key: key, _ts: entry.ts, ...entry.fields }));
    }

    writeFileSync(filePath, compacted.length > 0 ? compacted.join('\n') + '\n' : '', 'utf-8');

    const relation = file.replace(/\.jsonl$/, '');
    results.push({ relation, before: beforeCount, after: compacted.length });
  }

  return results;
}
