// FlowTrace — Debug flow tracing: builds execution trace trees from recorded
// flow events (concept invocations, data flow, gate decisions), and renders
// traces into human-readable output formats (text, mermaid, JSON).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FlowTraceStorage,
  FlowTraceBuildInput,
  FlowTraceBuildOutput,
  FlowTraceRenderInput,
  FlowTraceRenderOutput,
} from './types.js';

import {
  buildOk,
  buildError,
  renderOk,
} from './types.js';

export interface FlowTraceError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): FlowTraceError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface FlowTraceHandler {
  readonly build: (
    input: FlowTraceBuildInput,
    storage: FlowTraceStorage,
  ) => TE.TaskEither<FlowTraceError, FlowTraceBuildOutput>;
  readonly render: (
    input: FlowTraceRenderInput,
    storage: FlowTraceStorage,
  ) => TE.TaskEither<FlowTraceError, FlowTraceRenderOutput>;
}

// --- Implementation ---

interface TraceNode {
  readonly id: string;
  readonly concept: string;
  readonly action: string;
  readonly variant: string;
  readonly durationMs: number;
  readonly children: readonly TraceNode[];
  readonly gated: boolean;
}

const buildTraceTree = (
  events: readonly Record<string, unknown>[],
): TraceNode => {
  const sorted = [...events].sort(
    (a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0),
  );
  const rootEvent = sorted[0] ?? {
    concept: 'unknown',
    action: 'unknown',
    variant: 'ok',
  };
  const childEvents = sorted.slice(1);

  const childNodes: TraceNode[] = childEvents.map((e, i) => ({
    id: String(e.eventId ?? `event-${i}`),
    concept: String(e.concept ?? 'unknown'),
    action: String(e.action ?? 'unknown'),
    variant: String(e.variant ?? 'ok'),
    durationMs: Number(e.durationMs ?? 0),
    children: [],
    gated: Boolean(e.gated ?? false),
  }));

  return {
    id: String(rootEvent.eventId ?? 'root'),
    concept: String(rootEvent.concept ?? 'unknown'),
    action: String(rootEvent.action ?? 'unknown'),
    variant: String(rootEvent.variant ?? 'ok'),
    durationMs: Number(rootEvent.durationMs ?? 0),
    children: childNodes,
    gated: Boolean(rootEvent.gated ?? false),
  };
};

const renderTextTrace = (node: TraceNode, depth: number): string => {
  const indent = '  '.repeat(depth);
  const gateMarker = node.gated ? ' [GATED]' : '';
  const line = `${indent}${node.concept}.${node.action} -> ${node.variant} (${node.durationMs}ms)${gateMarker}`;
  const childLines = node.children.map((c) =>
    renderTextTrace(c, depth + 1),
  );
  return [line, ...childLines].join('\n');
};

const renderMermaidTrace = (node: TraceNode): string => {
  const lines: string[] = ['graph TD'];
  const addNode = (n: TraceNode, parentId?: string): void => {
    const nodeLabel = `${n.concept}.${n.action}`;
    const nodeId = n.id.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`    ${nodeId}["${nodeLabel} (${n.variant})"]`);
    if (parentId) {
      lines.push(`    ${parentId} --> ${nodeId}`);
    }
    n.children.forEach((c) => addNode(c, nodeId));
  };
  addNode(node);
  return lines.join('\n');
};

export const flowTraceHandler: FlowTraceHandler = {
  build: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('flow_events', { flowId: input.flowId }),
        mkError('STORAGE_READ'),
      ),
      TE.chain((events) => {
        if (events.length === 0) {
          return TE.right(
            buildError(`No flow events found for flow '${input.flowId}'`),
          );
        }
        const tree = buildTraceTree(events);
        const traceId = `trace-${input.flowId}-${Date.now()}`;
        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('flow_traces', traceId, {
                traceId,
                flowId: input.flowId,
                tree,
                eventCount: events.length,
                builtAt: new Date().toISOString(),
              });
              return buildOk(traceId, tree);
            },
            mkError('BUILD_FAILED'),
          ),
        );
      }),
    ),

  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flow_traces', input.trace),
        mkError('STORAGE_READ'),
      ),
      TE.chain((traceRecord) =>
        pipe(
          O.fromNullable(traceRecord),
          O.fold(
            () =>
              TE.right(
                renderOk(`[No trace data found for '${input.trace}']`),
              ),
            (found) => {
              const tree = found.tree as TraceNode;
              const options = (input.options ?? {}) as { readonly format?: string };
              const format = options.format ?? 'text';

              let output: string;
              if (format === 'mermaid') {
                output = renderMermaidTrace(tree);
              } else if (format === 'json') {
                output = JSON.stringify(tree, null, 2);
              } else {
                output = renderTextTrace(tree, 0);
              }
              return TE.right(renderOk(output));
            },
          ),
        ),
      ),
    ),
};
