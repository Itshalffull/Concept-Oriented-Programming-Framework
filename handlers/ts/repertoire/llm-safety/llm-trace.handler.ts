// @clef-handler style=functional
// ============================================================
// LLMTrace Concept Implementation
//
// Observability for LLM execution pipelines. Captures hierarchical
// trace spans covering every LLM call, tool invocation, retrieval
// operation, and agent step. Tracks latency, token usage, cost,
// and quality metrics. Compatible with OpenTelemetry export.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let _traceCounter = 0;
function generateTraceId(): string {
  return `trace-${Date.now()}-${++_traceCounter}`;
}

let _spanCounter = 0;
function generateSpanId(): string {
  return `span-${Date.now()}-${++_spanCounter}`;
}

const _llmTraceHandler: FunctionalConceptHandler = {
  startTrace(input: Record<string, unknown>) {
    const name = input.name as string;
    const tags = input.tags as { key: string; value: string }[];

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const id = generateTraceId();
    let p = createProgram();
    p = put(p, 'traces', id, {
      id,
      name,
      spans: [],
      metrics: [],
      tags: tags || [],
      total_cost: 0,
      total_tokens: 0,
      created_at: new Date().toISOString(),
    });

    return complete(p, 'ok', { trace: id }) as StorageProgram<Result>;
  },

  startSpan(input: Record<string, unknown>) {
    const traceId = input.trace as string;
    const operation = input.operation as string;
    const parentSpanId = (input.parent_span_id as string | null) ?? null;

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Trace or parent span not found' }),
      (() => {
        // If parent_span_id provided, verify it exists
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');

        if (parentSpanId) {
          b = mapBindings(b, (bindings) => {
            const trace = bindings.existing as Record<string, unknown>;
            const spans = trace.spans as { id: string }[];
            return spans.some(s => s.id === parentSpanId);
          }, 'parentExists');
        }

        const spanId = generateSpanId();

        b = putFrom(b, 'traces', traceId, (bindings) => {
          if (parentSpanId && !(bindings.parentExists as boolean)) {
            // Parent not found case handled below via branch
            return bindings.existing as Record<string, unknown>;
          }
          const existing = bindings.existing as Record<string, unknown>;
          const spans = [...(existing.spans as Record<string, unknown>[])];
          spans.push({
            id: spanId,
            parent_id: parentSpanId,
            operation,
            start_time: new Date().toISOString(),
            end_time: null,
            status: 'running',
            metadata: null,
          });
          return { ...existing, spans };
        });

        if (parentSpanId) {
          return branch(b,
            (bindings) => !(bindings.parentExists as boolean),
            complete(createProgram(), 'notfound', { message: 'Parent span not found' }),
            complete(createProgram(), 'ok', { span_id: spanId }),
          );
        }

        return complete(b, 'ok', { span_id: spanId });
      })(),
    ) as StorageProgram<Result>;
  },

  endSpan(input: Record<string, unknown>) {
    const traceId = input.trace as string;
    const spanId = input.span_id as string;
    const status = input.status as string;
    const metrics = (input.metrics as { tokens: number; cost: number; latency_ms: number } | null) ?? null;

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Span not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');
        b = mapBindings(b, (bindings) => {
          const trace = bindings.existing as Record<string, unknown>;
          const spans = trace.spans as { id: string }[];
          return spans.some(s => s.id === spanId);
        }, 'spanExists');

        return branch(b,
          (bindings) => !(bindings.spanExists as boolean),
          complete(createProgram(), 'notfound', { message: 'Span not found' }),
          (() => {
            let u = createProgram();
            u = get(u, 'traces', traceId, 'existing');
            u = putFrom(u, 'traces', traceId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const spans = (existing.spans as Record<string, unknown>[]).map(s => {
                if ((s.id as string) === spanId) {
                  return {
                    ...s,
                    end_time: new Date().toISOString(),
                    status,
                  };
                }
                return s;
              });

              let totalCost = existing.total_cost as number;
              let totalTokens = existing.total_tokens as number;
              let traceMetrics = [...(existing.metrics as Record<string, unknown>[])];

              if (metrics) {
                totalCost += metrics.cost;
                totalTokens += metrics.tokens;
                traceMetrics.push({ span_id: spanId, key: 'tokens', value: metrics.tokens });
                traceMetrics.push({ span_id: spanId, key: 'cost', value: metrics.cost });
                traceMetrics.push({ span_id: spanId, key: 'latency_ms', value: metrics.latency_ms });
              }

              return { ...existing, spans, metrics: traceMetrics, total_cost: totalCost, total_tokens: totalTokens };
            });
            return complete(u, 'ok', { span_id: spanId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addMetric(input: Record<string, unknown>) {
    const traceId = input.trace as string;
    const spanId = input.span_id as string;
    const key = input.key as string;
    const value = input.value as number;

    if (!traceId || traceId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'trace is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Span not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');
        b = mapBindings(b, (bindings) => {
          const trace = bindings.existing as Record<string, unknown>;
          const spans = trace.spans as { id: string }[];
          return spans.some(s => s.id === spanId);
        }, 'spanExists');

        return branch(b,
          (bindings) => !(bindings.spanExists as boolean),
          complete(createProgram(), 'notfound', { message: 'Span not found' }),
          (() => {
            let u = createProgram();
            u = get(u, 'traces', traceId, 'existing');
            u = putFrom(u, 'traces', traceId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const metrics = [...(existing.metrics as Record<string, unknown>[])];
              metrics.push({ span_id: spanId, key, value });
              return { ...existing, metrics };
            });
            return complete(u, 'ok', {});
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  getCost(input: Record<string, unknown>) {
    const traceId = input.trace as string;

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Trace not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');
        b = mapBindings(b, (bindings) => {
          const trace = bindings.existing as Record<string, unknown>;
          const metrics = trace.metrics as { span_id: string; key: string; value: number }[];
          const spans = trace.spans as { id: string; operation: string }[];

          const costMetrics = metrics.filter(m => m.key === 'cost');
          const perSpan = costMetrics.map(cm => {
            const span = spans.find(s => s.id === cm.span_id);
            return {
              span_id: cm.span_id,
              operation: span?.operation ?? 'unknown',
              cost: cm.value,
            };
          });

          return { total: trace.total_cost as number, per_span: perSpan };
        }, 'costData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.costData as { total: number; per_span: unknown[] };
          return { total: data.total, per_span: data.per_span };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  getTrace(input: Record<string, unknown>) {
    const traceId = input.trace as string;

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Trace not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');
        b = mapBindings(b, (bindings) => {
          const trace = bindings.existing as Record<string, unknown>;
          const spans = trace.spans as Record<string, unknown>[];
          const metrics = trace.metrics as { span_id: string; key: string; value: number }[];

          return spans.map(s => {
            const startTime = new Date(s.start_time as string).getTime();
            const endTime = s.end_time ? new Date(s.end_time as string).getTime() : Date.now();
            const spanMetrics = metrics.filter(m => m.span_id === (s.id as string));

            return {
              id: s.id,
              parent_id: s.parent_id,
              operation: s.operation,
              duration_ms: endTime - startTime,
              status: s.status,
              metrics: spanMetrics.map(m => ({ key: m.key, value: m.value })),
            };
          });
        }, 'spanTree');

        return completeFrom(b, 'ok', (bindings) => ({
          spans: bindings.spanTree as unknown[],
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const traceId = input.trace as string;
    const format = input.format as string;

    let p = createProgram();
    p = get(p, 'traces', traceId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Trace not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'traces', traceId, 'existing');
        b = mapBindings(b, (bindings) => {
          const trace = bindings.existing as Record<string, unknown>;

          // Stub: serialize trace data to the requested format
          switch (format) {
            case 'opentelemetry':
              return JSON.stringify({
                resourceSpans: [{
                  resource: { attributes: trace.tags },
                  scopeSpans: [{ spans: trace.spans }],
                }],
              });
            case 'langsmith':
            case 'langfuse':
              return JSON.stringify({
                format,
                trace_id: traceId,
                name: trace.name,
                spans: trace.spans,
                metrics: trace.metrics,
              });
            case 'json':
            default:
              return JSON.stringify(trace);
          }
        }, 'exported');

        return completeFrom(b, 'ok', (bindings) => ({
          exported: bindings.exported as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },
};

export const llmTraceHandler = autoInterpret(_llmTraceHandler);
