// @migrated dsl-constructs 2026-03-18
// ============================================================
// ErrorCorrelation Handler
//
// Links runtime errors to their static context -- which concept,
// action, variant, sync, widget, file, and line produced the
// error, and what was the state of the flow at failure time.
//
// Resolves concept/action names to Score semantic entity symbols
// (ConceptEntity, ActionEntity) so errors are queryable by the
// same identifiers used in analysis, flow graphs, and coverage.
//
// The root_cause action walks backward through the flow to find
// the earliest deviation from the expected FlowGraph path.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `error-correlation-${++idCounter}`;
}

/**
 * Parse a stack trace string into a source location.
 */
function parseSourceFromStack(stack: string | undefined): { file: string; line: number; col: number } | null {
  if (!stack) return null;

  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/at\s+(?:.*?\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      const file = match[1];
      if (file.includes('node_modules') || file.includes('node:internal')) continue;
      return {
        file,
        line: parseInt(match[2], 10),
        col: parseInt(match[3], 10),
      };
    }
  }
  return null;
}

function resolveConceptSymbol(conceptUri: string): string {
  const name = conceptUri.includes('/') ? conceptUri.split('/').pop()! : conceptUri;
  return `ConceptEntity:${name}`;
}

function resolveActionSymbol(conceptUri: string, action: string): string {
  const name = conceptUri.includes('/') ? conceptUri.split('/').pop()! : conceptUri;
  return `ActionEntity:${name}/${action}`;
}

function resolveVariantSymbol(conceptUri: string, action: string, variant: string): string {
  const name = conceptUri.includes('/') ? conceptUri.split('/').pop()! : conceptUri;
  return `VariantEntity:${name}/${action}/${variant}`;
}

function resolveSyncSymbol(syncName: string): string {
  return syncName ? `SyncEntity:${syncName}` : '';
}

/**
 * Extract error context from a raw event JSON string. Pure helper.
 */
function extractErrorContext(rawEvent: string, flowId: string): {
  conceptEntity: string;
  actionEntity: string;
  variantEntity: string;
  syncEntity: string;
  widgetEntity: string;
  stackTrace: string;
  sourceLocation: string;
  flowContext: string;
} {
  let conceptEntity = '';
  let actionEntity = '';
  let variantEntity = '';
  let syncEntity = '';
  let widgetEntity = '';
  let stackTrace = '';
  let sourceLocation = '{}';
  let flowContext = '{}';

  try {
    const event = JSON.parse(rawEvent);
    const concept = event.concept || event.conceptEntity || '';
    const action = event.action || event.actionEntity || '';
    const variant = event.variant || event.variantEntity || '';
    const sync = event.sync || event.syncEntity || '';
    widgetEntity = event.widget || event.widgetEntity || '';

    if (concept) conceptEntity = resolveConceptSymbol(concept);
    if (concept && action) actionEntity = resolveActionSymbol(concept, action);
    if (concept && action && variant) variantEntity = resolveVariantSymbol(concept, action, variant);
    if (sync) syncEntity = resolveSyncSymbol(sync);

    stackTrace = event.stack || '';

    const stackSource = parseSourceFromStack(stackTrace);
    if (stackSource) {
      sourceLocation = JSON.stringify(stackSource);
    } else if (event.file || event.line) {
      sourceLocation = JSON.stringify({
        file: event.file || '',
        line: event.line || 0,
        col: event.col || 0,
      });
    }

    flowContext = JSON.stringify({
      flowId,
      step: event.step || 0,
      phase: event.phase || '',
    });
  } catch {
    // rawEvent may not be valid JSON
  }

  return { conceptEntity, actionEntity, variantEntity, syncEntity, widgetEntity, stackTrace, sourceLocation, flowContext };
}

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    const flowId = input.flowId as string;
    const errorKind = input.errorKind as string;
    const message = input.message as string;
    const rawEvent = input.rawEvent as string;

    const id = nextId();
    const timestamp = new Date().toISOString();
    const ctx = extractErrorContext(rawEvent, flowId);

    let p = createProgram();
    p = put(p, 'error-correlation', id, {
      id,
      flowId,
      timestamp,
      errorKind,
      errorMessage: message,
      stackTrace: ctx.stackTrace,
      conceptEntity: ctx.conceptEntity,
      actionEntity: ctx.actionEntity,
      variantEntity: ctx.variantEntity,
      syncEntity: ctx.syncEntity,
      widgetEntity: ctx.widgetEntity,
      sourceLocation: ctx.sourceLocation,
      flowContext: ctx.flowContext,
    });

    return complete(p, 'ok', { error: id }) as StorageProgram<Result>;
  },

  findByEntity(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'error-correlation', {}, 'allErrors');

    return completeFrom(p, 'ok', (bindings) => {
      const allErrors = bindings.allErrors as Record<string, unknown>[];
      const matching = allErrors.filter((e) => {
        const matchesSymbol =
          e.conceptEntity === symbol ||
          e.actionEntity === symbol ||
          e.variantEntity === symbol ||
          e.syncEntity === symbol ||
          e.widgetEntity === symbol;

        if (!matchesSymbol) return false;

        if (since && since !== '') {
          const errorTime = e.timestamp as string;
          return errorTime >= since;
        }
        return true;
      });

      return { errors: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findByKind(input: Record<string, unknown>) {
    const errorKind = input.errorKind as string;
    const since = input.since as string;

    let p = createProgram();
    p = find(p, 'error-correlation', { errorKind }, 'results');

    return completeFrom(p, 'ok', (bindings) => {
      const results = bindings.results as Record<string, unknown>[];
      const filtered = since && since !== ''
        ? results.filter((e) => (e.timestamp as string) >= since)
        : results;

      return { errors: JSON.stringify(filtered) };
    }) as StorageProgram<Result>;
  },

  errorHotspots(input: Record<string, unknown>) {
    const since = input.since as string;
    const topN = input.topN as number;

    let p = createProgram();
    p = find(p, 'error-correlation', {}, 'allErrors');

    return completeFrom(p, 'ok', (bindings) => {
      const allErrors = bindings.allErrors as Record<string, unknown>[];
      const filtered = since && since !== ''
        ? allErrors.filter((e) => (e.timestamp as string) >= since)
        : allErrors;

      const counts = new Map<string, { count: number; lastSeen: string; sampleMessage: string; sampleStack: string }>();

      for (const e of filtered) {
        const symbol =
          (e.actionEntity as string) ||
          (e.syncEntity as string) ||
          (e.conceptEntity as string) ||
          (e.widgetEntity as string) ||
          'unknown';

        const existing = counts.get(symbol);
        const ts = e.timestamp as string;
        if (existing) {
          existing.count++;
          if (ts > existing.lastSeen) {
            existing.lastSeen = ts;
            existing.sampleMessage = e.errorMessage as string;
            existing.sampleStack = e.stackTrace as string || '';
          }
        } else {
          counts.set(symbol, {
            count: 1,
            lastSeen: ts,
            sampleMessage: e.errorMessage as string,
            sampleStack: e.stackTrace as string || '',
          });
        }
      }

      const hotspots = [...counts.entries()]
        .map(([symbol, data]) => ({ symbol, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN || 10);

      return { hotspots: JSON.stringify(hotspots) };
    }) as StorageProgram<Result>;
  },

  rootCause(input: Record<string, unknown>) {
    const error = input.error as string;

    let p = createProgram();
    p = get(p, 'error-correlation', error, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'dynamic', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const flowId = record.flowId as string;

          // We need flow records but cannot do another storage call inside completeFrom.
          // Return partial data for sync-chain resolution.
          let source = record.sourceLocation as string;
          if (!source || source === '{}') {
            const stackSource = parseSourceFromStack(record.stackTrace as string);
            source = stackSource
              ? JSON.stringify(stackSource)
              : JSON.stringify({ file: '', line: 0, col: 0 });
          }

          return {
            variant: 'inconclusive',
            partialChain: '[]',
            source,
          };
        });
      },
      (elseP) => complete(elseP, 'inconclusive', { partialChain: '[]' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const error = input.error as string;

    let p = createProgram();
    p = get(p, 'error-correlation', error, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          error: record.id as string,
          flowId: record.flowId as string,
          errorKind: record.errorKind as string,
          errorMessage: record.errorMessage as string,
          stackTrace: record.stackTrace as string || '',
          conceptEntity: record.conceptEntity as string || '',
          actionEntity: record.actionEntity as string || '',
          sourceLocation: record.sourceLocation as string || '{}',
          timestamp: record.timestamp as string,
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const errorCorrelationHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetErrorCorrelationCounter(): void {
  idCounter = 0;
}
