// @clef-handler style=functional
// ProviderManifest Concept Implementation
//
// Aggregates provider entries from external config files by delegating to
// registered readers (matched by file-pattern), deduplicates across readers
// by priority (higher priority wins on kind + slot collision), and holds the
// resolved entry set ready for emission to PluginRegistry. A reload diffs
// the freshly collected entries against the stored set and returns delta counts.
//
// See docs/plans/virtual-provider-registry-prd.md §3.1.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  del,
  branch,
  complete,
  completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

/**
 * Module-level hook for dispatching PluginRegistry/register + /remove calls
 * when reload detects diff. The handler itself cannot invoke other concepts
 * directly from within a StorageProgram — instead, we expose an emitter that
 * external integration code (kernel boot, dev-mode file watcher) can set to
 * forward diff deltas to a running kernel.
 */
export interface PluginRegistryEmitter {
  register(entry: NormalizedEntry): void | Promise<void>;
  remove(entry: NormalizedEntry): void | Promise<void>;
}

let emitter: PluginRegistryEmitter | null = null;
export function setPluginRegistryEmitter(fn: PluginRegistryEmitter | null): void {
  emitter = fn;
}
function entryKey(e: NormalizedEntry): string {
  return `${e.kind}|${e.slot}|${e.provider}|${e.sourcePath}`;
}
function entriesEqual(a: NormalizedEntry, b: NormalizedEntry): boolean {
  if (a.options !== b.options) return false;
  if (a.priority !== b.priority) return false;
  if (a.extensions.length !== b.extensions.length) return false;
  for (let i = 0; i < a.extensions.length; i++) {
    if (a.extensions[i] !== b.extensions[i]) return false;
  }
  return true;
}

type Result = { variant: string; [key: string]: unknown };

/** Normalized provider entry shape (matches PRD §3.1). */
interface NormalizedEntry {
  kind: 'parse' | 'format' | 'highlight' | 'content-serializer';
  slot: string;
  provider: string;
  options: string;        // opaque Bytes (base64 or empty string)
  extensions: string[];
  priority: number;
  sourcePath: string;
}

let idCounter = 0;
function nextId(): string {
  return `provider-manifest-${++idCounter}`;
}

/** Reset ID counter (for testing). */
export function resetProviderManifestIds(): void {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Module-level reader dispatch table
//
// ProviderManifest does not know the reader implementations at compile time.
// Reader functions are registered here by reader adapter modules as an
// import-time side-effect. The load/reload actions look up functions by the
// file-pattern prefix string that matches a given source path.
// ---------------------------------------------------------------------------

export type ManifestReaderFn = (path: string) => NormalizedEntry[];

interface ReaderRegistration {
  patterns: string[];
  priority: number;
  fn: ManifestReaderFn;
}

const dispatchTable: Map<string, ReaderRegistration> = new Map();

/** Register a reader dispatch entry. Patterns are glob-style file-patterns. */
export function registerManifestReader(
  readerId: string,
  patterns: string[],
  priority: number,
  fn: ManifestReaderFn,
): void {
  dispatchTable.set(readerId, { patterns, priority, fn });
}

/** Clear the dispatch table (for testing). */
export function clearManifestReaders(): void {
  dispatchTable.clear();
}

/** Return the flat union of every file-pattern every registered reader declared. */
export function listManifestReaderPatterns(): string[] {
  const out: string[] = [];
  for (const reg of dispatchTable.values()) {
    for (const p of reg.patterns) out.push(p);
  }
  return out;
}

/**
 * Find all readers whose patterns match the given path (simple prefix/suffix
 * heuristic — full glob matching is a provider concern).
 */
function findMatchingReaders(path: string): ReaderRegistration[] {
  const matched: ReaderRegistration[] = [];
  for (const reg of dispatchTable.values()) {
    const matches = reg.patterns.some((pat) => {
      // Exact match, suffix match (*.foo), or prefix match (dir/*)
      if (pat === path) return true;
      if (pat.startsWith('*')) return path.endsWith(pat.slice(1));
      if (pat.endsWith('*')) return path.startsWith(pat.slice(0, -1));
      // Simple contains heuristic for patterns like "node_modules/tree-sitter-*/..."
      const star = pat.indexOf('*');
      if (star !== -1) {
        const prefix = pat.slice(0, star);
        const suffix = pat.slice(star + 1);
        return path.startsWith(prefix) && path.endsWith(suffix);
      }
      return false;
    });
    if (matches) matched.push(reg);
  }
  return matched;
}

/**
 * Collect entries from all source paths, dispatch to matching readers, and
 * deduplicate by kind+slot keeping the entry from the highest-priority reader.
 */
function collectEntries(sources: string[]): NormalizedEntry[] {
  const allEntries: NormalizedEntry[] = [];

  for (const src of sources) {
    const readers = findMatchingReaders(src);
    for (const reg of readers) {
      try {
        const entries = reg.fn(src);
        for (const entry of entries) {
          allEntries.push({ ...entry, priority: reg.priority, sourcePath: src });
        }
      } catch {
        // Individual reader failures are silenced; the caller propagates on
        // total failure only (no readers matched at all).
      }
    }
  }

  // Deduplicate: for each kind+slot keep the highest-priority entry.
  const best = new Map<string, NormalizedEntry>();
  for (const entry of allEntries) {
    const key = `${entry.kind}:${entry.slot}`;
    const existing = best.get(key);
    if (existing == null || entry.priority > existing.priority) {
      best.set(key, entry);
    }
  }

  return Array.from(best.values());
}

// ---------------------------------------------------------------------------
// Concept handler
// ---------------------------------------------------------------------------

export const providerManifestHandler: FunctionalConceptHandler = {

  load(input: Record<string, unknown>) {
    const sources = Array.isArray(input.sources)
      ? (input.sources as unknown[]).map(String)
      : [];

    if (sources.length === 0) {
      return complete(createProgram(), 'error', {
        message: 'sources must not be empty',
      }) as StorageProgram<Result>;
    }

    // Collect entries eagerly so we can stage them as individual put()s and
    // have a persisted view reload() can diff against.
    let freshEntries: NormalizedEntry[];
    try {
      freshEntries = collectEntries(sources);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Read existing entries so the interpreter clears them before replacing.
    p = find(p, 'entries', {}, 'existingEntries');
    // Record the loaded sources so reload knows what to re-read.
    p = put(p, 'providerManifestState', 'loadedSources', {
      value: JSON.stringify(sources),
    });

    // Persist each entry under its composite key so reload can load them back.
    for (const entry of freshEntries) {
      p = put(p, 'entries', entryKey(entry), {
        kind: entry.kind,
        slot: entry.slot,
        provider: entry.provider,
        options: entry.options,
        extensions: JSON.stringify(entry.extensions),
        priority: entry.priority,
        sourcePath: entry.sourcePath,
      });
    }

    return complete(p, 'ok', { count: freshEntries.length }) as StorageProgram<Result>;
  },

  reload(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'providerManifestState', 'loadedSources', 'loadedSources');
    p = find(p, 'entries', {}, 'existingEntries');
    return branch(
      p,
      (b) => b.loadedSources != null,
      (b) => {
        return completeFrom(
          b as StorageProgram<Record<string, unknown>>,
          'ok',
          (bindings) => {
            const sourcesRecord = bindings.loadedSources as { value?: string } | null;
            const sourcesJson = sourcesRecord?.value ?? null;
            if (!sourcesJson) {
              return { variant: 'error', message: 'no sources have been loaded yet' };
            }
            let sources: string[];
            try {
              sources = JSON.parse(sourcesJson) as string[];
            } catch {
              return { variant: 'error', message: 'stored sources state is corrupted' };
            }

            let freshEntries: NormalizedEntry[];
            try {
              freshEntries = collectEntries(sources);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              return { variant: 'error', message };
            }

            const existingRows = (bindings.existingEntries ?? []) as Array<
              Record<string, unknown>
            >;
            const oldMap = new Map<string, NormalizedEntry>();
            for (const row of existingRows) {
              let extensions: string[] = [];
              try {
                extensions = JSON.parse(String(row.extensions ?? '[]'));
              } catch { /* keep [] */ }
              const e: NormalizedEntry = {
                kind: row.kind as NormalizedEntry['kind'],
                slot: String(row.slot ?? ''),
                provider: String(row.provider ?? ''),
                options: String(row.options ?? ''),
                extensions,
                priority: Number(row.priority ?? 0),
                sourcePath: String(row.sourcePath ?? ''),
              };
              oldMap.set(entryKey(e), e);
            }
            const newMap = new Map<string, NormalizedEntry>();
            for (const e of freshEntries) newMap.set(entryKey(e), e);

            const added: NormalizedEntry[] = [];
            const removed: NormalizedEntry[] = [];
            const changed: NormalizedEntry[] = [];

            for (const [k, e] of newMap) {
              const prev = oldMap.get(k);
              if (!prev) added.push(e);
              else if (!entriesEqual(prev, e)) changed.push(e);
            }
            for (const [k, e] of oldMap) {
              if (!newMap.has(k)) removed.push(e);
            }

            // Emit PluginRegistry/* calls via the registered hook, if any.
            // Remove first, then re-register (removed + changed), then register (added + changed).
            if (emitter != null) {
              const runRemove = [...removed, ...changed];
              const runRegister = [...added, ...changed];
              try {
                for (const e of runRemove) void emitter.remove(e);
                for (const e of runRegister) void emitter.register(e);
              } catch {
                // Emitter failures are non-fatal for the reload result itself.
              }
            }

            return {
              variant: 'ok',
              added: added.length,
              removed: removed.length,
              changed: changed.length,
              // carry the diff entry bundles for tests / watcher consumers
              _diff: { added, removed, changed },
            };
          },
        ) as StorageProgram<Result>;
      },
      (b) =>
        complete(b, 'error', {
          message: 'no sources have been loaded yet; call load first',
        }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listEntries(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entries', {}, 'allEntries');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allEntries ?? []) as Array<Record<string, unknown>>;
      const entries = Buffer.from(JSON.stringify(all)).toString('base64');
      return { variant: 'ok', entries };
    }) as StorageProgram<Result>;
  },

};

export const handler = autoInterpret(providerManifestHandler);
export default handler;
