// ============================================================
// Lite Query Adapter
//
// Section 4.2: Mode B — Lite Query Protocol
//
// LiteQueryAdapter sits engine-side and translates ConceptQuery
// into lite protocol calls, with a TTL-based cache. Push
// invalidations happen automatically when the concept returns
// an action completion (Section 4.4).
//
// createStorageLiteProtocol creates a LiteQueryProtocol backed
// by ConceptStorage, used by generated code to expose concept
// state via the lite protocol.
// ============================================================

import type {
  ConceptStorage,
  ConceptStateSnapshot,
  LiteFilter,
  LiteQueryProtocol,
} from '../../../kernel/src/types.js';

// --- LiteQueryAdapter with Caching (Section 4.2) ---

/** Default threshold for lite query snapshot size warnings. */
const DEFAULT_LITE_QUERY_WARN_THRESHOLD = 1000;

export class LiteQueryAdapter {
  private cache: ConceptStateSnapshot | null = null;
  private cacheValidUntil: number = 0;
  /** Configurable threshold for large snapshot warnings. */
  private warnThreshold: number;

  constructor(
    private lite: LiteQueryProtocol,
    private cacheTtlMs: number = 5000,
    options?: { warnThreshold?: number },
  ) {
    this.warnThreshold = options?.warnThreshold ?? DEFAULT_LITE_QUERY_WARN_THRESHOLD;
  }

  /** Set the warn threshold for large snapshots. */
  setWarnThreshold(threshold: number): void {
    this.warnThreshold = threshold;
  }

  /** Get the current warn threshold. */
  getWarnThreshold(): number {
    return this.warnThreshold;
  }

  /**
   * Resolve a query against the lite protocol.
   * Fast path: single-key lookup.
   * Medium path: simple filter.
   * Slow path: full snapshot + in-engine filtering.
   */
  async resolve(
    relation: string,
    args?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    // Fast path: single-key lookup
    if (args && Object.keys(args).length === 1 && this.lite.lookup) {
      const [field, value] = Object.entries(args)[0];
      const result = await this.lite.lookup(relation, String(value));
      return result ? [result] : [];
    }

    // Medium path: simple filter
    if (args && Object.keys(args).length > 0 && this.lite.filter) {
      const criteria: LiteFilter[] = Object.entries(args).map(
        ([field, value]) => ({ field, op: 'eq' as const, value }),
      );
      return this.lite.filter(criteria);
    }

    // Slow path: full snapshot + in-engine filter
    const snapshot = await this.getSnapshot();
    const entries = snapshot.relations[relation] ?? [];
    if (!args || Object.keys(args).length === 0) return entries;
    return entries.filter(entry =>
      Object.entries(args).every(([k, v]) => entry[k] === v),
    );
  }

  /** Invalidate cache — called when concept reports a state change */
  invalidate(): void {
    this.cache = null;
    this.cacheValidUntil = 0;
  }

  /** Get the current cached snapshot (or null if not cached) */
  getCachedSnapshot(): ConceptStateSnapshot | null {
    if (this.cache && Date.now() < this.cacheValidUntil) {
      return this.cache;
    }
    return null;
  }

  private async getSnapshot(): Promise<ConceptStateSnapshot> {
    if (this.cache && Date.now() < this.cacheValidUntil) {
      return this.cache;
    }
    this.cache = await this.lite.snapshot();
    this.cacheValidUntil = Date.now() + this.cacheTtlMs;

    // Warn when snapshot is large
    const totalEntries = Object.values(this.cache.relations)
      .reduce((sum, entries) => sum + entries.length, 0);
    if (totalEntries > this.warnThreshold) {
      console.warn(
        `[copf/lite-query] Snapshot returned ${totalEntries} entries ` +
        `(threshold: ${this.warnThreshold}). Consider using filter() or ` +
        `lookup() instead of snapshot() for large datasets.`,
      );
    }

    return this.cache;
  }
}

// --- Create lite query protocol from ConceptStorage ---

/**
 * Create a LiteQueryProtocol backed by ConceptStorage.
 * This is what a concept's generated code uses to expose
 * its state via the lite protocol.
 */
export function createStorageLiteProtocol(
  storage: ConceptStorage,
  relationNames: string[],
): LiteQueryProtocol {
  return {
    async snapshot(): Promise<ConceptStateSnapshot> {
      const relations: Record<string, Record<string, unknown>[]> = {};
      for (const name of relationNames) {
        relations[name] = await storage.find(name);
      }
      return {
        asOf: new Date().toISOString(),
        relations,
      };
    },

    async lookup(relation: string, key: string): Promise<Record<string, unknown> | null> {
      return storage.get(relation, key);
    },

    async filter(criteria: LiteFilter[]): Promise<Record<string, unknown>[]> {
      const allEntries = await storage.find(
        criteria.length > 0 ? criteria[0].field : '',
      );
      return allEntries.filter(entry =>
        criteria.every(c => applyFilter(entry, c)),
      );
    },
  };
}

function applyFilter(entry: Record<string, unknown>, filter: LiteFilter): boolean {
  const value = entry[filter.field];
  switch (filter.op) {
    case 'eq': return value === filter.value;
    case 'neq': return value !== filter.value;
    case 'gt': return (value as number) > (filter.value as number);
    case 'gte': return (value as number) >= (filter.value as number);
    case 'lt': return (value as number) < (filter.value as number);
    case 'lte': return (value as number) <= (filter.value as number);
    case 'in': return Array.isArray(filter.value) && (filter.value as unknown[]).includes(value);
    case 'contains': return typeof value === 'string' && value.includes(filter.value as string);
    default: return false;
  }
}
