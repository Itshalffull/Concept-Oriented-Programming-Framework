// @clef-handler style=functional
// ============================================================
// Finding Concept Implementation (Functional)
//
// Track quality issues through their lifecycle. Each finding
// records what rule was violated, where in the code, when it
// was detected, and its resolution status. Supports acknowledge,
// suppress, and resolve workflows.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { createHash } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `finding-${++idCounter}`;
}

function computeFingerprint(ruleId: string, target: string, location: string): string {
  return createHash('sha256')
    .update(`${ruleId}:${target}:${location}`)
    .digest('hex')
    .slice(0, 16);
}

const VALID_GROUP_BY = ['severity', 'category', 'target', 'ruleId', 'status', 'source'];

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'Finding' });
  },

  report(input: Record<string, unknown>): StorageProgram<Result> {
    const ruleId = input.ruleId as string;
    const target = input.target as string;
    const location = input.location as string;
    const message = input.message as string;
    const severity = input.severity as string;
    const category = input.category as string;
    const effort = (input.effort as string | undefined) ?? null;
    const tags = (input.tags as string[] | undefined) ?? [];
    const source = (input.source as string | undefined) ?? null;

    const fingerprint = computeFingerprint(ruleId, target, location);
    const now = new Date().toISOString();

    // Check if a finding with the same fingerprint already exists
    let p = createProgram();
    p = find(p, 'finding', {}, 'allFindings');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allFindings ?? []) as Record<string, unknown>[];
      return all.find(f => f.fingerprint === fingerprint) ?? null;
    }, 'existingFinding');

    return branch(p,
      (bindings) => bindings.existingFinding != null,
      // Existing finding found -- check status
      (() => {
        let pExisting = createProgram();
        return branch(pExisting,
          (bindings) => {
            const existing = bindings.existingFinding as Record<string, unknown>;
            const status = existing.status as string;
            return status === 'open' || status === 'acknowledged';
          },
          // Still open or acknowledged -- deduplicate, update detectedAt
          (() => {
            let pDedup = createProgram();
            pDedup = mapBindings(pDedup, (bindings) => {
              const existing = bindings.existingFinding as Record<string, unknown>;
              return existing.id as string;
            }, '_existingId');
            pDedup = putFrom(pDedup, 'finding', '_existingId', (bindings) => {
              const existing = bindings.existingFinding as Record<string, unknown>;
              return { ...existing, detectedAt: now };
            });
            return completeFrom(pDedup, 'existing', (bindings) => ({
              finding: bindings._existingId as string,
            }));
          })(),
          // Was resolved or suppressed -- recurrence, reset to open
          (() => {
            let pRecur = createProgram();
            pRecur = mapBindings(pRecur, (bindings) => {
              const existing = bindings.existingFinding as Record<string, unknown>;
              return existing.id as string;
            }, '_recurId');
            pRecur = putFrom(pRecur, 'finding', '_recurId', (bindings) => {
              const existing = bindings.existingFinding as Record<string, unknown>;
              return {
                ...existing,
                status: 'open',
                detectedAt: now,
                resolvedAt: null,
                resolvedIn: null,
                suppressedAt: null,
                suppressedBy: null,
                suppressionReason: null,
                acknowledgedAt: null,
                acknowledgedBy: null,
              };
            });
            return completeFrom(pRecur, 'recurrence', (bindings) => ({
              finding: bindings._recurId as string,
            }));
          })(),
        );
      })(),
      // No existing finding -- create new
      (() => {
        const id = nextId();
        let pNew = createProgram();
        pNew = put(pNew, 'finding', id, {
          id,
          ruleId,
          target,
          location,
          message,
          fingerprint,
          status: 'open',
          detectedAt: now,
          detectedIn: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
          suppressedBy: null,
          suppressedAt: null,
          suppressionReason: null,
          resolvedAt: null,
          resolvedIn: null,
          severity,
          category,
          effort,
          tags,
          source,
        });
        return complete(pNew, 'new', { finding: id });
      })(),
    );
  },

  acknowledge(input: Record<string, unknown>): StorageProgram<Result> {
    const findingId = input.finding as string;
    const by = input.by as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'finding', findingId, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: `No finding exists with id ${findingId}` }),
      (() => {
        let pFound = createProgram();
        return branch(pFound,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return existing.status !== 'open';
          },
          // Not open -- cannot acknowledge
          completeFrom(createProgram(), 'notOpen', (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return {
              finding: findingId,
              status: existing.status as string,
            };
          }),
          // Open -- transition to acknowledged
          (() => {
            let pAck = createProgram();
            pAck = putFrom(pAck, 'finding', findingId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                status: 'acknowledged',
                acknowledgedBy: by,
                acknowledgedAt: now,
              };
            });
            return complete(pAck, 'ok', { finding: findingId });
          })(),
        );
      })(),
    );
  },

  suppress(input: Record<string, unknown>): StorageProgram<Result> {
    const findingId = input.finding as string;
    const by = input.by as string;
    const reason = input.reason as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'finding', findingId, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: `No finding exists with id ${findingId}` }),
      (() => {
        let pFound = createProgram();
        return branch(pFound,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return existing.status === 'suppressed';
          },
          // Already suppressed
          complete(createProgram(), 'alreadySuppressed', { finding: findingId }),
          // Suppress it
          (() => {
            let pSup = createProgram();
            pSup = putFrom(pSup, 'finding', findingId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                status: 'suppressed',
                suppressedBy: by,
                suppressedAt: now,
                suppressionReason: reason,
              };
            });
            return complete(pSup, 'ok', { finding: findingId });
          })(),
        );
      })(),
    );
  },

  resolve(input: Record<string, unknown>): StorageProgram<Result> {
    const findingId = input.finding as string;
    const resolvedIn = (input.resolvedIn as string | undefined) ?? null;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, 'finding', findingId, 'existing');

    return branch(p,
      (bindings) => bindings.existing == null,
      complete(createProgram(), 'notfound', { message: `No finding exists with id ${findingId}` }),
      (() => {
        let pFound = createProgram();
        return branch(pFound,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            return existing.status === 'resolved';
          },
          // Already resolved
          complete(createProgram(), 'alreadyResolved', { finding: findingId }),
          // Resolve it
          (() => {
            let pRes = createProgram();
            pRes = putFrom(pRes, 'finding', findingId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                status: 'resolved',
                resolvedAt: now,
                resolvedIn,
              };
            });
            return complete(pRes, 'ok', { finding: findingId });
          })(),
        );
      })(),
    );
  },

  query(input: Record<string, unknown>): StorageProgram<Result> {
    const targets = (input.targets as string[] | undefined) ?? null;
    const ruleIds = (input.ruleIds as string[] | undefined) ?? null;
    const severities = (input.severities as string[] | undefined) ?? null;
    const statuses = (input.statuses as string[] | undefined) ?? null;
    const sources = (input.sources as string[] | undefined) ?? null;

    let p = createProgram();
    p = find(p, 'finding', {}, 'allFindings');
    p = mapBindings(p, (bindings) => {
      let results = (bindings.allFindings ?? []) as Record<string, unknown>[];
      if (targets) results = results.filter(f => targets.includes(f.target as string));
      if (ruleIds) results = results.filter(f => ruleIds.includes(f.ruleId as string));
      if (severities) results = results.filter(f => severities.includes(f.severity as string));
      if (statuses) results = results.filter(f => statuses.includes(f.status as string));
      if (sources) results = results.filter(f => sources.includes(f.source as string));
      return results.map(f => ({
        finding: f.id,
        ruleId: f.ruleId,
        target: f.target,
        location: f.location,
        message: f.message,
        severity: f.severity,
        status: f.status,
        source: f.source ?? null,
        detectedAt: f.detectedAt,
      }));
    }, 'filtered');

    return completeFrom(p, 'ok', (bindings) => ({
      findings: bindings.filtered as unknown[],
    }));
  },

  summary(input: Record<string, unknown>): StorageProgram<Result> {
    const groupBy = input.groupBy as string;

    if (!VALID_GROUP_BY.includes(groupBy)) {
      return complete(createProgram(), 'invalidGroupBy', {
        message: `Invalid groupBy value "${groupBy}". Must be one of: ${VALID_GROUP_BY.join(', ')}`,
      });
    }

    let p = createProgram();
    p = find(p, 'finding', {}, 'allFindings');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allFindings ?? []) as Record<string, unknown>[];
      const groups = new Map<string, Record<string, unknown>[]>();

      for (const f of all) {
        const key = (f[groupBy] as string) ?? 'unknown';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f);
      }

      const now = Date.now();
      return Array.from(groups.entries()).map(([key, items]) => {
        const open = items.filter(i => i.status === 'open').length;
        const acknowledged = items.filter(i => i.status === 'acknowledged').length;
        const suppressed = items.filter(i => i.status === 'suppressed').length;
        const resolved = items.filter(i => i.status === 'resolved').length;

        // Compute mean age in days for open/acknowledged findings
        const activeItems = items.filter(i => i.status === 'open' || i.status === 'acknowledged');
        let meanAge: number | null = null;
        if (activeItems.length > 0) {
          const totalAge = activeItems.reduce((sum, i) => {
            const detected = new Date(i.detectedAt as string).getTime();
            return sum + (now - detected) / (1000 * 60 * 60 * 24);
          }, 0);
          meanAge = totalAge / activeItems.length;
        }

        return {
          key,
          total: items.length,
          open,
          acknowledged,
          suppressed,
          resolved,
          meanAge,
        };
      });
    }, 'groups');

    return completeFrom(p, 'ok', (bindings) => ({
      groups: bindings.groups as unknown[],
    }));
  },
};

export const findingHandler = autoInterpret(_handler);
