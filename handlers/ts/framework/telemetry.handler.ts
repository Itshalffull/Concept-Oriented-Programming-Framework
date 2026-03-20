// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Telemetry Concept Implementation
//
// Reference exporter that maps ActionLog records to
// OpenTelemetry-compatible spans.
// See Architecture doc Section 16.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

export interface ExporterConfig {
  type: 'stdout' | 'otlp';
  endpoint?: string;
  verbose?: boolean;
}

export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  status: 'OK' | 'ERROR' | 'UNSET';
  startTime: string;
  endTime: string;
  attributes: Record<string, unknown>;
  links?: { syncName: string }[];
}

// Module-level exporter state
let currentExporter: ExporterConfig = { type: 'stdout' };
let exportedSpans: TelemetrySpan[] = [];

export function getExportedSpans(): TelemetrySpan[] { return [...exportedSpans]; }
export function clearExportedSpans(): void { exportedSpans = []; }
export function getExporterConfig(): ExporterConfig { return { ...currentExporter }; }

function mapRecordToSpan(record: Record<string, unknown>): TelemetrySpan {
  const concept = record.concept as string || 'unknown';
  const action = record.action as string || 'unknown';
  const variant = record.variant as string | undefined;
  let status: 'OK' | 'ERROR' | 'UNSET';
  if (!variant) status = 'UNSET'; else if (variant === 'ok') status = 'OK'; else status = 'ERROR';
  const output = record.output as Record<string, unknown> | undefined;
  const input = record.input as Record<string, unknown> | undefined;
  const attributes: Record<string, unknown> = {};
  if (variant) attributes['clef.variant'] = variant;
  if (record.sync) attributes['clef.sync'] = record.sync;
  if (record.type) attributes['clef.record_type'] = record.type;
  if (output) for (const [key, value] of Object.entries(output)) { if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') attributes[`clef.output.${key}`] = value; }
  if (input) for (const [key, value] of Object.entries(input)) { if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') attributes[`clef.input.${key}`] = value; }
  const conceptShort = concept.split('/').pop() || concept;
  const span: TelemetrySpan = { traceId: record.flow as string || 'unknown', spanId: record.id as string || 'unknown', parentSpanId: record.parent as string | undefined, name: `${conceptShort}/${action}`, status, startTime: record.timestamp as string || new Date().toISOString(), endTime: record.timestamp as string || new Date().toISOString(), attributes };
  if (record.sync) span.links = [{ syncName: record.sync as string }];
  return span;
}

function exportToStdout(span: TelemetrySpan, verbose: boolean): void {
  const statusIcon = span.status === 'OK' ? '+' : span.status === 'ERROR' ? 'x' : '.';
  const syncInfo = span.links?.[0] ? ` [${span.links[0].syncName}]` : '';
  if (verbose) { console.log(`[telemetry] ${statusIcon} ${span.name} trace=${span.traceId.slice(0, 8)}... span=${span.spanId.slice(0, 8)}...${syncInfo}`); }
  else { console.log(`[telemetry] ${statusIcon} ${span.name}${syncInfo}`); }
}

const _handler: FunctionalConceptHandler = {
  export(input: Record<string, unknown>) {
    try {
      const record = input.record as Record<string, unknown> | undefined;
      if (!record) { const p = createProgram(); return complete(p, 'ok', { spanId: 'no-record' }) as StorageProgram<Result>; }

      const span = mapRecordToSpan(record);

      // Export based on configured exporter (side effect in pure computation)
      if (currentExporter.type === 'stdout') exportToStdout(span, currentExporter.verbose || false);
      exportedSpans.push(span);

      let p = createProgram();
      p = put(p, 'spans', span.spanId, { ...span, exported: true });
      return complete(p, 'ok', { spanId: span.spanId }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const p = createProgram();
      return complete(p, 'error', { message }) as StorageProgram<Result>;
    }
  },

  configure(input: Record<string, unknown>) {
    const exporter = input.exporter as Record<string, unknown> | undefined;
    if (exporter) {
      currentExporter = {
        type: (exporter.type as string) === 'otlp' ? 'otlp' : 'stdout',
        endpoint: exporter.endpoint as string | undefined,
        verbose: exporter.verbose as boolean | undefined,
      };
    }
    const p = createProgram();
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },
};

export const telemetryHandler = autoInterpret(_handler);
