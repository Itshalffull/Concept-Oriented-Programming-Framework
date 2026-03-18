// @migrated dsl-constructs 2026-03-18
// ============================================================
// SeedData Handler
//
// Discovers and applies declarative seed data from per-concept
// YAML files. Each concept can ship a `.seeds.yaml` declaring
// initial entries to create on first load.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

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
  discover(input: Record<string, unknown>) {
    const basePath = input.base_path as string;

    if (!basePath) {
      const p = createProgram();
      return complete(p, 'error', { message: 'base_path is required' }) as StorageProgram<Result>;
    }

    // discover() requires filesystem access and is inherently effectful.
    // In the functional style, we return a pure result describing the intent.
    const p = createProgram();
    return complete(p, 'ok', { found: [] }) as StorageProgram<Result>;
  },

  register(input: Record<string, unknown>) {
    const sourcePath = input.source_path as string;
    const conceptUri = normalizeConceptUri(input.concept_uri as string);
    const actionName = input.action_name as string;
    const entries = input.entries as string[];

    let p = createProgram();
    p = find(p, 'seed-data', { source_path: sourcePath }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.some((entry) => entry.source_path === sourcePath)) {
        return { variant: 'duplicate', message: `Seed already registered for ${sourcePath}` };
      }

      const id = nextId();
      return { seed: id };
    }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const seedId = input.seed as string;

    let p = createProgram();
    p = get(p, 'seed-data', seedId, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;

          if (record.applied) {
            return { variant: 'already_applied', seed: seedId };
          }

          const appliedCount = parseStoredEntries(record.entries).length;
          return { seed: seedId, applied_count: appliedCount };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `No seed record with id ${seedId}` }),
    ) as StorageProgram<Result>;
  },

  applyAll(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'seed-data', {}, 'seeds');

    return completeFrom(p, 'ok', (bindings) => {
      const seeds = bindings.seeds as Record<string, unknown>[];

      let appliedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const seed of seeds) {
        if (seed.applied) {
          skippedCount++;
          continue;
        }
        appliedCount += parseStoredEntries(seed.entries).length;
      }

      return { applied_count: appliedCount, skipped_count: skippedCount, error_count: errorCount };
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

  reset(input: Record<string, unknown>) {
    const seedId = input.seed as string;

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

// Re-export the YAML parser for use by the kernel seed loader
export { parseSeedsYaml };
