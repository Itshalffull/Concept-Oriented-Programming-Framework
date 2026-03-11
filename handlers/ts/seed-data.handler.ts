// ============================================================
// SeedData Handler
//
// Discovers and applies declarative seed data from per-concept
// YAML files. Each concept can ship a `.seeds.yaml` declaring
// initial entries to create on first load.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

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

  // Simple YAML parser for seeds format
  // Splits on top-level `---` for multi-document support
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
        // New entry
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
        // Continuation of current entry
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
  // Strip quotes
  if ((raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  return raw;
}

async function listSeedRecords(storage: ConceptStorage): Promise<Array<Record<string, unknown>>> {
  return storage.find('seed-data', {});
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

export const seedDataHandler: ConceptHandler = {
  async discover(input: Record<string, unknown>, storage: ConceptStorage) {
    const basePath = input.base_path as string;

    if (!basePath) {
      return { variant: 'error', message: 'base_path is required' };
    }

    // In a real implementation, this would use fs.readdirSync recursively.
    // For the kernel/runtime, the caller provides file contents via register().
    // discover() is the filesystem-aware entry point.
    try {
      const fs = await import('fs');
      const path = await import('path');

      const found: Array<{
        seed: string; concept_uri: string;
        source_path: string; entry_count: number;
      }> = [];
      const registrations: Promise<void>[] = [];

      function walkDir(dir: string) {
        let dirEntries: string[];
        try {
          dirEntries = fs.readdirSync(dir);
        } catch {
          return;
        }
        for (const entry of dirEntries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.endsWith('.seeds.yaml')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Convention: filename is <ConceptName>.seeds.yaml
            // The concept name from the filename takes precedence,
            // falling back to the `concept:` field inside the YAML.
            const fileConceptName = entry.replace('.seeds.yaml', '');
            const parsed = parseSeedsYaml(content);
            for (const seedDef of parsed) {
              const conceptUri = normalizeConceptUri(fileConceptName || seedDef.concept_uri);
              const id = nextId();
              const record = {
                id,
                source_path: fullPath,
                concept_uri: conceptUri,
                action_name: seedDef.action_name,
                entries: JSON.stringify(seedDef.entries.map((entry) => JSON.stringify(entry))),
                entry_count: seedDef.entries.length,
                applied: false,
                applied_at: null,
                error_log: JSON.stringify([]),
              };
              registrations.push(storage.put('seed-data', id, record));
              found.push({
                seed: id,
                concept_uri: conceptUri,
                source_path: fullPath,
                entry_count: seedDef.entries.length,
              });
            }
          }
        }
      }

      walkDir(basePath);
      await Promise.all(registrations);
      return { variant: 'ok', found };
    } catch (e) {
      return { variant: 'error', message: `Failed to discover seeds: ${e}` };
    }
  },

  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const sourcePath = input.source_path as string;
    const conceptUri = normalizeConceptUri(input.concept_uri as string);
    const actionName = input.action_name as string;
    const entries = input.entries as string[];

    // Check for duplicate by source_path
    const existing = await storage.find('seed-data', { source_path: sourcePath });
    if (existing.some((entry) => entry.source_path === sourcePath)) {
      return { variant: 'duplicate', message: `Seed already registered for ${sourcePath}` };
    }

    const id = nextId();
    await storage.put('seed-data', id, {
      id,
      source_path: sourcePath,
      concept_uri: conceptUri,
      action_name: actionName,
      entries: JSON.stringify(entries),
      entry_count: entries.length,
      applied: false,
      applied_at: null,
      error_log: JSON.stringify([]),
    });

    return { variant: 'ok', seed: id };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const seedId = input.seed as string;

    const record = await storage.get('seed-data', seedId);
    if (!record) {
      return { variant: 'notfound', message: `No seed record with id ${seedId}` };
    }

    if (record.applied) {
      return { variant: 'already_applied', seed: seedId };
    }

    // Parse entries and invoke concept action for each
    const errors: string[] = [];

    // The actual invocation is delegated to the kernel via a callback.
    // The handler stores the intent; the kernel's seed loader calls
    // kernel.invokeConcept() for each entry.
    // For now, mark as applied and return the count.
    const appliedCount = parseStoredEntries(record.entries).length;

    await storage.put('seed-data', seedId, {
      ...record,
      applied: true,
      applied_at: new Date().toISOString(),
      error_log: JSON.stringify(errors),
    });

    return { variant: 'ok', seed: seedId, applied_count: appliedCount };
  },

  async applyAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const seeds = await listSeedRecords(storage);

    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const seed of seeds) {
      if (seed.applied) {
        skippedCount++;
        continue;
      }

      appliedCount += parseStoredEntries(seed.entries).length;

      await storage.put('seed-data', seed.id as string, {
        ...seed,
        applied: true,
        applied_at: new Date().toISOString(),
      });
    }

    return { variant: 'ok', applied_count: appliedCount, skipped_count: skippedCount, error_count: errorCount };
  },

  async status(input: Record<string, unknown>, storage: ConceptStorage) {
    const seeds = await listSeedRecords(storage);

    const result = seeds.map((s) => ({
      seed: s.id,
      concept_uri: s.concept_uri,
      source_path: s.source_path,
      entry_count: s.entry_count,
      applied: s.applied,
      applied_at: s.applied_at,
      errors: parseStoredErrors(s.error_log),
    }));

    return { variant: 'ok', seeds: result };
  },

  async reset(input: Record<string, unknown>, storage: ConceptStorage) {
    const seedId = input.seed as string;

    const record = await storage.get('seed-data', seedId);
    if (!record) {
      return { variant: 'notfound', message: `No seed record with id ${seedId}` };
    }

    await storage.put('seed-data', seedId, {
      ...record,
      applied: false,
      applied_at: null,
      error_log: JSON.stringify([]),
    });

    return { variant: 'ok', seed: seedId };
  },
};

export default seedDataHandler;

// Re-export the YAML parser for use by the kernel seed loader
export { parseSeedsYaml };
