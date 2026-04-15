// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SeedData Handler
//
// Discovers and applies declarative seed data from per-concept
// YAML files. Each concept can ship a `.seeds.yaml` declaring
// initial entries to create on first load.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  putFrom, traverse, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `seed-${++idCounter}`;
}

/**
 * Parse a .seeds.yaml file content into structured seed entries.
 * Supports the format:
 *   concept: ConceptName
 *   action: actionName
 *   entries:
 *     - field1: value1
 *       field2: value2
 */
function parseSeedsYaml(content: string): Array<{
  concept_uri: string;
  action_name: string;
  entries: Record<string, unknown>[];
}> {
  const results: Array<{
    concept_uri: string;
    action_name: string;
    entries: Record<string, unknown>[];
  }> = [];

  const documents = content.split(/^---$/m).filter(d => d.trim());

  for (const doc of documents) {
    const lines = doc.split('\n');
    let concept = '';
    let action = '';
    const entries: Record<string, unknown>[] = [];
    let currentEntry: Record<string, unknown> | null = null;
    let inEntries = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('concept:')) {
        concept = trimmed.replace('concept:', '').trim();
      } else if (trimmed.startsWith('action:')) {
        action = trimmed.replace('action:', '').trim();
      } else if (trimmed === 'entries:') {
        inEntries = true;
      } else if (inEntries && trimmed.startsWith('- ')) {
        if (currentEntry) entries.push(currentEntry);
        currentEntry = {};
        const fieldLine = trimmed.slice(2);
        const colonIdx = fieldLine.indexOf(':');
        if (colonIdx > 0) {
          const key = fieldLine.slice(0, colonIdx).trim();
          const value = parseYamlValue(fieldLine.slice(colonIdx + 1).trim());
          currentEntry[key] = value;
        }
      } else if (inEntries && currentEntry && /^\s{2,}\S/.test(line)) {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const value = parseYamlValue(trimmed.slice(colonIdx + 1).trim());
          currentEntry[key] = value;
        }
      }
    }
    if (currentEntry) entries.push(currentEntry);

    if (concept && action && entries.length > 0) {
      results.push({ concept_uri: concept, action_name: action, entries });
    }
  }

  return results;
}

function parseYamlValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  if ((raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function normalizeConceptUri(conceptUri: string): string {
  return conceptUri.startsWith('urn:') ? conceptUri : `urn:clef/${conceptUri}`;
}

function parseStoredEntries(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry));
  }
  if (typeof raw === 'string' && raw.trim()) {
    return JSON.parse(raw) as string[];
  }
  return [];
}

function parseStoredErrors(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry));
  }
  if (typeof raw === 'string' && raw.trim()) {
    return JSON.parse(raw) as string[];
  }
  return [];
}

const _handler: FunctionalConceptHandler = {
  /**
   * Discover seed files from the given base path. Returns all seeds
   * already registered at paths under base_path. In the functional style,
   * reads existing seeds from storage rather than scanning the filesystem.
   */
  discover(input: Record<string, unknown>) {
    const basePath = input.base_path as string;

    if (!basePath) {
      const p = createProgram();
      return complete(p, 'error', { message: 'base_path is required' }) as StorageProgram<Result>;
    }

    // Return all seeds already registered at paths under base_path.
    let p = createProgram();
    p = find(p, 'seed-data', {}, 'allSeeds');
    return completeFrom(p, 'ok', (bindings) => {
      const allSeeds = bindings.allSeeds as Array<Record<string, unknown>>;
      const found = allSeeds
        .filter(s => (s.source_path as string || '').startsWith(basePath))
        .map(s => s.id as string);
      return { found };
    }) as StorageProgram<Result>;
  },

  /**
   * Register a seed data record. Checks for duplicates via find,
   * then stores the new seed record.
   */
  register(input: Record<string, unknown>) {
    if (!input.entries || (typeof input.entries === 'string' && (input.entries as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'entries is required' }) as StorageProgram<Result>;
    }
    const sourcePath = input.source_path as string;
    const conceptUri = normalizeConceptUri(input.concept_uri as string);
    const actionName = input.action_name as string;
    const entries = input.entries as string[];

    let p = createProgram();
    p = find(p, 'seed-data', { source_path: sourcePath }, 'existing');

    return branch(p,
      (bindings) => {
        const existing = bindings.existing as Array<Record<string, unknown>>;
        return existing.some((entry) => entry.source_path === sourcePath);
      },
      (thenP) => complete(thenP, 'error', { message: `Seed already registered for ${sourcePath}` }),
      (elseP) => {
        const id = nextId();
        let p2 = put(elseP, 'seed-data', id, {
          id,
          source_path: sourcePath,
          concept_uri: conceptUri,
          action_name: actionName,
          entries: JSON.stringify(entries),
          entry_count: entries.length,
          applied: false,
          applied_at: null,
          error_log: '[]',
        });
        return complete(p2, 'ok', { seed: id });
      },
    ) as StorageProgram<Result>;
  },

  /**
   * Apply a single seed record. Gets the seed, marks it as applied
   * with a timestamp update via putFrom.
   */
  apply(input: Record<string, unknown>) {
    // Handle the case where seed is passed as an array (from discover's found list)
    const rawSeed = input.seed;
    const resolvedSeed = Array.isArray(rawSeed) ? rawSeed[0] : rawSeed;

    // No-op success when no seeds were discovered (empty array from discover)
    if (Array.isArray(rawSeed) && rawSeed.length === 0) {
      return complete(createProgram(), 'ok', { seed: '', applied_count: 0 }) as StorageProgram<Result>;
    }

    const seedId = resolvedSeed != null ? String(resolvedSeed) : '';

    let p = createProgram();
    p = get(p, 'seed-data', seedId, 'record');

    return branch(p, 'record',
      (thenP) => {
        return branch(thenP,
          (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return record.applied as boolean;
          },
          (b) => complete(b, 'ok', { seed: seedId }),
          (b) => {
            let b2 = mapBindings(b, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return parseStoredEntries(record.entries).length;
            }, '_appliedCount');

            b2 = putFrom(b2, 'seed-data', seedId, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return {
                ...record,
                applied: true,
                applied_at: new Date().toISOString(),
              };
            });

            return completeFrom(b2, 'ok', (bindings) => ({
              seed: seedId,
              applied_count: bindings._appliedCount as number,
            }));
          },
        );
      },
      (elseP) => complete(elseP, 'notfound', { message: `No seed record with id ${seedId}` }),
    ) as StorageProgram<Result>;
  },

  /**
   * Apply all unapplied seeds. Uses traverse to iterate over all seed
   * records, marking each unapplied seed as applied and collecting counts.
   */
  applyAll(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'seed-data', {}, 'seeds');

    p = traverse(p, 'seeds', '_seed', (item) => {
      const seed = item as Record<string, unknown>;
      let sub = createProgram();

      if (seed.applied) {
        return complete(sub, 'ok', { entryCount: 0 });
      }

      const entryCount = parseStoredEntries(seed.entries).length;
      sub = put(sub, 'seed-data', seed.id as string, {
        ...seed,
        applied: true,
        applied_at: new Date().toISOString(),
      });
      return complete(sub, 'ok', { entryCount });
    }, '_traverseResults', { writes: ['seed-data'], completionVariants: ['applied', 'skipped'] });

    return completeFrom(p, 'ok', (bindings) => {
      const results = (bindings._traverseResults || []) as Array<Record<string, unknown>>;
      let appliedCount = 0;
      let skippedCount = 0;
      for (const r of results) {
        if (r.variant === 'skipped') {
          skippedCount++;
        } else {
          appliedCount += (r.entryCount as number) || 0;
        }
      }
      return { applied_count: appliedCount, skipped_count: skippedCount, error_count: 0 };
    }) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'seed-data', {}, 'seeds');

    return completeFrom(p, 'ok', (bindings) => {
      const seeds = bindings.seeds as Record<string, unknown>[];

      const result = seeds.map((s) => ({
        seed: s.id,
        concept_uri: s.concept_uri,
        source_path: s.source_path,
        entry_count: s.entry_count,
        applied: s.applied,
        applied_at: s.applied_at,
        errors: parseStoredErrors(s.error_log),
      }));

      return { seeds: result };
    }) as StorageProgram<Result>;
  },

  /**
   * Reapply a seed: reset applied=false and update the stored content_hash.
   * The kernel calls this when a YAML file's hash differs from the stored hash.
   * On the next apply() call the seed will be re-executed.
   */
  reapply(input: Record<string, unknown>) {
    const rawSeed = input.seed;
    const resolvedSeed = Array.isArray(rawSeed) ? rawSeed[0] : rawSeed;
    const seedId = resolvedSeed != null ? String(resolvedSeed) : '';
    const contentHash = input.content_hash as string;

    let p = createProgram();
    p = get(p, 'seed-data', seedId, 'record');

    return branch(p, 'record',
      (thenP) => {
        let b = putFrom(thenP, 'seed-data', seedId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            applied: false,
            content_hash: contentHash,
            updated_at: new Date().toISOString(),
          };
        });
        return complete(b, 'reapplied', { seed: seedId });
      },
      (elseP) => complete(elseP, 'notfound', { message: `No seed record with id ${seedId}` }),
    ) as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    // Handle the case where seed is passed as an array (from discover's found list)
    const rawSeed = input.seed;
    const resolvedSeed = Array.isArray(rawSeed) ? rawSeed[0] : rawSeed;

    // No-op success when no seeds were discovered (empty array from discover)
    if (Array.isArray(rawSeed) && rawSeed.length === 0) {
      return complete(createProgram(), 'ok', { seed: '' }) as StorageProgram<Result>;
    }

    const seedId = resolvedSeed != null ? String(resolvedSeed) : '';

    let p = createProgram();
    p = get(p, 'seed-data', seedId, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { seed: seedId }),
      (elseP) => complete(elseP, 'notfound', { message: `No seed record with id ${seedId}` }),
    ) as StorageProgram<Result>;
  },
};

export const seedDataHandler = autoInterpret(_handler);

export default seedDataHandler;

/**
 * Filesystem-scanning discover — for use by the kernel seed loader only.
 * Not exposed as the primary handler action since it requires FS access.
 */
export async function discoverFromFilesystem(input: Record<string, unknown>, storage: ConceptStorage) {
  const basePath = input.base_path as string;

  if (!basePath) {
    return { variant: 'error', message: 'base_path is required' };
  }

  if (!existsSync(basePath)) {
    return { variant: 'ok', found: [] };
  }

  // Collect files from base and subdirectories
  const allFiles: Array<{file: string, dir: string}> = [];
  for (const entry of readdirSync(basePath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subdir = resolve(basePath, entry.name);
      for (const subEntry of readdirSync(subdir)) {
        if (subEntry.endsWith('.seeds.yaml')) {
          allFiles.push({ file: subEntry, dir: subdir });
        }
      }
    } else if (entry.name.endsWith('.seeds.yaml')) {
      allFiles.push({ file: entry.name, dir: basePath });
    }
  }
  const files = allFiles;
  const found: Array<{ id: string; currentHash: string }> = [];

  // Load all existing seed records so we can upsert by source_path rather than
  // creating duplicate records on every boot.
  const allExisting = await storage.find('seed-data', {});
  const existingByPath = new Map<string, Record<string, unknown>>();
  for (const rec of allExisting) {
    const r = rec as Record<string, unknown>;
    existingByPath.set(r.source_path as string, r);
  }

  for (const { file, dir } of files) {
    const filePath = resolve(dir, file);
    const content = readFileSync(filePath, 'utf8');
    // Compute fresh hash of the current file contents for change detection.
    const currentHash = createHash('sha256').update(content).digest('hex');
    const parsed = parseSeedsYaml(content);

    for (const seed of parsed) {
      const conceptUri = normalizeConceptUri(seed.concept_uri);
      const entries = seed.entries.map((e) => JSON.stringify(e));

      const existing = existingByPath.get(filePath);
      if (existing) {
        // Upsert: preserve id, applied status, applied_at, and the stored
        // content_hash (which records the hash at last-apply time). Only
        // refresh entries and metadata so the kernel can re-invoke if changed.
        const id = existing.id as string;
        await storage.put('seed-data', id, {
          ...existing,
          concept_uri: conceptUri,
          action_name: seed.action_name,
          entries: JSON.stringify(entries),
          entry_count: entries.length,
          // Do NOT overwrite content_hash here — it represents the hash at
          // last-apply time. The kernel compares stored content_hash vs
          // currentHash to decide whether to re-apply.
        });
        found.push({ id, currentHash });
      } else {
        const id = nextId();
        await storage.put('seed-data', id, {
          id,
          source_path: filePath,
          concept_uri: conceptUri,
          action_name: seed.action_name,
          entries: JSON.stringify(entries),
          entry_count: entries.length,
          applied: false,
          applied_at: null,
          updated_at: null,
          error_log: '[]',
          content_hash: null,
        });
        found.push({ id, currentHash });
      }
    }
  }

  return { variant: 'ok', found };
}

// Re-export the YAML parser for use by the kernel seed loader
export { parseSeedsYaml };
