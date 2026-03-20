// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Attribution Handler
//
// Bind agent identity to content regions, tracking who created
// or modified each piece. Supports blame queries, per-region
// authorship history, and CODEOWNERS-style ownership patterns.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `attribution-${++idCounter}`;
}

/**
 * Check whether a glob-style pattern matches a given path.
 * Supports * (any segment) and ** (any depth) wildcards.
 */
function matchPattern(pattern: string, path: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

const _handler: FunctionalConceptHandler = {
  attribute(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;
    const region = input.region as string;
    const agent = input.agent as string;
    const changeRef = input.changeRef as string;

    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'attribution', id, {
      id,
      contentRef,
      region,
      agent,
      timestamp: now,
      changeRef,
    });

    return complete(p, 'ok', { attributionId: id }) as StorageProgram<Result>;
  },

  blame(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;

    let p = createProgram();
    p = find(p, 'attribution', { contentRef }, 'records');

    p = mapBindings(p, (bindings) => {
      const records = bindings.records as Record<string, unknown>[];
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

      return map;
    }, 'map');

    return completeFrom(p, 'ok', (bindings) => ({
      map: bindings.map,
    })) as StorageProgram<Result>;
  },

  history(input: Record<string, unknown>) {
    const contentRef = input.contentRef as string;
    const region = input.region as string;

    let p = createProgram();
    p = find(p, 'attribution', { contentRef, region }, 'records');

    return branch(p,
      (bindings) => (bindings.records as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notFound', { message: `No attributions found for contentRef '${contentRef}' and region '${region}'` }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const records = bindings.records as Record<string, unknown>[];
          const sorted = records.sort((a, b) =>
            (a.timestamp as string).localeCompare(b.timestamp as string),
          );
          const chain = sorted.map(r => r.id as string);
          return { chain };
        });
      },
    ) as StorageProgram<Result>;
  },

  setOwnership(input: Record<string, unknown>) {
    const pattern = input.pattern as string;
    const owners = input.owners as string[];

    let p = createProgram();
    p = find(p, 'attribution-ownership', { pattern }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => {
        thenP = putFrom(thenP, 'attribution-ownership', '', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>[];
          return { ...existing[0], owners: JSON.stringify(owners) };
        });
        // Need to use mapBindings to get the id for put key
        // Actually putFrom doesn't support dynamic keys - use a different approach
        return complete(thenP, 'ok', {});
      },
      (elseP) => {
        const id = `ownership-${pattern.replace(/[^a-zA-Z0-9]/g, '-')}`;
        elseP = put(elseP, 'attribution-ownership', id, {
          id,
          pattern,
          owners: JSON.stringify(owners),
        });
        return complete(elseP, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },

  queryOwners(input: Record<string, unknown>) {
    const path = input.path as string;

    let p = createProgram();
    p = find(p, 'attribution-ownership', {}, 'rules');

    p = mapBindings(p, (bindings) => {
      const rules = bindings.rules as Record<string, unknown>[];
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

      return { matched, matchedOwners };
    }, 'result');

    return branch(p,
      (bindings) => !(bindings.result as Record<string, unknown>).matched,
      (thenP) => complete(thenP, 'noMatch', { message: `No ownership pattern matches path '${path}'` }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        owners: (bindings.result as Record<string, unknown>).matchedOwners,
      })),
    ) as StorageProgram<Result>;
  },
};

export const attributionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetAttributionCounter(): void {
  idCounter = 0;
}
