// ============================================================
// ErrorCorrelation Handler
//
// Links runtime errors to their static context -- which concept,
// action, variant, sync, widget, file, and line produced the
// error, and what was the state of the flow at failure time. The
// root_cause action walks backward through the flow to find the
// earliest deviation from the expected FlowGraph path.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `error-correlation-${++idCounter}`;
}

export const errorCorrelationHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const flowId = input.flowId as string;
    const errorKind = input.errorKind as string;
    const message = input.message as string;
    const rawEvent = input.rawEvent as string;

    const id = nextId();
    const timestamp = new Date().toISOString();

    // Auto-resolve static context from the flow
    let conceptEntity = '';
    let actionEntity = '';
    let variantEntity = '';
    let syncEntity = '';
    let widgetEntity = '';
    let sourceLocation = '{}';
    let flowContext = '{}';

    try {
      const event = JSON.parse(rawEvent);
      conceptEntity = event.concept || event.conceptEntity || '';
      actionEntity = event.action || event.actionEntity || '';
      variantEntity = event.variant || event.variantEntity || '';
      syncEntity = event.sync || event.syncEntity || '';
      widgetEntity = event.widget || event.widgetEntity || '';
      if (event.file || event.line) {
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

    await storage.put('error-correlation', id, {
      id,
      flowId,
      timestamp,
      errorKind,
      errorMessage: message,
      conceptEntity,
      actionEntity,
      variantEntity,
      syncEntity,
      widgetEntity,
      sourceLocation,
      flowContext,
    });

    return { variant: 'ok', error: id };
  },

  async findByEntity(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbol = input.symbol as string;
    const since = input.since as string;

    const allErrors = await storage.find('error-correlation');
    const matching = allErrors.filter((e) => {
      // Match against any entity field
      const matchesSymbol =
        e.conceptEntity === symbol ||
        e.actionEntity === symbol ||
        e.variantEntity === symbol ||
        e.syncEntity === symbol ||
        e.widgetEntity === symbol;

      if (!matchesSymbol) return false;

      // Filter by since timestamp
      if (since && since !== '') {
        const errorTime = e.timestamp as string;
        return errorTime >= since;
      }
      return true;
    });

    return { variant: 'ok', errors: JSON.stringify(matching) };
  },

  async findByKind(input: Record<string, unknown>, storage: ConceptStorage) {
    const errorKind = input.errorKind as string;
    const since = input.since as string;

    const results = await storage.find('error-correlation', { errorKind });
    const filtered = since && since !== ''
      ? results.filter((e) => (e.timestamp as string) >= since)
      : results;

    return { variant: 'ok', errors: JSON.stringify(filtered) };
  },

  async errorHotspots(input: Record<string, unknown>, storage: ConceptStorage) {
    const since = input.since as string;
    const topN = input.topN as number;

    const allErrors = await storage.find('error-correlation');
    const filtered = since && since !== ''
      ? allErrors.filter((e) => (e.timestamp as string) >= since)
      : allErrors;

    // Group by entity symbols and count
    const counts = new Map<string, { count: number; lastSeen: string; sampleMessage: string }>();

    for (const e of filtered) {
      // Use the most specific entity reference available
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
        }
      } else {
        counts.set(symbol, {
          count: 1,
          lastSeen: ts,
          sampleMessage: e.errorMessage as string,
        });
      }
    }

    // Sort by count descending and take topN
    const hotspots = [...counts.entries()]
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN || 10);

    return { variant: 'ok', hotspots: JSON.stringify(hotspots) };
  },

  async rootCause(input: Record<string, unknown>, storage: ConceptStorage) {
    const error = input.error as string;

    const record = await storage.get('error-correlation', error);
    if (!record) {
      return { variant: 'inconclusive', partialChain: '[]' };
    }

    const flowId = record.flowId as string;

    // Retrieve the enriched flow for this error's flow ID
    const flows = await storage.find('runtime-flow', { flowId });
    if (flows.length === 0) {
      return { variant: 'inconclusive', partialChain: '[]' };
    }

    const flow = flows[0];
    let steps: Array<Record<string, unknown>> = [];
    try {
      steps = JSON.parse(flow.steps as string || '[]');
    } catch {
      return { variant: 'inconclusive', partialChain: '[]' };
    }

    // Walk backward through steps to find first deviation
    const chain: Array<Record<string, unknown>> = [];
    let likelyCause: Record<string, unknown> | null = null;

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      const status = step.status || step.outcome || 'ok';
      chain.unshift({
        step: i,
        entity: step.entity || step.symbol || '',
        status,
      });

      if (status === 'error' || status === 'failed' || status === 'deviation') {
        likelyCause = {
          entity: step.entity || step.symbol || '',
          reason: step.error || step.reason || 'Unknown deviation',
        };
        break;
      }
    }

    if (!likelyCause) {
      return { variant: 'inconclusive', partialChain: JSON.stringify(chain) };
    }

    // Parse source location
    let source = record.sourceLocation as string;
    if (!source || source === '{}') {
      source = JSON.stringify({ file: '', line: 0, col: 0 });
    }

    return {
      variant: 'ok',
      chain: JSON.stringify(chain),
      likelyCause: JSON.stringify(likelyCause),
      source,
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const error = input.error as string;

    const record = await storage.get('error-correlation', error);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      error: record.id as string,
      flowId: record.flowId as string,
      errorKind: record.errorKind as string,
      errorMessage: record.errorMessage as string,
      timestamp: record.timestamp as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetErrorCorrelationCounter(): void {
  idCounter = 0;
}
