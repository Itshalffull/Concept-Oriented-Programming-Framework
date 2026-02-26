// ============================================================
// Telemetry Concept Implementation
//
// Reference exporter that maps ActionLog records to
// OpenTelemetry-compatible spans. Supports two modes:
// - stdout: pretty-printed spans for development
// - otlp: structured JSON for production pipelines
//
// See Architecture doc Section 16.2 for the OTel mapping:
//   flow ID        → trace ID
//   record ID      → span ID
//   parent edge    → parent span ID
//   concept:action → span name
//   variant        → span status (ok → OK, error → ERROR)
//   output fields  → span attributes
//   duration       → span start/end time
//   sync name      → span link annotation
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

/**
 * Exporter configuration.
 */
export interface ExporterConfig {
  type: 'stdout' | 'otlp';
  endpoint?: string;   // OTLP endpoint URL (for otlp type)
  verbose?: boolean;    // Include full field details in stdout
}

/**
 * An OpenTelemetry-compatible span derived from an ActionRecord.
 */
export interface TelemetrySpan {
  traceId: string;       // flow ID
  spanId: string;        // record ID
  parentSpanId?: string; // provenance parent
  name: string;          // concept/action
  status: 'OK' | 'ERROR' | 'UNSET';
  startTime: string;
  endTime: string;
  attributes: Record<string, unknown>;
  links?: { syncName: string }[];
}

// Module-level exporter state
let currentExporter: ExporterConfig = { type: 'stdout' };
let exportedSpans: TelemetrySpan[] = [];

/**
 * Get all exported spans (for testing/programmatic access).
 */
export function getExportedSpans(): TelemetrySpan[] {
  return [...exportedSpans];
}

/**
 * Clear exported spans (for testing).
 */
export function clearExportedSpans(): void {
  exportedSpans = [];
}

/**
 * Get the current exporter configuration.
 */
export function getExporterConfig(): ExporterConfig {
  return { ...currentExporter };
}

export const telemetryHandler: ConceptHandler = {
  async export(input, storage) {
    try {
      const record = input.record as Record<string, unknown> | undefined;

      if (!record) {
        return {
          variant: 'ok',
          spanId: 'no-record',
        };
      }

      // Map ActionRecord to OTel span
      const span = mapRecordToSpan(record);

      // Store span
      await storage.put('spans', span.spanId, { ...span, exported: true });

      // Export based on configured exporter
      if (currentExporter.type === 'stdout') {
        exportToStdout(span, currentExporter.verbose || false);
      } else if (currentExporter.type === 'otlp') {
        await exportToOtlp(span, currentExporter.endpoint);
      }

      // Track for programmatic access
      exportedSpans.push(span);

      return {
        variant: 'ok',
        spanId: span.spanId,
      };
    } catch (err: unknown) {
      // Telemetry failures must never break application flows
      const message = err instanceof Error ? err.message : String(err);
      return {
        variant: 'error',
        message,
      };
    }
  },

  async configure(input, _storage) {
    const exporter = input.exporter as Record<string, unknown> | undefined;
    if (exporter) {
      currentExporter = {
        type: (exporter.type as string) === 'otlp' ? 'otlp' : 'stdout',
        endpoint: exporter.endpoint as string | undefined,
        verbose: exporter.verbose as boolean | undefined,
      };
    }
    return { variant: 'ok' };
  },
};

/**
 * Map an ActionRecord to an OpenTelemetry-compatible span.
 *
 * ActionLog → OpenTelemetry mapping (Section 16.2):
 * | ActionLog                  | OpenTelemetry          |
 * |----------------------------|------------------------|
 * | flow ID                    | trace ID               |
 * | action record ID           | span ID                |
 * | provenance parent edge     | parent span ID         |
 * | concept URI + action name  | span name              |
 * | completion variant         | span status            |
 * | completion fields          | span attributes        |
 * | action duration            | span start/end time    |
 * | sync name                  | span link annotation   |
 */
function mapRecordToSpan(record: Record<string, unknown>): TelemetrySpan {
  const concept = record.concept as string || 'unknown';
  const action = record.action as string || 'unknown';
  const variant = record.variant as string | undefined;

  // Derive span status from variant
  let status: 'OK' | 'ERROR' | 'UNSET';
  if (!variant) {
    status = 'UNSET'; // invocation records have no variant
  } else if (variant === 'ok') {
    status = 'OK';
  } else {
    status = 'ERROR';
  }

  // Build attributes from output fields
  const output = record.output as Record<string, unknown> | undefined;
  const input = record.input as Record<string, unknown> | undefined;
  const attributes: Record<string, unknown> = {};

  if (variant) attributes['clef.variant'] = variant;
  if (record.sync) attributes['clef.sync'] = record.sync;
  if (record.type) attributes['clef.record_type'] = record.type;

  // Add output fields as attributes
  if (output) {
    for (const [key, value] of Object.entries(output)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        attributes[`clef.output.${key}`] = value;
      }
    }
  }

  // Add input fields as attributes
  if (input) {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        attributes[`clef.input.${key}`] = value;
      }
    }
  }

  // Extract concept short name for span name
  const conceptShort = concept.split('/').pop() || concept;

  const span: TelemetrySpan = {
    traceId: record.flow as string || 'unknown',
    spanId: record.id as string || 'unknown',
    parentSpanId: record.parent as string | undefined,
    name: `${conceptShort}/${action}`,
    status,
    startTime: record.timestamp as string || new Date().toISOString(),
    endTime: record.timestamp as string || new Date().toISOString(),
    attributes,
  };

  if (record.sync) {
    span.links = [{ syncName: record.sync as string }];
  }

  return span;
}

/**
 * Export a span to stdout (development mode).
 */
function exportToStdout(span: TelemetrySpan, verbose: boolean): void {
  const statusIcon = span.status === 'OK' ? '✓' : span.status === 'ERROR' ? '✗' : '·';
  const parentInfo = span.parentSpanId ? ` (parent: ${span.parentSpanId.slice(0, 8)}...)` : '';
  const syncInfo = span.links?.[0] ? ` [${span.links[0].syncName}]` : '';

  if (verbose) {
    console.log(
      `[telemetry] ${statusIcon} ${span.name} trace=${span.traceId.slice(0, 8)}... span=${span.spanId.slice(0, 8)}...${parentInfo}${syncInfo}`,
    );
    if (Object.keys(span.attributes).length > 0) {
      for (const [key, value] of Object.entries(span.attributes)) {
        console.log(`            ${key}=${JSON.stringify(value)}`);
      }
    }
  } else {
    console.log(
      `[telemetry] ${statusIcon} ${span.name}${syncInfo}`,
    );
  }
}

/**
 * Export a span via OTLP (production mode).
 * Formats the span as OTLP-compatible JSON.
 * In a real deployment, this would POST to the OTLP endpoint.
 */
async function exportToOtlp(
  span: TelemetrySpan,
  endpoint?: string,
): Promise<void> {
  // Build OTLP-compatible resource span
  const otlpPayload = {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'clef' } },
        ],
      },
      scopeSpans: [{
        scope: { name: 'clef-telemetry' },
        spans: [{
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId || '',
          name: span.name,
          kind: 1, // INTERNAL
          startTimeUnixNano: new Date(span.startTime).getTime() * 1_000_000,
          endTimeUnixNano: new Date(span.endTime).getTime() * 1_000_000,
          status: {
            code: span.status === 'OK' ? 1 : span.status === 'ERROR' ? 2 : 0,
          },
          attributes: Object.entries(span.attributes).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
          })),
        }],
      }],
    }],
  };

  if (endpoint) {
    // In a real implementation, this would use fetch() or http.request()
    // to POST to the OTLP endpoint. For now, we log the payload.
    console.log(`[telemetry:otlp] POST ${endpoint}`);
    console.log(JSON.stringify(otlpPayload));
  }
}
