// ============================================================
// Attribution Handler
//
// Bind agent identity to content regions, tracking who created
// or modified each piece. Supports blame queries, per-region
// authorship history, and CODEOWNERS-style ownership patterns.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `attribution-${++idCounter}`;
}

/**
 * Check whether a glob-style pattern matches a given path.
 * Supports * (any segment) and ** (any depth) wildcards.
 */
function matchPattern(pattern: string, path: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex specials (except * and ?)
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

export const attributionHandler: ConceptHandler = {
  async attribute(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;
    const region = input.region as string;
    const agent = input.agent as string;
    const changeRef = input.changeRef as string;

    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('attribution', id, {
      id,
      contentRef,
      region,
      agent,
      timestamp: now,
      changeRef,
    });

    return { variant: 'ok', attributionId: id };
  },

  async blame(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;

    const records = await storage.find('attribution', { contentRef });

    // Build blame map: for each region, find the most recent attribution
    const regionMap = new Map<string, { region: string; agent: string; changeRef: string; timestamp: string }>();
    for (const record of records) {
      const region = record.region as string;
      const existing = regionMap.get(region);
      if (!existing || (record.timestamp as string) > existing.timestamp) {
        regionMap.set(region, {
          region,
          agent: record.agent as string,
          changeRef: record.changeRef as string,
          timestamp: record.timestamp as string,
        });
      }
    }

    const map = Array.from(regionMap.values()).map(entry => ({
      region: entry.region,
      agent: entry.agent,
      changeRef: entry.changeRef,
    }));

    return { variant: 'ok', map };
  },

  async history(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentRef = input.contentRef as string;
    const region = input.region as string;

    const records = await storage.find('attribution', { contentRef, region });

    if (records.length === 0) {
      return { variant: 'notFound', message: `No attributions found for contentRef '${contentRef}' and region '${region}'` };
    }

    // Sort chronologically
    const sorted = records.sort((a, b) =>
      (a.timestamp as string).localeCompare(b.timestamp as string),
    );

    const chain = sorted.map(r => r.id as string);
    return { variant: 'ok', chain };
  },

  async setOwnership(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const owners = input.owners as string[];

    // Check if an ownership rule for this pattern already exists
    const existing = await storage.find('attribution-ownership', { pattern });
    if (existing.length > 0) {
      await storage.put('attribution-ownership', existing[0].id as string, {
        ...existing[0],
        owners: JSON.stringify(owners),
      });
    } else {
      const id = `ownership-${pattern.replace(/[^a-zA-Z0-9]/g, '-')}`;
      await storage.put('attribution-ownership', id, {
        id,
        pattern,
        owners: JSON.stringify(owners),
      });
    }

    return { variant: 'ok' };
  },

  async queryOwners(input: Record<string, unknown>, storage: ConceptStorage) {
    const path = input.path as string;

    const rules = await storage.find('attribution-ownership');

    // Find all matching patterns
    const matchedOwners: string[] = [];
    let matched = false;

    for (const rule of rules) {
      const rulePattern = rule.pattern as string;
      if (matchPattern(rulePattern, path)) {
        matched = true;
        const ruleOwners = JSON.parse(rule.owners as string) as string[];
        for (const owner of ruleOwners) {
          if (!matchedOwners.includes(owner)) {
            matchedOwners.push(owner);
          }
        }
      }
    }

    if (!matched) {
      return { variant: 'noMatch', message: `No ownership pattern matches path '${path}'` };
    }

    return { variant: 'ok', owners: matchedOwners };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetAttributionCounter(): void {
  idCounter = 0;
}
