// ============================================================
// Upstash Redis REST Storage Adapter
//
// Implements ConceptStorage using the Upstash Redis REST API.
// Works with Vercel KV (which is Upstash under the hood).
// Uses only fetch — no npm dependencies required.
//
// Environment variables:
//   KV_REST_API_URL   — Upstash/Vercel KV REST endpoint
//   KV_REST_API_TOKEN — Upstash/Vercel KV REST auth token
//
// Key format matches redis-storage.ts:
//   {prefix}:{relation}:{key}       -> Hash with entry fields
//   {prefix}:{relation}:_keys       -> Set of all keys in relation
//   {prefix}:{relation}:{key}:_meta -> lastWrittenAt timestamp
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
} from '../types.js';

export interface UpstashStorageConfig {
  /** Upstash REST API URL (e.g. https://xyz.upstash.io) */
  url: string;
  /** Upstash REST API token */
  token: string;
  /** Key prefix for all entries (e.g. "clef-account:prod") */
  keyPrefix: string;
}

// --- Upstash REST client (minimal, fetch-based) ---

async function upstashCommand(
  url: string,
  token: string,
  args: (string | number)[],
): Promise<unknown> {
  const res = await fetch(`${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash error ${res.status}: ${text}`);
  }
  const json = await res.json() as { result: unknown };
  return json.result;
}

async function upstashPipeline(
  url: string,
  token: string,
  commands: (string | number)[][],
): Promise<{ result: unknown }[]> {
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash pipeline error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ result: unknown }[]>;
}

// --- Helpers ---

function entryKey(prefix: string, relation: string, key: string): string {
  return `${prefix}:${relation}:${key}`;
}

function keySetKey(prefix: string, relation: string): string {
  return `${prefix}:${relation}:_keys`;
}

function metaKey(prefix: string, relation: string, key: string): string {
  return `${prefix}:${relation}:${key}:_meta`;
}

function serializeValue(v: unknown): string {
  return JSON.stringify(v);
}

function deserializeValue(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

// Upstash HGETALL returns a flat array: [field1, value1, field2, value2, ...]
function parseHGetAll(result: unknown): Record<string, unknown> | null {
  if (!result || !Array.isArray(result) || result.length === 0) return null;
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < result.length; i += 2) {
    obj[result[i] as string] = deserializeValue(result[i + 1] as string);
  }
  return obj;
}

// --- Factory ---

/**
 * Create a ConceptStorage backed by Upstash Redis REST API.
 * Works with Vercel KV — just set KV_REST_API_URL and KV_REST_API_TOKEN.
 */
export function createUpstashStorage(config: UpstashStorageConfig): ConceptStorage {
  const { url, token, keyPrefix: prefix } = config;

  const cmd = (...args: (string | number)[]) => upstashCommand(url, token, args);

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const ek = entryKey(prefix, relation, key);
      const mk = metaKey(prefix, relation, key);
      const ks = keySetKey(prefix, relation);

      // Conflict detection
      if (storage.onConflict) {
        const existing = parseHGetAll(await cmd('HGETALL', ek));
        if (existing) {
          const existingMeta = await cmd('GET', mk) as string | null;
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: existing,
              writtenAt: existingMeta ?? now,
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
              const fields: (string | number)[] = [];
              for (const [k, v] of Object.entries(resolution.merged)) {
                fields.push(k, serializeValue(v));
              }
              await upstashPipeline(url, token, [
                ['HSET', ek, ...fields],
                ['SET', mk, now],
                ['SADD', ks, key],
              ]);
              return;
            }
            case 'escalate':
              break;
          }
        }
      }

      // Serialize fields for HSET
      const fields: (string | number)[] = [];
      for (const [k, v] of Object.entries(value)) {
        fields.push(k, serializeValue(v));
      }

      // Pipeline: HSET + SET meta + SADD to key set
      await upstashPipeline(url, token, [
        ['HSET', ek, ...fields],
        ['SET', mk, now],
        ['SADD', ks, key],
      ]);
    },

    async get(relation, key) {
      const ek = entryKey(prefix, relation, key);
      return parseHGetAll(await cmd('HGETALL', ek));
    },

    async find(relation, criteria?) {
      const ks = keySetKey(prefix, relation);
      const keys = await cmd('SMEMBERS', ks) as string[];

      if (!keys || keys.length === 0) return [];

      // Pipeline HGETALL for all keys
      const commands = keys.map(k => ['HGETALL', entryKey(prefix, relation, k)] as string[]);
      const results = await upstashPipeline(url, token, commands);

      const entries: Record<string, unknown>[] = [];
      for (let i = 0; i < results.length; i++) {
        const parsed = parseHGetAll(results[i].result);
        if (parsed) {
          parsed._key = keys[i];
          entries.push(parsed);
        }
      }

      if (!criteria || Object.keys(criteria).length === 0) {
        return entries;
      }

      return entries.filter(entry =>
        Object.entries(criteria!).every(([k, v]) => entry[k] === v),
      );
    },

    async del(relation, key) {
      const ek = entryKey(prefix, relation, key);
      const mk = metaKey(prefix, relation, key);
      const ks = keySetKey(prefix, relation);

      await upstashPipeline(url, token, [
        ['DEL', ek],
        ['DEL', mk],
        ['SREM', ks, key],
      ]);
    },

    async delMany(relation, criteria) {
      const matches = await storage.find(relation, criteria);
      if (matches.length === 0) return 0;

      let count = 0;
      for (const entry of matches) {
        const key = entry._key as string;
        if (key) {
          await storage.del(relation, key);
          count++;
        }
      }
      return count;
    },

    async getMeta(relation, key) {
      const mk = metaKey(prefix, relation, key);
      const lastWrittenAt = await cmd('GET', mk) as string | null;
      if (!lastWrittenAt) return null;
      return { lastWrittenAt };
    },
  };

  return storage;
}

/**
 * Create storage from environment variables.
 * Returns Upstash storage if KV_REST_API_URL is set, otherwise null.
 */
export function createStorageFromEnv(keyPrefix: string): ConceptStorage | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  return createUpstashStorage({ url, token, keyPrefix });
}
